"""Shared RLS policy SQL statements used by both Alembic migrations and test setup."""

# Common subquery: get squad_ids the current user has access to
# NOTE: must use current_setting(..., true) everywhere to avoid errors when the
# variable is not set (worker/background bypass scenario).
_SQUAD_SUBQUERY = """
    SELECT cs.squad_id FROM coach_squads cs
    JOIN coach c ON c.id = cs.coach_id
    WHERE c.user_id = current_setting('app.current_user_id', true)::uuid
"""

# Common USING clause for direct squad_id tables
_DIRECT_SQUAD_USING = f"""
    current_setting('app.current_user_id', true) IS NULL
    OR squad_id IN ({_SQUAD_SUBQUERY})
"""


def _direct_squad_policy(table: str, policy_name: str) -> str:
    """Generate RLS policy SQL for a table with a direct squad_id column."""
    return f"""
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
ALTER TABLE {table} FORCE ROW LEVEL SECURITY;
CREATE POLICY {policy_name} ON {table}
FOR ALL
USING ({_DIRECT_SQUAD_USING})
WITH CHECK ({_DIRECT_SQUAD_USING});
"""


ENABLE_RLS_SQL = (
    # 1. swimmers — direct squad_id
    _direct_squad_policy("swimmers", "swimmers_access")
    + "\n"
    # 2. training_sessions — direct squad_id
    + _direct_squad_policy("training_sessions", "training_sessions_access")
    + "\n"
    # 3. training_schedules — direct squad_id
    + _direct_squad_policy("training_schedules", "training_schedules_access")
    + "\n"
    # 4. calendar_event — direct squad_id
    + _direct_squad_policy("calendar_event", "calendar_event_access")
    + "\n"
    # 5. training_attendance — through training_sessions.squad_id
    + """
ALTER TABLE training_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_attendance FORCE ROW LEVEL SECURITY;
CREATE POLICY training_attendance_access ON training_attendance
FOR ALL
USING (
    current_setting('app.current_user_id', true) IS NULL
    OR training_session_id IN (
        SELECT ts.id FROM training_sessions ts
        WHERE ts.squad_id IN (
            SELECT cs.squad_id FROM coach_squads cs
            JOIN coach c ON c.id = cs.coach_id
            WHERE c.user_id = current_setting('app.current_user_id', true)::uuid
        )
    )
)
WITH CHECK (
    current_setting('app.current_user_id', true) IS NULL
    OR training_session_id IN (
        SELECT ts.id FROM training_sessions ts
        WHERE ts.squad_id IN (
            SELECT cs.squad_id FROM coach_squads cs
            JOIN coach c ON c.id = cs.coach_id
            WHERE c.user_id = current_setting('app.current_user_id', true)::uuid
        )
    )
);
"""
    + "\n"
    # 6. workout_result — through swimmers.squad_id
    + """
ALTER TABLE workout_result ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_result FORCE ROW LEVEL SECURITY;
CREATE POLICY workout_result_access ON workout_result
FOR ALL
USING (
    current_setting('app.current_user_id', true) IS NULL
    OR swimmer_id IN (
        SELECT s.id FROM swimmers s
        WHERE s.squad_id IN (
            SELECT cs.squad_id FROM coach_squads cs
            JOIN coach c ON c.id = cs.coach_id
            WHERE c.user_id = current_setting('app.current_user_id', true)::uuid
        )
    )
)
WITH CHECK (
    current_setting('app.current_user_id', true) IS NULL
    OR swimmer_id IN (
        SELECT s.id FROM swimmers s
        WHERE s.squad_id IN (
            SELECT cs.squad_id FROM coach_squads cs
            JOIN coach c ON c.id = cs.coach_id
            WHERE c.user_id = current_setting('app.current_user_id', true)::uuid
        )
    )
);
"""
    + "\n"
    # 7. workout_template — SELECT: allow all. UPDATE/DELETE: owner only
    + """
ALTER TABLE workout_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_template FORCE ROW LEVEL SECURITY;

CREATE POLICY workout_template_select ON workout_template
FOR SELECT USING (true);

CREATE POLICY workout_template_modify ON workout_template
FOR UPDATE
USING (
    current_setting('app.current_user_id', true) IS NULL
    OR create_by_coach IN (
        SELECT c.id FROM coach c
        WHERE c.user_id = current_setting('app.current_user_id', true)::uuid
    )
);

CREATE POLICY workout_template_delete ON workout_template
FOR DELETE
USING (
    current_setting('app.current_user_id', true) IS NULL
    OR create_by_coach IN (
        SELECT c.id FROM coach c
        WHERE c.user_id = current_setting('app.current_user_id', true)::uuid
    )
);

CREATE POLICY workout_template_insert ON workout_template
FOR INSERT
WITH CHECK (true);
"""
)

DISABLE_RLS_SQL = """
-- Drop policies
DROP POLICY IF EXISTS swimmers_access ON swimmers;
DROP POLICY IF EXISTS training_sessions_access ON training_sessions;
DROP POLICY IF EXISTS training_schedules_access ON training_schedules;
DROP POLICY IF EXISTS calendar_event_access ON calendar_event;
DROP POLICY IF EXISTS training_attendance_access ON training_attendance;
DROP POLICY IF EXISTS workout_result_access ON workout_result;
DROP POLICY IF EXISTS workout_template_select ON workout_template;
DROP POLICY IF EXISTS workout_template_modify ON workout_template;
DROP POLICY IF EXISTS workout_template_delete ON workout_template;
DROP POLICY IF EXISTS workout_template_insert ON workout_template;

-- Disable RLS
ALTER TABLE swimmers DISABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE training_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_event DISABLE ROW LEVEL SECURITY;
ALTER TABLE training_attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE workout_result DISABLE ROW LEVEL SECURITY;
ALTER TABLE workout_template DISABLE ROW LEVEL SECURITY;
"""
