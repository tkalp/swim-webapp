from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field
from uuid import UUID

from app.infrastructure.database import get_supabase_client
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


# ============ Endpoints ============
@router.post("/", response_model=RatingResponse)
async def create_rating(
    request: CreateRatingRequest,
    coach_id: str = Depends(get_current_user_id)
):
    """Create rating for workout after training session."""
    try:
        supabase = get_supabase_client()
        
        # Verify session belongs to coach's squad
        session = supabase.table('training_sessions')\
            .select('id, squad_id, squads!inner(coach_id)')\
            .eq('id', str(request.training_session_id))\
            .execute()
        
        if not session.data:
            raise HTTPException(404, "Training session not found")
        
        if session.data[0]['squads']['coach_id'] != coach_id:
            raise HTTPException(403, "Not authorized to rate this session")
        
        # Create rating
        result = supabase.table('workout_session_feedback').insert({
            'training_session_id': str(request.training_session_id),
            'workout_id': str(request.workout_id),
            'coach_id': coach_id,
            'rating': request.rating,
            'notes': request.notes
        }).execute()
        
        logger.info(f"Coach {coach_id} rated workout {request.workout_id}: {request.rating}★")
        return RatingResponse(**result.data[0])
        
    except Exception as e:
        if 'duplicate key' in str(e).lower():
            raise HTTPException(409, "Already rated this session")
        logger.error(f"Error creating rating: {str(e)}")
        raise HTTPException(500, str(e))


@router.put("/{rating_id}", response_model=RatingResponse)
async def update_rating(
    rating_id: UUID,
    request: UpdateRatingRequest,
    coach_id: str = Depends(get_current_user_id)
):
    """Update existing rating."""
    try:
        supabase = get_supabase_client()
        
        result = supabase.table('workout_session_feedback')\
            .update({
                'rating': request.rating,
                'notes': request.notes,
                'updated_at': datetime.utcnow().isoformat()
            })\
            .eq('id', str(rating_id))\
            .eq('coach_id', coach_id)\
            .execute()
        
        if not result.data:
            raise HTTPException(404, "Rating not found")
        
        return RatingResponse(**result.data[0])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating rating: {str(e)}")
        raise HTTPException(500, str(e))


@router.delete("/{rating_id}", status_code=204)
async def delete_rating(
    rating_id: UUID,
    coach_id: str = Depends(get_current_user_id)
):
    """Delete rating."""
    try:
        supabase = get_supabase_client()
        
        result = supabase.table('workout_session_feedback')\
            .delete()\
            .eq('id', str(rating_id))\
            .eq('coach_id', coach_id)\
            .execute()
        
        if not result.data:
            raise HTTPException(404, "Rating not found")
        
        return None
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting rating: {str(e)}")
        raise HTTPException(500, str(e))


@router.get("/workout/{workout_id}", response_model=WorkoutRatingStatsResponse)
async def get_workout_ratings(
    workout_id: UUID,
    coach_id: str = Depends(get_current_user_id)
):
    """Get ratings and stats for a workout."""
    try:
        supabase = get_supabase_client()
        
        # Get workout stats
        workout = supabase.table('workout_template')\
            .select('id, effectiveness_rating, rating_count, times_used')\
            .eq('id', str(workout_id))\
            .single()\
            .execute()
        
        if not workout.data:
            raise HTTPException(404, "Workout not found")
        
        # Get recent ratings
        ratings = supabase.table('workout_session_feedback')\
            .select('*')\
            .eq('workout_id', str(workout_id))\
            .order('created_at', desc=True)\
            .limit(10)\
            .execute()
        
        return WorkoutRatingStatsResponse(
            workout_id=workout_id,
            effectiveness_rating=workout.data.get('effectiveness_rating'),
            rating_count=workout.data.get('rating_count', 0),
            times_used=workout.data.get('times_used', 0),
            recent_ratings=[RatingResponse(**r) for r in ratings.data]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching workout ratings: {str(e)}")
        raise HTTPException(500, str(e))


@router.get("/session/{session_id}", response_model=Optional[RatingResponse])
async def get_session_rating(
    session_id: UUID,
    coach_id: str = Depends(get_current_user_id)
):
    """Get coach's rating for a specific session."""
    try:
        supabase = get_supabase_client()
        
        result = supabase.table('workout_session_feedback')\
            .select('*')\
            .eq('training_session_id', str(session_id))\
            .eq('coach_id', coach_id)\
            .execute()
        
        if not result.data:
            return None
        
        return RatingResponse(**result.data[0])
    except Exception as e:
        logger.error(f"Error fetching session rating: {str(e)}")
        raise HTTPException(500, str(e))