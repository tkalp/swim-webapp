"""add_structured_practice_notes_columns

Revision ID: c3d4e5f6a7b8
Revises: b901f271efb6
Create Date: 2026-03-15 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b901f271efb6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Pre-practice notes: add structured text fields
    op.add_column('training_session_pre_practice_notes', sa.Column('announcements', sa.Text(), nullable=True))
    op.add_column('training_session_pre_practice_notes', sa.Column('reminders', sa.Text(), nullable=True))
    op.add_column('training_session_pre_practice_notes', sa.Column('focus', sa.Text(), nullable=True))
    op.add_column('training_session_pre_practice_notes', sa.Column('equipment_needed', sa.Text(), nullable=True))

    # Post-practice notes: add rating integers and structured text fields
    op.add_column('training_session_post_practice_notes', sa.Column('overall_rating', sa.Integer(), nullable=True))
    op.add_column('training_session_post_practice_notes', sa.Column('effort_level', sa.Integer(), nullable=True))
    op.add_column('training_session_post_practice_notes', sa.Column('technique_quality', sa.Integer(), nullable=True))
    op.add_column('training_session_post_practice_notes', sa.Column('positivity', sa.Integer(), nullable=True))
    op.add_column('training_session_post_practice_notes', sa.Column('what_went_well', sa.Text(), nullable=True))
    op.add_column('training_session_post_practice_notes', sa.Column('areas_for_improvement', sa.Text(), nullable=True))
    op.add_column('training_session_post_practice_notes', sa.Column('next_session_focus', sa.Text(), nullable=True))
    op.add_column('training_session_post_practice_notes', sa.Column('individual_highlights', sa.Text(), nullable=True))


def downgrade() -> None:
    # Drop post-practice structured columns
    op.drop_column('training_session_post_practice_notes', 'individual_highlights')
    op.drop_column('training_session_post_practice_notes', 'next_session_focus')
    op.drop_column('training_session_post_practice_notes', 'areas_for_improvement')
    op.drop_column('training_session_post_practice_notes', 'what_went_well')
    op.drop_column('training_session_post_practice_notes', 'positivity')
    op.drop_column('training_session_post_practice_notes', 'technique_quality')
    op.drop_column('training_session_post_practice_notes', 'effort_level')
    op.drop_column('training_session_post_practice_notes', 'overall_rating')

    # Drop pre-practice structured columns
    op.drop_column('training_session_pre_practice_notes', 'equipment_needed')
    op.drop_column('training_session_pre_practice_notes', 'focus')
    op.drop_column('training_session_pre_practice_notes', 'reminders')
    op.drop_column('training_session_pre_practice_notes', 'announcements')
