"""
Routes for coach management and role verification
"""
from fastapi import APIRouter, HTTPException, Security, Depends
from fastapi.security import HTTPAuthorizationCredentials

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.infrastructure.db import get_db
from app.infrastructure.models import Coach
from app.middleware.auth import get_current_user
from app.utils import logger

router = APIRouter(prefix="/coaches", tags=["coaches"])


@router.get("/me")
async def get_current_coach(
    user: dict = Security(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get the current authenticated user's coach profile including role.
    Returns null role if user is not a coach.
    """
    try:
        user_id = user.get('sub')

        result = await db.execute(
            select(Coach).where(Coach.id == user_id)
        )
        coach = result.scalar_one_or_none()

        if not coach:
            # User exists but is not a coach
            logger.info(f"User {user_id} is not a coach")
            return {
                "id": user_id,
                "role": None,
                "is_coach": False
            }

        logger.info(f"Coach {coach.id} role: {coach.role}")

        return {
            "id": str(coach.id),
            "role": coach.role,
            "is_coach": True,
            "name": f"{coach.first_name or ''} {coach.last_name or ''}".strip() or None,
            "email": None,  # Email lives on the User model, not Coach
        }

    except Exception as e:
        logger.error(f"Error fetching coach profile: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch coach profile: {str(e)}"
        )
