"""
Routes for coach management and role verification
"""
from fastapi import APIRouter, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials
from app.middleware.auth import get_current_user
from app.infrastructure.database import get_supabase_client
from app.utils import logger

router = APIRouter(prefix="/coaches", tags=["coaches"])

@router.get("/me")
async def get_current_coach(
    user: dict = Security(get_current_user)
):
    """
    Get the current authenticated user's coach profile including role.
    Returns null role if user is not a coach.
    """
    try:
        user_id = user.get('sub')
        supabase = get_supabase_client()
        
        # Query coach table for this user (coach.id = auth.uid)
        response = supabase.table('coach').select('*').eq('id', user_id).execute()
        
        if not response.data or len(response.data) == 0:
            # User exists but is not a coach
            logger.info(f"User {user_id} is not a coach")
            return {
                "id": user_id,
                "role": None,
                "is_coach": False
            }
        
        coach = response.data[0]
        logger.info(f"Coach {coach.get('id')} role: {coach.get('role')}")
        
        return {
            "id": coach.get('id'),
            "role": coach.get('role'),
            "is_coach": True,
            "name": coach.get('name'),
            "email": coach.get('email')
        }
        
    except Exception as e:
        logger.error(f"Error fetching coach profile: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch coach profile: {str(e)}"
        )
