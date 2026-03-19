"""AI Coach Conversation endpoints -- multi-turn workout generation with history."""

from typing import Optional

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db import get_db
from app.middleware.auth import get_current_user_id
from app.services.coach_style_service import get_coach_by_user_id
from app.services.conversation_service import (
    add_message,
    create_conversation,
    delete_conversation,
    get_conversation_with_messages,
    list_conversations,
    update_conversation_title,
)
from app.utils import logger, log_error


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class CreateConversationRequest(BaseModel):
    title: Optional[str] = None


class SendMessageRequest(BaseModel):
    content: str
    metadata: Optional[dict] = None


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(
    prefix="/ai-coach/conversations",
    tags=["AI Coach Conversations"],
)


async def _resolve_coach_id(
    db: AsyncSession, user_id: str
) -> str:
    """Resolve the coach UUID from the authenticated user. Raises 404 if missing."""
    from fastapi import HTTPException

    coach = await get_coach_by_user_id(db, user_id)
    if not coach:
        raise HTTPException(status_code=404, detail="Coach profile not found")
    return str(coach.id)


@router.get("")
async def list_conversations_endpoint(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Return the authenticated coach's conversations ordered by most recently updated."""
    coach_id = await _resolve_coach_id(db, user_id)
    return await list_conversations(db, coach_id)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_conversation_endpoint(
    body: CreateConversationRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Create a new AI Coach conversation."""
    coach_id = await _resolve_coach_id(db, user_id)
    return await create_conversation(db, coach_id, title=body.title)


@router.get("/{conversation_id}")
async def get_conversation_endpoint(
    conversation_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Load a conversation with all its messages."""
    coach_id = await _resolve_coach_id(db, user_id)
    return await get_conversation_with_messages(db, coach_id, conversation_id)


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation_endpoint(
    conversation_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Delete a conversation and all its messages."""
    coach_id = await _resolve_coach_id(db, user_id)
    await delete_conversation(db, coach_id, conversation_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{conversation_id}/messages")
async def send_message_endpoint(
    conversation_id: str,
    body: SendMessageRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Send a coach message, generate an AI response, and return both.

    Steps:
    1. Save the coach's message.
    2. Load full conversation history.
    3. Call the conversation-aware workout generator.
    4. Save the AI response.
    5. Auto-title the conversation if it has no title yet.
    """
    from app.services.ai_coach.workout_generator import generate_workout_with_history

    coach_id = await _resolve_coach_id(db, user_id)

    # 1. Save coach message
    coach_message = await add_message(
        db, conversation_id, "coach", body.content, body.metadata
    )

    # 2. Load full conversation with messages
    conversation = await get_conversation_with_messages(db, coach_id, conversation_id)
    messages = [
        {"role": msg["role"], "content": msg["content"]}
        for msg in conversation["messages"]
    ]

    # 3. Generate AI response
    logger.info(
        "Generating AI response for conversation %s (turns=%d)",
        conversation_id,
        len(messages),
    )
    try:
        ai_text = await generate_workout_with_history(messages, coach_id, db)
    except Exception as e:
        logger.error("AI generation failed for conversation %s", conversation_id)
        log_error(e, context="send_message", conversation_id=conversation_id)
        raise

    # 4. Save assistant message
    assistant_message = await add_message(
        db, conversation_id, "assistant", ai_text
    )

    # 5. Auto-title if conversation has no title
    if conversation["title"] is None:
        auto_title = body.content[:50]
        await update_conversation_title(db, conversation_id, auto_title)

    return {
        "coach_message": coach_message,
        "assistant_message": assistant_message,
    }
