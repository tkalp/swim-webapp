"""Squad repository for managing training squads and memberships."""
from typing import Dict, List, Optional, Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.repositories.base import BaseRepository
from app.infrastructure.models import Squad, CoachSquad, Swimmer
from app.domain.exceptions import DatabaseError, NotFoundError


class SquadRepository(BaseRepository):
    """Repository for squad operations."""

    def __init__(self, db: AsyncSession):
        super().__init__(Squad, db)

    async def find_by_coach_id(self, coach_id: str) -> List[Dict[str, Any]]:
        """Find all squads a coach has access to via coach_squads."""
        try:
            result = await self.db.execute(
                select(Squad)
                .join(CoachSquad, CoachSquad.squad_id == Squad.id)
                .where(CoachSquad.coach_id == coach_id)
                .order_by(Squad.name)
            )
            return [self._to_dict(row) for row in result.scalars().all()]
        except Exception as e:
            raise DatabaseError(f"Failed to fetch squads for coach {coach_id}") from e

    async def find_with_swimmers(self, squad_id: str) -> Optional[Dict[str, Any]]:
        """Find squad with its swimmers."""
        try:
            result = await self.db.execute(
                select(Squad)
                .options(selectinload(Squad.swimmers))
                .where(Squad.id == squad_id)
            )
            squad = result.scalar_one_or_none()
            if not squad:
                return None

            d = self._to_dict(squad)
            d["swimmers"] = [
                self._model_to_dict(s) for s in squad.swimmers
            ]
            return d
        except Exception as e:
            raise DatabaseError(f"Failed to fetch squad {squad_id} with swimmers") from e

    async def verify_coach_access(self, squad_id: str, coach_id: str) -> bool:
        """Check if a coach has access to a squad via coach_squads."""
        try:
            result = await self.db.execute(
                select(CoachSquad.id)
                .where(CoachSquad.squad_id == squad_id)
                .where(CoachSquad.coach_id == coach_id)
            )
            return result.scalar_one_or_none() is not None
        except Exception:
            return False

    def _model_to_dict(self, instance: Any) -> Dict[str, Any]:
        """Convert any model instance to dict."""
        d = {}
        for column in instance.__table__.columns:
            value = getattr(instance, column.name)
            if hasattr(value, 'hex'):
                value = str(value)
            d[column.name] = value
        return d
