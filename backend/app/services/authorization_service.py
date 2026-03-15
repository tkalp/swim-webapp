"""Authorization service for user access control."""
from typing import Dict, Optional, Any
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.swimmer import SwimmerRepository
from app.repositories.squad import SquadRepository
from app.domain.exceptions import UnauthorizedError


class AuthorizationService:
    """Service for authorization and access control."""

    def __init__(
        self,
        db: Optional[AsyncSession] = None,
        swimmer_repo: Optional[SwimmerRepository] = None,
        squad_repo: Optional[SquadRepository] = None
    ):
        self.swimmer_repo = swimmer_repo or (SwimmerRepository(db) if db else None)
        self.squad_repo = squad_repo or (SquadRepository(db) if db else None)

    def get_user_id_from_request(self, request: Request) -> str:
        user_id = getattr(request.state, "user_id", None)
        if not user_id:
            raise UnauthorizedError("User not authenticated")
        return user_id

    async def verify_swimmer_ownership(
        self,
        swimmer_id: str,
        coach_id: str
    ) -> Dict[str, Any]:
        if self.swimmer_repo is None:
            return {}
        
        has_access = await self.swimmer_repo.verify_coach_access(swimmer_id, coach_id)

        if not has_access:
            raise UnauthorizedError(
                f"Coach {coach_id} not authorized to access swimmer {swimmer_id}"
            )

        swimmer = await self.swimmer_repo.find_by_id(swimmer_id)
        if not swimmer:
            raise UnauthorizedError(f"Swimmer {swimmer_id} not found")

        return swimmer

    async def verify_squad_ownership(
        self,
        squad_id: str,
        coach_id: str
    ) -> Dict[str, Any]:
        if self.squad_repo is None:
            return {}

        squad = await self.squad_repo.find_by_id(squad_id)

        if not squad:
            raise UnauthorizedError(f"Squad {squad_id} not found")

        has_access = await self.squad_repo.verify_coach_access(squad_id, coach_id)

        if not has_access:
            raise UnauthorizedError(
                f"Coach {coach_id} not authorized to access squad {squad_id}"
            )

        return squad

    async def verify_squad_member_access(
        self,
        squad_id: str,
        swimmer_id: str,
        coach_id: str
    ) -> bool:
        await self.verify_squad_ownership(squad_id, coach_id)
        await self.verify_swimmer_ownership(swimmer_id, coach_id)
        return True


def get_current_user_id(request: Request) -> str:
    auth_service = AuthorizationService()
    return auth_service.get_user_id_from_request(request)
