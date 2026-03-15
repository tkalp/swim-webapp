"""drop_beta_waitlist_table

Revision ID: 69629acff54d
Revises: a1b2c3d4e5f6
Create Date: 2026-03-15 07:50:16.342343
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '69629acff54d'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table('beta_waitlist')


def downgrade() -> None:
    # Recreate the table if rolling back (schema mirrors the original beta_waitlist)
    op.create_table(
        'beta_waitlist',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('approved', sa.Boolean(), server_default=sa.text('false'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
    )
