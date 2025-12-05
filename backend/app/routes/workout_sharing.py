from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from pydantic import BaseModel
from uuid import UUID

from app.infrastructure.database import get_supabase_client
from app.middleware.auth import get_current_user_id
from app.utils import logger

router = APIRouter(prefix="/workout-sharing", tags=["workout-sharing"])


# ============ Models ============
class UpdateVisibilityRequest(BaseModel):
    visibility: str  # 'private', 'network', 'public'


class CloneWorkoutRequest(BaseModel):
    workout_id: UUID
    new_name: Optional[str] = None


class SharedWorkoutResponse(BaseModel):
    id: UUID
    name: str
    coach_name: str
    effectiveness_rating: Optional[float]
    rating_count: int
    clone_count: int
    times_used: int
    visibility: str


# ============ Endpoints ============
@router.put("/visibility/{workout_id}")
async def update_workout_visibility(
    workout_id: UUID,
    request: UpdateVisibilityRequest,
    coach_id: str = Depends(get_current_user_id)
):
    """Update visibility of a workout (owner only)."""
    try:
        if request.visibility not in ['private', 'network', 'public']:
            raise HTTPException(400, "Invalid visibility level")
        
        supabase = get_supabase_client()
        
        result = supabase.table('workout_template')\
            .update({'visibility': request.visibility})\
            .eq('id', str(workout_id))\
            .eq('create_by_coach', coach_id)\
            .execute()
        
        if not result.data:
            raise HTTPException(404, "Workout not found or unauthorized")
        
        logger.info(f"Coach {coach_id} set workout {workout_id} visibility to {request.visibility}")
        return {"message": "Visibility updated", "visibility": request.visibility}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating visibility: {str(e)}")
        raise HTTPException(500, str(e))


@router.post("/clone")
async def clone_workout(
    request: CloneWorkoutRequest,
    coach_id: str = Depends(get_current_user_id)
):
    """Clone a public/shared workout to your library."""
    try:
        supabase = get_supabase_client()
        
        # Get original workout (RLS ensures we can only see accessible workouts)
        original = supabase.table('workout_template')\
            .select('*')\
            .eq('id', str(request.workout_id))\
            .single()\
            .execute()
        
        if not original.data:
            raise HTTPException(404, "Workout not found or not accessible")
        
        # Can't clone your own workout
        if original.data['create_by_coach'] == coach_id:
            raise HTTPException(400, "Cannot clone your own workout")
        
        # Create clone
        workout_data = original.data.copy()
        del workout_data['id']
        workout_data['create_by_coach'] = coach_id
        workout_data['name'] = request.new_name or f"{workout_data['name']} (Copy)"
        workout_data['visibility'] = 'private'  # Clones are private by default
        workout_data['cloned_from_id'] = str(request.workout_id)
        workout_data['original_creator_id'] = original.data['create_by_coach']
        workout_data['effectiveness_rating'] = None
        workout_data['rating_count'] = 0
        workout_data['times_used'] = 0
        workout_data['clone_count'] = 0
        
        cloned = supabase.table('workout_template').insert(workout_data).execute()
        
        # Increment clone count on original
        supabase.table('workout_template')\
            .update({'clone_count': (original.data.get('clone_count', 0) + 1)})\
            .eq('id', str(request.workout_id))\
            .execute()
        
        logger.info(f"Coach {coach_id} cloned workout {request.workout_id}")
        return cloned.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cloning workout: {str(e)}")
        raise HTTPException(500, str(e))


@router.get("/discover", response_model=List[SharedWorkoutResponse])
async def discover_workouts(
    visibility: Optional[str] = 'public',
    sort_by: Optional[str] = 'rating',
    limit: int = 20,
    coach_id: str = Depends(get_current_user_id)
):
    """Discover public/network workouts from other coaches."""
    try:
        supabase = get_supabase_client()
        
        # Build query - specify the foreign key relationship explicitly
        query = supabase.table('workout_template')\
            .select('id, name, create_by_coach, coach!workout_template_create_by_coach_fkey(first_name, last_name), effectiveness_rating, rating_count, clone_count, times_used, visibility')\
            .neq('create_by_coach', coach_id)  # Exclude own workouts
        
        if visibility:
            query = query.eq('visibility', visibility)
        
        # Sort
        if sort_by == 'rating':
            query = query.order('effectiveness_rating', desc=True)
        elif sort_by == 'popular':
            query = query.order('clone_count', desc=True)
        elif sort_by == 'recent':
            query = query.order('created_at', desc=True)
        
        query = query.limit(limit)
        
        result = query.execute()
        
        # Format response
        workouts = []
        for w in result.data:
            coach = w.get('coach', {})
            workouts.append(SharedWorkoutResponse(
                id=w['id'],
                name=w['name'],
                coach_name=f"{coach.get('first_name', '')} {coach.get('last_name', '')}".strip() or "Unknown Coach",
                effectiveness_rating=w.get('effectiveness_rating'),
                rating_count=w.get('rating_count', 0),
                clone_count=w.get('clone_count', 0),
                times_used=w.get('times_used', 0),
                visibility=w.get('visibility', 'private')
            ))
        
        return workouts
        
    except Exception as e:
        logger.error(f"Error discovering workouts: {str(e)}")
        raise HTTPException(500, str(e))