"""Service for managing AI Coach conversations and messages."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.exceptions import NotFoundError
from app.infrastructure.models import AICoachConversation, AICoachMessage
from app.utils import logger


async def list_conversations(
    db: AsyncSession, coach_id: str, limit: int = 20
) -> list[dict]:
    """Return the coach's conversations ordered by most recently updated.

    Returns:
        [{id, title, created_at, updated_at, message_count}]
    """
    cid = uuid.UUID(coach_id)

    # Subquery for message count per conversation
    msg_count = (
        select(
            AICoachMessage.conversation_id,
            func.count().label("message_count"),
        )
        .group_by(AICoachMessage.conversation_id)
        .subquery()
    )

    stmt = (
        select(
            AICoachConversation.id,
            AICoachConversation.title,
            AICoachConversation.created_at,
            AICoachConversation.updated_at,
            func.coalesce(msg_count.c.message_count, 0).label("message_count"),
        )
        .outerjoin(msg_count, AICoachConversation.id == msg_count.c.conversation_id)
        .where(AICoachConversation.coach_id == cid)
        .order_by(AICoachConversation.updated_at.desc())
        .limit(limit)
    )

    result = await db.execute(stmt)
    return [
        {
            "id": str(row.id),
            "title": row.title,
            "created_at": row.created_at.isoformat(),
            "updated_at": row.updated_at.isoformat(),
            "message_count": row.message_count,
        }
        for row in result.all()
    ]


async def create_conversation(
    db: AsyncSession, coach_id: str, title: str | None = None
) -> dict:
    """Create a new conversation for the coach.

    Returns:
        {id, title, created_at}
    """
    cid = uuid.UUID(coach_id)

    conversation = AICoachConversation(coach_id=cid, title=title)
    db.add(conversation)
    await db.commit()
    await db.refresh(conversation)

    logger.info("Created conversation %s for coach %s", conversation.id, coach_id)

    return {
        "id": str(conversation.id),
        "title": conversation.title,
        "created_at": conversation.created_at.isoformat(),
    }


async def get_conversation_with_messages(
    db: AsyncSession, coach_id: str, conversation_id: str
) -> dict:
    """Load a conversation with all its messages, verifying ownership.

    Raises:
        NotFoundError: If conversation does not exist or is not owned by coach.

    Returns:
        {id, title, created_at, updated_at, messages: [{id, role, content, metadata, created_at}]}
    """
    cid = uuid.UUID(coach_id)
    conv_id = uuid.UUID(conversation_id)

    result = await db.execute(
        select(AICoachConversation)
        .options(selectinload(AICoachConversation.messages))
        .where(
            AICoachConversation.id == conv_id,
            AICoachConversation.coach_id == cid,
        )
    )
    conversation = result.scalar_one_or_none()

    if conversation is None:
        raise NotFoundError("Conversation not found")

    return {
        "id": str(conversation.id),
        "title": conversation.title,
        "created_at": conversation.created_at.isoformat(),
        "updated_at": conversation.updated_at.isoformat(),
        "messages": [
            {
                "id": str(msg.id),
                "conversation_id": str(msg.conversation_id),
                "role": msg.role,
                "content": msg.content,
                "metadata": msg.message_metadata,
                "created_at": msg.created_at.isoformat(),
            }
            for msg in conversation.messages
        ],
    }


async def delete_conversation(
    db: AsyncSession, coach_id: str, conversation_id: str
) -> None:
    """Delete a conversation (CASCADE removes messages). Verifies ownership.

    Raises:
        NotFoundError: If conversation does not exist or is not owned by coach.
    """
    cid = uuid.UUID(coach_id)
    conv_id = uuid.UUID(conversation_id)

    result = await db.execute(
        select(AICoachConversation).where(
            AICoachConversation.id == conv_id,
            AICoachConversation.coach_id == cid,
        )
    )
    conversation = result.scalar_one_or_none()

    if conversation is None:
        raise NotFoundError("Conversation not found")

    await db.delete(conversation)
    await db.commit()

    logger.info("Deleted conversation %s for coach %s", conversation_id, coach_id)


async def add_message(
    db: AsyncSession,
    conversation_id: str,
    role: str,
    content: str,
    metadata: dict | None = None,
) -> dict:
    """Append a message to a conversation and touch its updated_at.

    Returns:
        {id, role, content, metadata, created_at}
    """
    conv_id = uuid.UUID(conversation_id)

    message = AICoachMessage(
        conversation_id=conv_id,
        role=role,
        content=content,
        message_metadata=metadata,
    )
    db.add(message)

    # Touch the parent conversation's updated_at
    result = await db.execute(
        select(AICoachConversation).where(AICoachConversation.id == conv_id)
    )
    conversation = result.scalar_one_or_none()
    if conversation is not None:
        conversation.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(message)

    return {
        "id": str(message.id),
        "conversation_id": str(message.conversation_id),
        "role": message.role,
        "content": message.content,
        "metadata": message.message_metadata,
        "created_at": message.created_at.isoformat(),
    }


async def update_message_metadata(
    db: AsyncSession, conversation_id: str, message_id: str, metadata_update: dict
) -> dict:
    """Merge metadata_update into an existing message's metadata."""
    msg_id = uuid.UUID(message_id)
    conv_id = uuid.UUID(conversation_id)

    stmt = select(AICoachMessage).where(
        AICoachMessage.id == msg_id,
        AICoachMessage.conversation_id == conv_id,
    )
    result = await db.execute(stmt)
    message = result.scalar_one_or_none()
    if not message:
        raise NotFoundError(f"Message {message_id} not found")

    existing = message.message_metadata or {}
    existing.update(metadata_update)
    message.message_metadata = existing
    await db.commit()
    await db.refresh(message)

    return {
        "id": str(message.id),
        "message_metadata": message.message_metadata,
    }


async def update_conversation_title(
    db: AsyncSession, conversation_id: str, title: str
) -> None:
    """Update the title of a conversation."""
    conv_id = uuid.UUID(conversation_id)

    result = await db.execute(
        select(AICoachConversation).where(AICoachConversation.id == conv_id)
    )
    conversation = result.scalar_one_or_none()

    if conversation is None:
        raise NotFoundError("Conversation not found")

    conversation.title = title
    await db.commit()
