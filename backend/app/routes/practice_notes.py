"""Practice notes API routes — replaces frontend direct Supabase calls."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db import get_db
from app.infrastructure.models import (
    TrainingSession,
    TrainingSessionPrePracticeNote,
    TrainingSessionPostPracticeNote,
)
from app.middleware.auth import get_current_user_id
from app.middleware.authorization import get_coach_membership
from app.domain.exceptions import UnauthorizedError

router = APIRouter(prefix="/practice-notes", tags=["practice-notes"])


class NoteCreate(BaseModel):
    training_session_id: str
    notes: str


class NoteUpdate(BaseModel):
    notes: str


def _row_to_dict(row) -> dict:
    d = {}
    for col in row.__table__.columns:
        val = getattr(row, col.name)
        if hasattr(val, 'hex'):
            val = str(val)
        d[col.name] = val
    return d


async def _get_session_squad_id(db: AsyncSession, session_id: str) -> str:
    """Look up the squad_id for a training session. Raises 404 if not found."""
    result = await db.execute(
        select(TrainingSession).where(TrainingSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Training session not found")
    return str(session.squad_id)


# ── Pre-Practice Notes ─────────────────────────────────────

@router.get("/pre/{session_id}")
async def get_pre_notes(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    squad_id = await _get_session_squad_id(db, session_id)
    await get_coach_membership(db, user_id, squad_id)

    result = await db.execute(
        select(TrainingSessionPrePracticeNote)
        .where(TrainingSessionPrePracticeNote.training_session_id == session_id)
    )
    notes = result.scalars().all()
    return [_row_to_dict(n) for n in notes]


@router.post("/pre")
async def create_pre_note(
    body: NoteCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    squad_id = await _get_session_squad_id(db, body.training_session_id)
    membership = await get_coach_membership(db, user_id, squad_id)
    if not membership.can_manage_notes:
        raise UnauthorizedError("Missing permission: can_manage_notes")

    instance = TrainingSessionPrePracticeNote(
        training_session_id=body.training_session_id,
        coach_id=user_id,
        notes=body.notes,
    )
    db.add(instance)
    await db.commit()
    await db.refresh(instance)
    return _row_to_dict(instance)


@router.put("/pre/{note_id}")
async def update_pre_note(
    note_id: str,
    body: NoteUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TrainingSessionPrePracticeNote)
        .where(TrainingSessionPrePracticeNote.id == note_id)
    )
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=404, detail="Note not found")

    squad_id = await _get_session_squad_id(db, str(instance.training_session_id))
    membership = await get_coach_membership(db, user_id, squad_id)
    if not membership.can_manage_notes:
        raise UnauthorizedError("Missing permission: can_manage_notes")

    instance.notes = body.notes
    await db.commit()
    await db.refresh(instance)
    return _row_to_dict(instance)


# ── Post-Practice Notes ────────────────────────────────────

@router.get("/post/{session_id}")
async def get_post_notes(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    squad_id = await _get_session_squad_id(db, session_id)
    await get_coach_membership(db, user_id, squad_id)

    result = await db.execute(
        select(TrainingSessionPostPracticeNote)
        .where(TrainingSessionPostPracticeNote.training_session_id == session_id)
    )
    notes = result.scalars().all()
    return [_row_to_dict(n) for n in notes]


@router.post("/post")
async def create_post_note(
    body: NoteCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    squad_id = await _get_session_squad_id(db, body.training_session_id)
    membership = await get_coach_membership(db, user_id, squad_id)
    if not membership.can_manage_notes:
        raise UnauthorizedError("Missing permission: can_manage_notes")

    instance = TrainingSessionPostPracticeNote(
        training_session_id=body.training_session_id,
        coach_id=user_id,
        notes=body.notes,
    )
    db.add(instance)
    await db.commit()
    await db.refresh(instance)
    return _row_to_dict(instance)


@router.put("/post/{note_id}")
async def update_post_note(
    note_id: str,
    body: NoteUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TrainingSessionPostPracticeNote)
        .where(TrainingSessionPostPracticeNote.id == note_id)
    )
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=404, detail="Note not found")

    squad_id = await _get_session_squad_id(db, str(instance.training_session_id))
    membership = await get_coach_membership(db, user_id, squad_id)
    if not membership.can_manage_notes:
        raise UnauthorizedError("Missing permission: can_manage_notes")

    instance.notes = body.notes
    await db.commit()
    await db.refresh(instance)
    return _row_to_dict(instance)
