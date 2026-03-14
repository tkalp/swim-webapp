"""add_permission_columns_to_coach_squads

Revision ID: 7b0fb1244803
Revises: 
Create Date: 2026-03-14 09:31:17.230429
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7b0fb1244803'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add 7 new permission columns with server_default='false'
    columns = [
        "can_manage_workouts",
        "can_manage_results",
        "can_manage_attendance",
        "can_manage_schedules",
        "can_manage_notes",
        "can_view_analytics",
        "can_manage_squad_settings",
    ]
    for col in columns:
        op.add_column(
            "coach_squads",
            sa.Column(col, sa.Boolean(), server_default="false", nullable=False),
        )

    # Backfill based on role:
    # owner -> all TRUE
    op.execute(
        """
        UPDATE coach_squads
        SET can_manage_workouts = true,
            can_manage_results = true,
            can_manage_attendance = true,
            can_manage_schedules = true,
            can_manage_notes = true,
            can_view_analytics = true,
            can_manage_squad_settings = true,
            can_manage_swimmers = true
        WHERE role = 'owner'
        """
    )

    # admin -> all TRUE except can_manage_squad_settings
    op.execute(
        """
        UPDATE coach_squads
        SET can_manage_workouts = true,
            can_manage_results = true,
            can_manage_attendance = true,
            can_manage_schedules = true,
            can_manage_notes = true,
            can_view_analytics = true,
            can_manage_squad_settings = false,
            can_manage_swimmers = true
        WHERE role = 'admin'
        """
    )

    # member/assistant/other -> can_view_analytics=TRUE, rest FALSE
    op.execute(
        """
        UPDATE coach_squads
        SET can_manage_workouts = false,
            can_manage_results = false,
            can_manage_attendance = false,
            can_manage_schedules = false,
            can_manage_notes = false,
            can_view_analytics = true,
            can_manage_squad_settings = false
        WHERE role NOT IN ('owner', 'admin')
        """
    )


def downgrade() -> None:
    columns = [
        "can_manage_workouts",
        "can_manage_results",
        "can_manage_attendance",
        "can_manage_schedules",
        "can_manage_notes",
        "can_view_analytics",
        "can_manage_squad_settings",
    ]
    for col in columns:
        op.drop_column("coach_squads", col)
