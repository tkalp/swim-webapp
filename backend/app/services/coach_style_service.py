"""Service for managing coach style profiles and workout history."""

import uuid
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.models import Coach, WorkoutTemplate
from app.utils import logger


async def get_coach_by_user_id(db: AsyncSession, user_id: str) -> Optional[Coach]:
    """Look up a Coach row by the owning user's ID."""
    result = await db.execute(
        select(Coach).where(Coach.user_id == uuid.UUID(user_id))
    )
    return result.scalar_one_or_none()


async def get_style(db: AsyncSession, coach_id: str) -> dict:
    """Return the coach's style profile, notes, and workout count.

    Returns:
        {style_profile: dict|None, coaching_style_notes: str|None, workout_count: int}
    """
    cid = uuid.UUID(coach_id)

    # Fetch coach record
    result = await db.execute(
        select(Coach.style_profile, Coach.coaching_style_notes)
        .where(Coach.id == cid)
    )
    row = result.one_or_none()

    style_profile = None
    coaching_style_notes = None
    if row:
        style_profile = row.style_profile
        coaching_style_notes = row.coaching_style_notes

    # Count workouts created by this coach
    count_result = await db.execute(
        select(func.count()).select_from(WorkoutTemplate)
        .where(WorkoutTemplate.create_by_coach == cid)
    )
    workout_count = count_result.scalar_one()

    return {
        "style_profile": style_profile,
        "coaching_style_notes": coaching_style_notes,
        "workout_count": workout_count,
    }


async def update_style_notes(db: AsyncSession, coach_id: str, notes: str) -> str:
    """Update the coach's free-text coaching style notes. Returns the saved notes."""
    cid = uuid.UUID(coach_id)
    result = await db.execute(
        select(Coach).where(Coach.id == cid)
    )
    coach = result.scalar_one()
    coach.coaching_style_notes = notes
    await db.commit()
    return notes


async def get_coach_recent_workouts(
    db: AsyncSession, coach_id: str, limit: int = 20
) -> list[dict]:
    """Return the coach's most recent workouts (name + raw_description)."""
    cid = uuid.UUID(coach_id)
    result = await db.execute(
        select(WorkoutTemplate.name, WorkoutTemplate.raw_description)
        .where(WorkoutTemplate.create_by_coach == cid)
        .order_by(WorkoutTemplate.created_at.desc())
        .limit(limit)
    )
    return [
        {"name": row.name, "raw_description": row.raw_description}
        for row in result.all()
    ]


async def get_coach_example_workouts(
    db: AsyncSession, coach_id: str, limit: int = 3
) -> list[dict]:
    """Return a small sample of recent workouts (convenience wrapper)."""
    return await get_coach_recent_workouts(db, coach_id, limit=limit)


async def save_style_profile(db: AsyncSession, coach_id: str, profile: dict) -> None:
    """Persist a computed style profile (JSONB) on the coach record."""
    cid = uuid.UUID(coach_id)
    result = await db.execute(
        select(Coach).where(Coach.id == cid)
    )
    coach = result.scalar_one()
    coach.style_profile = profile
    await db.commit()


def dispatch_style_recomputation(coach_id: str) -> None:
    """Fire-and-forget: enqueue a Celery task to recompute the coach's style profile.

    Never raises — logs a warning on failure so the caller is not disrupted.
    """
    try:
        from app.celery_app import celery_app
        celery_app.send_task(
            "worker.style_tasks.recompute_coach_style_task",
            kwargs={"coach_id": str(coach_id)},
        )
        logger.info("Dispatched style recomputation for coach %s", coach_id)
    except Exception:
        logger.warning(
            "Failed to dispatch style recomputation for coach %s",
            coach_id,
            exc_info=True,
        )
