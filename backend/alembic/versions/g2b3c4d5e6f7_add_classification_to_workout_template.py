"""add classification to workout_template

Revision ID: g2b3c4d5e6f7
Revises: f1a2b3c4d5e6
Create Date: 2026-03-20 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic
revision = 'g2b3c4d5e6f7'
down_revision = 'a2b3c4d5e6f7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'workout_template',
        sa.Column('classification', sa.String(50), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('workout_template', 'classification')
