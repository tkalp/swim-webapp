"""add ai_coach_conversations and ai_coach_messages tables

Revision ID: a2b3c4d5e6f7
Revises: f1a2b3c4d5e6
Create Date: 2026-03-19 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

# revision identifiers, used by Alembic
revision = 'a2b3c4d5e6f7'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create ai_coach_conversations table
    op.create_table(
        'ai_coach_conversations',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('coach_id', UUID(as_uuid=True), sa.ForeignKey('coach.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(200), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        'ix_ai_coach_conversations_coach_id',
        'ai_coach_conversations',
        ['coach_id'],
    )

    # Create ai_coach_messages table
    op.create_table(
        'ai_coach_messages',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('conversation_id', UUID(as_uuid=True), sa.ForeignKey('ai_coach_conversations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('metadata', JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        'ix_ai_coach_messages_conversation_id',
        'ai_coach_messages',
        ['conversation_id'],
    )


def downgrade() -> None:
    op.drop_index('ix_ai_coach_messages_conversation_id', table_name='ai_coach_messages')
    op.drop_table('ai_coach_messages')
    op.drop_index('ix_ai_coach_conversations_coach_id', table_name='ai_coach_conversations')
    op.drop_table('ai_coach_conversations')
