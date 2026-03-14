"""
Authorization middleware for squad-scoped operations.

Provides dependency factories that verify:
1. The user has a Coach profile
2. The coach is a member of the target squad
3. The coach has the required permissions
"""

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends
from app.infrastructure.models import Coach, CoachSquad
from app.domain.exceptions import UnauthorizedError
from app.infrastructure.db import get_db
from app.middleware.auth import get_current_user_id


async def get_coach_membership(
    db: AsyncSession, user_id: str, squad_id: str
) -> CoachSquad:
    """Look up a user's squad membership.

    Chain: user_id -> coach.id -> coach_squads membership.

    Raises UnauthorizedError if user has no coach profile or is not a squad member.
    """
    # Step 1: Look up Coach by user_id
    coach_result = await db.execute(
        select(Coach).where(Coach.user_id == user_id)
    )
    coach = coach_result.scalar_one_or_none()
    if not coach:
        raise UnauthorizedError("No coach profile found")

    # Step 2: Look up CoachSquad membership
    membership_result = await db.execute(
        select(CoachSquad).where(
            and_(
                CoachSquad.coach_id == coach.id,
                CoachSquad.squad_id == squad_id,
            )
        )
    )
    membership = membership_result.scalar_one_or_none()
    if not membership:
        raise UnauthorizedError("Not a member of this squad")

    return membership


def require_squad_permission(*permissions: str):
    """Dependency factory: verifies user has ALL specified permissions for a squad.

    Usage in route:
        membership = require_squad_permission("can_manage_swimmers")
    """
    async def _check(
        squad_id: str,
        user_id: str = Depends(get_current_user_id),
        db: AsyncSession = Depends(get_db),
    ) -> CoachSquad:
        membership = await get_coach_membership(db, user_id, squad_id)
        for perm in permissions:
            if not getattr(membership, perm, False):
                raise UnauthorizedError(f"Missing permission: {perm}")
        return membership
    return Depends(_check)


def require_squad_member():
    """Dependency: verifies user is a member of the squad (any role/permission)."""
    async def _check(
        squad_id: str,
        user_id: str = Depends(get_current_user_id),
        db: AsyncSession = Depends(get_db),
    ) -> CoachSquad:
        return await get_coach_membership(db, user_id, squad_id)
    return Depends(_check)


def require_owner():
    """Dependency: verifies user is the owner of the squad."""
    async def _check(
        squad_id: str,
        user_id: str = Depends(get_current_user_id),
        db: AsyncSession = Depends(get_db),
    ) -> CoachSquad:
        membership = await get_coach_membership(db, user_id, squad_id)
        if membership.role != "owner":
            raise UnauthorizedError("Only the squad owner can perform this action")
        return membership
    return Depends(_check)
