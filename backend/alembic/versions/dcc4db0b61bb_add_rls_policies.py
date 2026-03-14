"""add_rls_policies

Revision ID: dcc4db0b61bb
Revises: 7b0fb1244803
Create Date: 2026-03-14 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'dcc4db0b61bb'
down_revision: Union[str, None] = '7b0fb1244803'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# ──────────────────────────────────────────────
# Common subquery
# ──────────────────────────────────────────────
_SQUAD_SUB = """
    SELECT cs.squad_id FROM coach_squads cs
    JOIN coach c ON c.id = cs.coach_id
    WHERE c.user_id = current_setting('app.current_user_id', true)::uuid
"""

_DIRECT_USING = f"""
    current_setting('app.current_user_id', true) IS NULL
    OR squad_id IN ({_SQUAD_SUB})
"""


def upgrade() -> None:
    # ── 1. swimmers ──
    op.execute("ALTER TABLE swimmers ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE swimmers FORCE ROW LEVEL SECURITY")
    op.execute(f"""
        CREATE POLICY swimmers_access ON swimmers FOR ALL
        USING ({_DIRECT_USING})
        WITH CHECK ({_DIRECT_USING})
    """)

    # ── 2. training_sessions ──
    op.execute("ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE training_sessions FORCE ROW LEVEL SECURITY")
    op.execute(f"""
        CREATE POLICY training_sessions_access ON training_sessions FOR ALL
        USING ({_DIRECT_USING})
        WITH CHECK ({_DIRECT_USING})
    """)

    # ── 3. training_schedules ──
    op.execute("ALTER TABLE training_schedules ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE training_schedules FORCE ROW LEVEL SECURITY")
    op.execute(f"""
        CREATE POLICY training_schedules_access ON training_schedules FOR ALL
        USING ({_DIRECT_USING})
        WITH CHECK ({_DIRECT_USING})
    """)

    # ── 4. calendar_event ──
    op.execute("ALTER TABLE calendar_event ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE calendar_event FORCE ROW LEVEL SECURITY")
    op.execute(f"""
        CREATE POLICY calendar_event_access ON calendar_event FOR ALL
        USING ({_DIRECT_USING})
        WITH CHECK ({_DIRECT_USING})
    """)

    # ── 5. training_attendance ──
    op.execute("ALTER TABLE training_attendance ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE training_attendance FORCE ROW LEVEL SECURITY")
    op.execute(f"""
        CREATE POLICY training_attendance_access ON training_attendance FOR ALL
        USING (
            current_setting('app.current_user_id', true) IS NULL
            OR training_session_id IN (
                SELECT ts.id FROM training_sessions ts
                WHERE ts.squad_id IN ({_SQUAD_SUB})
            )
        )
        WITH CHECK (
            current_setting('app.current_user_id', true) IS NULL
            OR training_session_id IN (
                SELECT ts.id FROM training_sessions ts
                WHERE ts.squad_id IN ({_SQUAD_SUB})
            )
        )
    """)

    # ── 6. workout_result ──
    op.execute("ALTER TABLE workout_result ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE workout_result FORCE ROW LEVEL SECURITY")
    op.execute(f"""
        CREATE POLICY workout_result_access ON workout_result FOR ALL
        USING (
            current_setting('app.current_user_id', true) IS NULL
            OR swimmer_id IN (
                SELECT s.id FROM swimmers s
                WHERE s.squad_id IN ({_SQUAD_SUB})
            )
        )
        WITH CHECK (
            current_setting('app.current_user_id', true) IS NULL
            OR swimmer_id IN (
                SELECT s.id FROM swimmers s
                WHERE s.squad_id IN ({_SQUAD_SUB})
            )
        )
    """)

    # ── 7. workout_template ──
    op.execute("ALTER TABLE workout_template ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE workout_template FORCE ROW LEVEL SECURITY")

    op.execute("CREATE POLICY workout_template_select ON workout_template FOR SELECT USING (true)")

    op.execute("""
        CREATE POLICY workout_template_modify ON workout_template FOR UPDATE
        USING (
            current_setting('app.current_user_id', true) IS NULL
            OR create_by_coach IN (
                SELECT c.id FROM coach c
                WHERE c.user_id = current_setting('app.current_user_id', true)::uuid
            )
        )
    """)

    op.execute("""
        CREATE POLICY workout_template_delete ON workout_template FOR DELETE
        USING (
            current_setting('app.current_user_id', true) IS NULL
            OR create_by_coach IN (
                SELECT c.id FROM coach c
                WHERE c.user_id = current_setting('app.current_user_id', true)::uuid
            )
        )
    """)

    op.execute("CREATE POLICY workout_template_insert ON workout_template FOR INSERT WITH CHECK (true)")


def downgrade() -> None:
    # Drop policies
    for policy, table in [
        ("swimmers_access", "swimmers"),
        ("training_sessions_access", "training_sessions"),
        ("training_schedules_access", "training_schedules"),
        ("calendar_event_access", "calendar_event"),
        ("training_attendance_access", "training_attendance"),
        ("workout_result_access", "workout_result"),
        ("workout_template_select", "workout_template"),
        ("workout_template_modify", "workout_template"),
        ("workout_template_delete", "workout_template"),
        ("workout_template_insert", "workout_template"),
    ]:
        op.execute(f"DROP POLICY IF EXISTS {policy} ON {table}")

    # Disable RLS
    for table in [
        "swimmers", "training_sessions", "training_schedules",
        "calendar_event", "training_attendance", "workout_result",
        "workout_template",
    ]:
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
