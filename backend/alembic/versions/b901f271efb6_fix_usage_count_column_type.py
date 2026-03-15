"""fix_usage_count_column_type

Revision ID: b901f271efb6
Revises: 69629acff54d
Create Date: 2026-03-15 08:37:06.627313
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b901f271efb6'
down_revision: Union[str, None] = '69629acff54d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        'workout_template', 'usage_count',
        type_=sa.Integer(),
        postgresql_using='0',
        server_default='0',
        nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        'workout_template', 'usage_count',
        type_=sa.DateTime(timezone=True),
        server_default=None,
        nullable=True,
    )
