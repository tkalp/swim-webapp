"""
One-time migration script: Export all data from Supabase PostgreSQL → local PostgreSQL.

Usage:
    python scripts/migrate_from_supabase.py \
        --source "postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres" \
        --target "postgresql://aquilus:aquilus@localhost:5432/aquilus"

Or with environment variables:
    SUPABASE_DB_URL="postgresql://..." TARGET_DB_URL="postgresql://..." python scripts/migrate_from_supabase.py

The script:
  1. Connects to Supabase PostgreSQL directly (source)
  2. Connects to local PostgreSQL (target)
  3. Creates the schema via SQLAlchemy models
  4. Copies auth.users into the new `users` table
  5. Copies all public tables in FK-dependency order
  6. Recreates views and functions
  7. Verifies row counts match
"""

import argparse
import asyncio
import os
import sys
from datetime import datetime
from pathlib import Path

# Add backend/ to sys.path so we can import app.infrastructure
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

import asyncpg


# ---------------------------------------------------------------------------
# Table migration order (respects foreign-key dependencies)
# ---------------------------------------------------------------------------

# auth.users is handled specially — goes into `users` table.
# The rest are public schema tables copied 1-to-1.

# ---------------------------------------------------------------------------
# Column rename mappings: source_col → target_col (per table)
# When Supabase column names differ from the new schema
# ---------------------------------------------------------------------------

COLUMN_RENAMES: dict[str, dict[str, str]] = {
    "swimmer_external_links": {
        "platform": "external_source",
        "external_id": "external_athlete_id",
        "sync_error": "sync_error_message",
        "sync_total": "sync_total_events",
    },
}


MIGRATION_ORDER = [
    # 1. Users (from auth.users) — handled by migrate_auth_users()
    # 2. Independent / root tables
    "coach",
    "squads",
    "coach_squads",
    # 3. Swimmers
    "swimmers",
    "swimmer_external_links",
    # 4. Workout results
    "workout_result",
    "race_splits",
    # 5. Training
    "training_schedules",
    "training_sessions",
    "training_attendance",
    "training_session_pre_practice_notes",
    "training_session_post_practice_notes",
    # 6. Workouts
    "workout_template",
    "workout_tags",
    "workout_template_tags",
    "workout_session_feedback",
    # 7. Calendar
    "calendar_event",
    # 8. Social
    "coach_connections",
    "squad_invitations",
    # 9. Standards
    "time_standards_sets",
    "time_standards",
    "swimmer_standards_tracking",
    # 10. Admin / misc
    "beta_waitlist",
    "bulk_sync_jobs",
    "bulk_sync_failures",
    "profiles",
]


# ---------------------------------------------------------------------------
# SQL for views and functions to recreate
# ---------------------------------------------------------------------------

SWIMMER_BEST_TIMES_VIEW = """
CREATE OR REPLACE VIEW swimmer_best_times AS
SELECT DISTINCT ON (wr.swimmer_id, wr.stroke, wr.distance)
    wr.id,
    wr.swimmer_id,
    wr.stroke,
    wr.distance,
    wr.time_result,
    wr.meet_name,
    wr.meet_city,
    wr.meet_nation,
    wr.meet_points,
    wr.performed_on,
    wr.source,
    wr.reaction_time,
    wr.has_splits_available,
    wr.swimrankings_result_id
FROM workout_result wr
WHERE wr.time_result IS NOT NULL
ORDER BY wr.swimmer_id, wr.stroke, wr.distance, wr.time_result ASC;
"""

UPDATE_TIMESTAMP_FUNCTION = """
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

# Tables that have an updated_at column and need the trigger
UPDATED_AT_TABLES = [
    "users", "coach", "swimmer_external_links",
    "training_session_pre_practice_notes",
    "training_session_post_practice_notes", "workout_template",
    "workout_tags", "workout_session_feedback", "coach_connections",
    "time_standards_sets", "time_standards", "swimmer_standards_tracking",
    "bulk_sync_jobs",
]


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def log(msg: str):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")


async def get_row_count(conn: asyncpg.Connection, table: str, schema: str = "public") -> int:
    return await conn.fetchval(f'SELECT count(*) FROM "{schema}"."{table}"')


async def get_column_names(conn: asyncpg.Connection, table: str, schema: str = "public") -> list[str]:
    rows = await conn.fetch(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position
        """,
        schema, table
    )
    return [r["column_name"] for r in rows]


async def get_column_types(conn: asyncpg.Connection, table: str, schema: str = "public") -> dict[str, str]:
    """Get a mapping of column_name → data_type for the given table."""
    rows = await conn.fetch(
        """
        SELECT column_name, data_type FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        """,
        schema, table
    )
    return {r["column_name"]: r["data_type"] for r in rows}


import json
from datetime import timedelta as td

def coerce_value(value, target_type: str):
    """Coerce a source value to match the target column's data type."""
    if value is None:
        return None
    if target_type == "boolean" and not isinstance(value, bool):
        if isinstance(value, str):
            return value.lower() in ("true", "t", "1", "yes")
        return bool(value)
    if target_type in ("integer", "smallint", "bigint") and not isinstance(value, int):
        try:
            return int(value)
        except (ValueError, TypeError):
            return None
    if target_type in ("double precision", "real", "numeric") and not isinstance(value, (int, float)):
        try:
            return float(value)
        except (ValueError, TypeError):
            return None
    if target_type == "jsonb":
        # asyncpg expects jsonb as JSON strings, not dicts/lists
        if isinstance(value, (dict, list)):
            return json.dumps(value)
        if isinstance(value, str):
            return value
        return json.dumps(value)
    # Convert non-string types to string when target expects text
    if target_type in ("text", "character varying", "character"):
        if isinstance(value, td):
            total = value.total_seconds()
            hours, remainder = divmod(total, 3600)
            minutes, seconds = divmod(remainder, 60)
            return f"{int(hours):02d}:{int(minutes):02d}:{seconds:06.3f}"
        if not isinstance(value, str):
            return str(value)
    # Convert string to interval when target expects interval
    if target_type == "interval" and isinstance(value, str):
        return value  # asyncpg handles interval strings natively
    return value


# ---------------------------------------------------------------------------
# Migration steps
# ---------------------------------------------------------------------------

async def migrate_auth_users(source: asyncpg.Connection, target: asyncpg.Connection):
    """Copy auth.users → public.users in the target database."""
    log("Migrating auth.users → users ...")

    # Check if auth.users exists (it will in Supabase)
    exists = await source.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users')"
    )
    if not exists:
        log("  auth.users not found — skipping (not a Supabase source?)")
        return 0

    rows = await source.fetch("""
        SELECT
            id,
            email,
            encrypted_password,
            email_confirmed_at IS NOT NULL AS email_confirmed,
            raw_user_meta_data->>'full_name' AS full_name,
            created_at,
            updated_at
        FROM auth.users
        ORDER BY created_at
    """)

    if not rows:
        log("  No users found in auth.users")
        return 0

    # Clear existing users (idempotent re-run)
    await target.execute("DELETE FROM users")

    count = 0
    for row in rows:
        await target.execute(
            """
            INSERT INTO users (id, email, password_hash, full_name, email_confirmed, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO NOTHING
            """,
            row["id"],
            row["email"],
            row["encrypted_password"] or "!migrated-no-password",
            row["full_name"],
            row["email_confirmed"],
            row["created_at"],
            row["updated_at"] or row["created_at"],
        )
        count += 1

    log(f"  Migrated {count} users")
    return count


async def migrate_table(
    source: asyncpg.Connection,
    target: asyncpg.Connection,
    table: str,
):
    """Copy all rows from source.public.<table> → target.public.<table>."""
    log(f"Migrating {table} ...")

    # Check table exists in source
    exists = await source.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)",
        table,
    )
    if not exists:
        log(f"  Table {table} not found in source — skipping")
        return 0

    source_count = await get_row_count(source, table)
    if source_count == 0:
        log(f"  {table}: 0 rows — skipping")
        return 0

    # Get column rename mapping for this table (source_col → target_col)
    renames = COLUMN_RENAMES.get(table, {})
    # Build reverse mapping (target_col → source_col) for lookup
    reverse_renames = {v: k for k, v in renames.items()}

    # Get column names from source and target
    source_cols = await get_column_names(source, table)
    target_cols = await get_column_names(target, table)

    # Build list of (source_col, target_col) pairs for columns we can migrate.
    # A target column matches if:
    #   1. It exists directly in source (same name), OR
    #   2. It has a rename mapping from a source column
    col_pairs: list[tuple[str, str]] = []
    for tc in target_cols:
        if tc in source_cols:
            col_pairs.append((tc, tc))
        elif tc in reverse_renames and reverse_renames[tc] in source_cols:
            col_pairs.append((reverse_renames[tc], tc))

    if not col_pairs:
        log(f"  {table}: no matching columns — skipping")
        return 0

    source_col_list = [p[0] for p in col_pairs]
    target_col_list = [p[1] for p in col_pairs]

    source_cols_quoted = ", ".join(f'"{c}"' for c in source_col_list)
    target_cols_quoted = ", ".join(f'"{c}"' for c in target_col_list)
    placeholders = ", ".join(f"${i+1}" for i in range(len(col_pairs)))

    # Log any renames being applied
    applied_renames = [(sc, tc) for sc, tc in col_pairs if sc != tc]
    if applied_renames:
        for sc, tc in applied_renames:
            log(f"  Column rename: {sc} → {tc}")

    # Get target column types for value coercion
    target_types = await get_column_types(target, table)

    # Fetch all rows from source
    rows = await source.fetch(f'SELECT {source_cols_quoted} FROM "{table}" ORDER BY 1')

    # Clear target table and insert (idempotent)
    await target.execute(f'DELETE FROM "{table}"')

    # Batch insert for performance
    batch_size = 500
    count = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        for row in batch:
            values = [
                coerce_value(row[sc], target_types.get(tc, ""))
                for sc, tc in col_pairs
            ]
            await target.execute(
                f'INSERT INTO "{table}" ({target_cols_quoted}) VALUES ({placeholders}) ON CONFLICT DO NOTHING',
                *values,
            )
            count += 1

    log(f"  {table}: {count}/{source_count} rows migrated")
    return count


async def create_views_and_functions(target: asyncpg.Connection):
    """Recreate views and trigger functions in the target database."""
    log("Creating views and functions ...")

    # Create the updated_at trigger function
    await target.execute(UPDATE_TIMESTAMP_FUNCTION)
    log("  Created update_updated_at_column() function")

    # Create triggers for each table with updated_at
    for table in UPDATED_AT_TABLES:
        trigger_name = f"trg_{table}_updated_at"
        await target.execute(f'DROP TRIGGER IF EXISTS "{trigger_name}" ON "{table}"')
        await target.execute(f"""
            CREATE TRIGGER "{trigger_name}"
            BEFORE UPDATE ON "{table}"
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column()
        """)
    log(f"  Created updated_at triggers for {len(UPDATED_AT_TABLES)} tables")

    # Create the best times view
    await target.execute("DROP VIEW IF EXISTS swimmer_best_times")
    await target.execute(SWIMMER_BEST_TIMES_VIEW)
    log("  Created swimmer_best_times view")


async def verify_migration(source: asyncpg.Connection, target: asyncpg.Connection):
    """Compare row counts between source and target."""
    log("\nVerification — comparing row counts:")
    all_ok = True

    for table in MIGRATION_ORDER:
        source_exists = await source.fetchval(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)",
            table,
        )
        if not source_exists:
            continue

        source_count = await get_row_count(source, table)
        target_count = await get_row_count(target, table)
        status = "OK" if source_count == target_count else "MISMATCH"
        if status == "MISMATCH":
            all_ok = False
        log(f"  {table:45s}  source={source_count:>6}  target={target_count:>6}  [{status}]")

    # Check users separately
    auth_exists = await source.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users')"
    )
    if auth_exists:
        source_users = await source.fetchval("SELECT count(*) FROM auth.users")
        target_users = await get_row_count(target, "users")
        status = "OK" if source_users == target_users else "MISMATCH"
        if status == "MISMATCH":
            all_ok = False
        log(f"  {'auth.users → users':45s}  source={source_users:>6}  target={target_users:>6}  [{status}]")

    return all_ok


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def main(source_url: str, target_url: str):
    log("Connecting to source (Supabase) ...")
    source = await asyncpg.connect(source_url)

    log("Connecting to target (local PostgreSQL) ...")
    target = await asyncpg.connect(target_url, ssl=False)

    try:
        # Step 0: Create schema in target using SQLAlchemy models
        log("\nStep 0: Creating schema in target database ...")
        # We use raw SQL from the models — but first let's use Alembic/SQLAlchemy
        # Actually, for the migration script we'll just use CREATE TABLE IF NOT EXISTS
        # via SQLAlchemy's create_all. We do this outside asyncpg.
        from sqlalchemy.ext.asyncio import create_async_engine
        from app.infrastructure.db import Base
        from app.infrastructure import models  # noqa: F401

        # Drop views first (they block table drops due to dependencies)
        await target.execute("DROP VIEW IF EXISTS swimmer_best_times CASCADE")
        log("  Dropped swimmer_best_times view (will recreate later)")

        async_target_url = target_url.replace("postgresql://", "postgresql+asyncpg://")
        temp_engine = create_async_engine(async_target_url)
        async with temp_engine.begin() as conn:
            # Drop and recreate all tables to ensure schema matches models
            # (create_all won't add new columns to existing tables)
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
        await temp_engine.dispose()
        log("  Schema created successfully (dropped and recreated all tables)")

        # Temporarily drop NOT NULL constraints so source data with NULLs can be imported
        log("  Relaxing NOT NULL constraints for migration ...")
        nn_cols = await target.fetch("""
            SELECT table_name, column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND is_nullable = 'NO'
              AND column_name != 'id'
              AND table_name != 'alembic_version'
        """)
        for row in nn_cols:
            await target.execute(
                f'ALTER TABLE "{row["table_name"]}" ALTER COLUMN "{row["column_name"]}" DROP NOT NULL'
            )
        log(f"  Relaxed {len(nn_cols)} NOT NULL constraints")

        # Disable triggers and FK constraints during migration
        await target.execute("SET session_replication_role = 'replica'")
        log("  Disabled triggers and FK constraints for migration")

        # Step 1: Migrate auth.users → users
        log("\nStep 1: Migrating users ...")
        await migrate_auth_users(source, target)

        # Step 2: Migrate all public tables in order
        log("\nStep 2: Migrating public tables ...")
        for table in MIGRATION_ORDER:
            await migrate_table(source, target, table)

        # Re-enable triggers and FK constraints
        await target.execute("SET session_replication_role = 'origin'")
        log("\n  Re-enabled triggers and FK constraints")

        # Restore NOT NULL constraints (best-effort — skip if data has NULLs)
        log("  Restoring NOT NULL constraints ...")
        restored = 0
        skipped = 0
        for row in nn_cols:
            has_nulls = await target.fetchval(
                f'SELECT EXISTS (SELECT 1 FROM "{row["table_name"]}" WHERE "{row["column_name"]}" IS NULL)'
            )
            if not has_nulls:
                await target.execute(
                    f'ALTER TABLE "{row["table_name"]}" ALTER COLUMN "{row["column_name"]}" SET NOT NULL'
                )
                restored += 1
            else:
                log(f"    Skipped NOT NULL on {row['table_name']}.{row['column_name']} (has NULL values)")
                skipped += 1
        log(f"  Restored {restored} NOT NULL constraints, skipped {skipped} (have NULLs in source data)")

        # Step 3: Create views and functions
        log("\nStep 3: Creating views and functions ...")
        await create_views_and_functions(target)

        # Step 4: Verify
        log("\nStep 4: Verification ...")
        all_ok = await verify_migration(source, target)

        if all_ok:
            log("\nMigration completed successfully! All row counts match.")
        else:
            log("\nMigration completed with MISMATCHES — review the counts above.")

    finally:
        await source.close()
        await target.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate data from Supabase to local PostgreSQL")
    parser.add_argument(
        "--source",
        default=os.getenv("SUPABASE_DB_URL"),
        help="Supabase direct PostgreSQL connection string",
    )
    parser.add_argument(
        "--target",
        default=os.getenv("TARGET_DB_URL", "postgresql://aquilus:aquilus@localhost:5432/aquilus"),
        help="Target PostgreSQL connection string",
    )

    args = parser.parse_args()

    if not args.source:
        print("ERROR: Provide --source or set SUPABASE_DB_URL environment variable.")
        print("  Get your connection string from Supabase Dashboard → Settings → Database → Connection string")
        print("  Example: postgresql://postgres.rusrkwvbypbgluaalxcq:<password>@aws-0-us-east-1.pooler.supabase.com:6543/postgres")
        sys.exit(1)

    asyncio.run(main(args.source, args.target))
