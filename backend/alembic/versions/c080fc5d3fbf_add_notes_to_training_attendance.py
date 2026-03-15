"""add_notes_to_training_attendance

Revision ID: c080fc5d3fbf
Revises: c3d4e5f6a7b8
Create Date: 2026-03-15 08:52:22.753106
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c080fc5d3fbf'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "training_attendance",
        sa.Column("notes", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("training_attendance", "notes")
