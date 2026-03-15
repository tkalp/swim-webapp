from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field
from uuid import UUID

from sqlalchemy import select, delete, and_, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.infrastructure.db import get_db
from app.infrastructure.models import WorkoutSessionFeedback, TrainingSession, Squad, WorkoutTemplate
from app.middleware.auth import get_current_user_id
from app.utils import logger

router = APIRouter(prefix="/workout-ratings", tags=["workout-ratings"])


# ============ Models ============
class CreateRatingRequest(BaseModel):
    training_session_id: UUID
    workout_id: UUID
    rating: int = Field(..., ge=1, le=5)
    notes: Optional[str] = Field(None, max_length=1000)


class UpdateRatingRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    notes: Optional[str] = None


class RatingResponse(BaseModel):
    id: UUID
    training_session_id: UUID
    workout_id: UUID
    coach_id: UUID
    rating: int
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime


class WorkoutRatingStatsResponse(BaseModel):
    workout_id: UUID
    effectiveness_rating: Optional[float]
    rating_count: int
    times_used: int
    recent_ratings: List[RatingResponse]


async def _recalculate_workout_stats(db: AsyncSession, workout_id: str) -> None:
    """Recalculate and persist denormalized rating stats on the WorkoutTemplate row."""
    stats = await db.execute(
        select(
            func.avg(WorkoutSessionFeedback.rating).label('avg_rating'),
            func.count(WorkoutSessionFeedback.id).label('count')
        ).where(WorkoutSessionFeedback.workout_id == workout_id)
    )
    row = stats.one()
    await db.execute(
        update(WorkoutTemplate)
        .where(WorkoutTemplate.id == workout_id)
        .values(
            effectiveness_rating=float(row.avg_rating) if row.avg_rating else None,
            rating_count=row.count,
        )
    )


def _feedback_to_dict(fb: WorkoutSessionFeedback) -> dict:
    """Convert a WorkoutSessionFeedback ORM instance to a dict suitable for RatingResponse."""
    return {
        "id": fb.id,
        "training_session_id": fb.training_session_id,
        "workout_id": fb.workout_id,
        "coach_id": fb.coach_id,
        "rating": fb.rating,
        "notes": fb.notes,
        "created_at": fb.created_at,
        "updated_at": fb.updated_at,
    }


# ============ Endpoints ============
@router.post("", response_model=RatingResponse)
async def create_rating(
    request: CreateRatingRequest,
    coach_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create rating for workout after training session."""
    try:
        # Verify session belongs to coach's squad
        result = await db.execute(
            select(TrainingSession, Squad)
            .join(Squad, TrainingSession.squad_id == Squad.id)
            .where(TrainingSession.id == str(request.training_session_id))
        )
        row = result.first()

        if not row:
            raise HTTPException(404, "Training session not found")

        session_obj, squad_obj = row
        if str(squad_obj.coach_id) != coach_id:
            raise HTTPException(403, "Not authorized to rate this session")

        # Create rating
        feedback = WorkoutSessionFeedback(
            training_session_id=str(request.training_session_id),
            workout_id=str(request.workout_id),
            coach_id=coach_id,
            rating=request.rating,
            notes=request.notes,
        )
        db.add(feedback)
        await db.flush()

        # Recalculate denormalized stats on workout_template
        await _recalculate_workout_stats(db, str(request.workout_id))

        await db.commit()
        await db.refresh(feedback)

        logger.info(f"Coach {coach_id} rated workout {request.workout_id}: {request.rating}*")
        return RatingResponse(**_feedback_to_dict(feedback))

    except HTTPException:
        raise
    except Exception as e:
        if 'duplicate key' in str(e).lower():
            raise HTTPException(409, "Already rated this session")
        logger.error(f"Error creating rating: {str(e)}")
        raise HTTPException(500, str(e))


@router.put("/{rating_id}", response_model=RatingResponse)
async def update_rating(
    rating_id: UUID,
    request: UpdateRatingRequest,
    coach_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update existing rating."""
    try:
        result = await db.execute(
            select(WorkoutSessionFeedback).where(
                and_(
                    WorkoutSessionFeedback.id == str(rating_id),
                    WorkoutSessionFeedback.coach_id == coach_id,
                )
            )
        )
        feedback = result.scalar_one_or_none()

        if not feedback:
            raise HTTPException(404, "Rating not found")

        workout_id = feedback.workout_id
        feedback.rating = request.rating
        feedback.notes = request.notes

        # Recalculate denormalized stats on workout_template
        await _recalculate_workout_stats(db, str(workout_id))

        await db.commit()
        await db.refresh(feedback)

        return RatingResponse(**_feedback_to_dict(feedback))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating rating: {str(e)}")
        raise HTTPException(500, str(e))


@router.delete("/{rating_id}", status_code=204)
async def delete_rating(
    rating_id: UUID,
    coach_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete rating."""
    try:
        result = await db.execute(
            select(WorkoutSessionFeedback).where(
                and_(
                    WorkoutSessionFeedback.id == str(rating_id),
                    WorkoutSessionFeedback.coach_id == coach_id,
                )
            )
        )
        feedback = result.scalar_one_or_none()

        if not feedback:
            raise HTTPException(404, "Rating not found")

        workout_id = feedback.workout_id
        await db.delete(feedback)
        await db.flush()

        # Recalculate denormalized stats on workout_template
        await _recalculate_workout_stats(db, str(workout_id))

        await db.commit()
        return None
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting rating: {str(e)}")
        raise HTTPException(500, str(e))


@router.get("/workout/{workout_id}", response_model=WorkoutRatingStatsResponse)
async def get_workout_ratings(
    workout_id: UUID,
    coach_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get ratings and stats for a workout."""
    try:
        # Get workout stats
        result = await db.execute(
            select(WorkoutTemplate).where(WorkoutTemplate.id == str(workout_id))
        )
        workout = result.scalar_one_or_none()

        if not workout:
            raise HTTPException(404, "Workout not found")

        # Get recent ratings
        ratings_result = await db.execute(
            select(WorkoutSessionFeedback)
            .where(WorkoutSessionFeedback.workout_id == str(workout_id))
            .order_by(WorkoutSessionFeedback.created_at.desc())
            .limit(10)
        )
        ratings = ratings_result.scalars().all()

        return WorkoutRatingStatsResponse(
            workout_id=workout_id,
            effectiveness_rating=workout.effectiveness_rating,
            rating_count=workout.rating_count or 0,
            times_used=workout.times_used or 0,
            recent_ratings=[RatingResponse(**_feedback_to_dict(r)) for r in ratings],
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching workout ratings: {str(e)}")
        raise HTTPException(500, str(e))


@router.get("/session/{session_id}", response_model=Optional[RatingResponse])
async def get_session_rating(
    session_id: UUID,
    coach_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get coach's rating for a specific session."""
    try:
        result = await db.execute(
            select(WorkoutSessionFeedback).where(
                and_(
                    WorkoutSessionFeedback.training_session_id == str(session_id),
                    WorkoutSessionFeedback.coach_id == coach_id,
                )
            )
        )
        feedback = result.scalar_one_or_none()

        if not feedback:
            return None

        return RatingResponse(**_feedback_to_dict(feedback))
    except Exception as e:
        logger.error(f"Error fetching session rating: {str(e)}")
        raise HTTPException(500, str(e))
