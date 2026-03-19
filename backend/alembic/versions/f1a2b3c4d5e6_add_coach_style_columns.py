"""add coach style columns and workout_template index

Revision ID: f1a2b3c4d5e6
Revises: c080fc5d3fbf
Create Date: 2026-03-19 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic
revision = 'f1a2b3c4d5e6'
down_revision = ('c080fc5d3fbf', 'e1f2a3b4c5d6')
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add style_profile JSONB column to coach table
    op.add_column(
        'coach',
        sa.Column('style_profile', JSONB(), nullable=True),
    )
    # Add coaching_style_notes Text column to coach table
    op.add_column(
        'coach',
        sa.Column('coaching_style_notes', sa.Text(), nullable=True),
    )
    # Add index on workout_template.create_by_coach for coach-scoped lookups
    op.create_index(
        'ix_workout_template_create_by_coach',
        'workout_template',
        ['create_by_coach'],
    )


def downgrade() -> None:
    op.drop_index('ix_workout_template_create_by_coach', table_name='workout_template')
    op.drop_column('coach', 'coaching_style_notes')
    op.drop_column('coach', 'style_profile')
