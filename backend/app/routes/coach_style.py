"""Coach Style endpoints -- get/update style profile and notes, trigger recomputation."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db import get_db
from app.middleware.auth import get_current_user_id
from app.services.coach_style_service import (
    dispatch_style_recomputation,
    get_coach_by_user_id,
    get_style,
    update_style_notes,
)
from app.utils import logger


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class StyleResponse(BaseModel):
    style_profile: Optional[dict] = None
    coaching_style_notes: Optional[str] = None
    workout_count: int = 0


class StyleNotesRequest(BaseModel):
    coaching_style_notes: str = Field(max_length=2000)


class StyleNotesResponse(BaseModel):
    coaching_style_notes: str


class RecomputeResponse(BaseModel):
    status: str


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/coaches/me/style", tags=["Coach Style"])


@router.get("", response_model=StyleResponse)
async def get_coach_style(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> StyleResponse:
    """Return the authenticated coach's style profile, notes, and workout count."""
    coach = await get_coach_by_user_id(db, user_id)
    if not coach:
        raise HTTPException(status_code=404, detail="Coach profile not found")

    data = await get_style(db, str(coach.id))
    return StyleResponse(**data)


@router.put("/notes", response_model=StyleNotesResponse)
async def update_coach_style_notes(
    body: StyleNotesRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> StyleNotesResponse:
    """Update the authenticated coach's free-text coaching style notes."""
    coach = await get_coach_by_user_id(db, user_id)
    if not coach:
        raise HTTPException(status_code=404, detail="Coach profile not found")

    saved = await update_style_notes(db, str(coach.id), body.coaching_style_notes)
    logger.info("Updated coaching style notes for coach %s", coach.id)
    return StyleNotesResponse(coaching_style_notes=saved)


@router.post("/recompute", response_model=RecomputeResponse)
async def recompute_coach_style(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> RecomputeResponse:
    """Enqueue a background task to recompute the coach's style profile."""
    coach = await get_coach_by_user_id(db, user_id)
    if not coach:
        raise HTTPException(status_code=404, detail="Coach profile not found")

    dispatch_style_recomputation(str(coach.id))
    return RecomputeResponse(status="queued")
