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


class PreNoteCreate(BaseModel):
    training_session_id: str
    notes: Optional[str] = None
    announcements: Optional[str] = None
    reminders: Optional[str] = None
    focus: Optional[str] = None
    equipment_needed: Optional[str] = None


class PreNoteUpdate(BaseModel):
    notes: Optional[str] = None
    announcements: Optional[str] = None
    reminders: Optional[str] = None
    focus: Optional[str] = None
    equipment_needed: Optional[str] = None


class PostNoteCreate(BaseModel):
    training_session_id: str
    notes: Optional[str] = None
    overall_rating: Optional[int] = None
    effort_level: Optional[int] = None
    technique_quality: Optional[int] = None
    positivity: Optional[int] = None
    what_went_well: Optional[str] = None
    areas_for_improvement: Optional[str] = None
    next_session_focus: Optional[str] = None
    individual_highlights: Optional[str] = None


class PostNoteUpdate(BaseModel):
    notes: Optional[str] = None
    overall_rating: Optional[int] = None
    effort_level: Optional[int] = None
    technique_quality: Optional[int] = None
    positivity: Optional[int] = None
    what_went_well: Optional[str] = None
    areas_for_improvement: Optional[str] = None
    next_session_focus: Optional[str] = None
    individual_highlights: Optional[str] = None


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
    """Get pre-practice notes for a training session."""
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
    body: PreNoteCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a pre-practice note. Requires can_manage_notes permission."""
    squad_id = await _get_session_squad_id(db, body.training_session_id)
    membership = await get_coach_membership(db, user_id, squad_id)
    if not membership.can_manage_notes:
        raise UnauthorizedError("Missing permission: can_manage_notes")

    instance = TrainingSessionPrePracticeNote(
        training_session_id=body.training_session_id,
        coach_id=user_id,
        notes=body.notes,
        announcements=body.announcements,
        reminders=body.reminders,
        focus=body.focus,
        equipment_needed=body.equipment_needed,
    )
    db.add(instance)
    await db.commit()
    await db.refresh(instance)
    return _row_to_dict(instance)


@router.put("/pre/{note_id}")
async def update_pre_note(
    note_id: str,
    body: PreNoteUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update a pre-practice note. Requires can_manage_notes permission."""
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
    instance.announcements = body.announcements
    instance.reminders = body.reminders
    instance.focus = body.focus
    instance.equipment_needed = body.equipment_needed
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
    """Get post-practice notes for a training session."""
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
    body: PostNoteCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a post-practice note. Requires can_manage_notes permission."""
    squad_id = await _get_session_squad_id(db, body.training_session_id)
    membership = await get_coach_membership(db, user_id, squad_id)
    if not membership.can_manage_notes:
        raise UnauthorizedError("Missing permission: can_manage_notes")

    instance = TrainingSessionPostPracticeNote(
        training_session_id=body.training_session_id,
        coach_id=user_id,
        notes=body.notes,
        overall_rating=body.overall_rating,
        effort_level=body.effort_level,
        technique_quality=body.technique_quality,
        positivity=body.positivity,
        what_went_well=body.what_went_well,
        areas_for_improvement=body.areas_for_improvement,
        next_session_focus=body.next_session_focus,
        individual_highlights=body.individual_highlights,
    )
    db.add(instance)
    await db.commit()
    await db.refresh(instance)
    return _row_to_dict(instance)


@router.put("/post/{note_id}")
async def update_post_note(
    note_id: str,
    body: PostNoteUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update a post-practice note. Requires can_manage_notes permission."""
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
    instance.overall_rating = body.overall_rating
    instance.effort_level = body.effort_level
    instance.technique_quality = body.technique_quality
    instance.positivity = body.positivity
    instance.what_went_well = body.what_went_well
    instance.areas_for_improvement = body.areas_for_improvement
    instance.next_session_focus = body.next_session_focus
    instance.individual_highlights = body.individual_highlights
    await db.commit()
    await db.refresh(instance)
    return _row_to_dict(instance)
