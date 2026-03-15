"""add_role_to_squad_invitations

Revision ID: a1b2c3d4e5f6
Revises: dcc4db0b61bb
Create Date: 2026-03-15 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'dcc4db0b61bb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "squad_invitations",
        sa.Column("role", sa.String(50), server_default="assistant", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("squad_invitations", "role")
