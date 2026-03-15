"""Swimmer repository for managing swimmer data and external links."""
from typing import Dict, List, Optional, Any
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.repositories.base import BaseRepository
from app.infrastructure.models import Swimmer, SwimmerExternalLink, CoachSquad
from app.infrastructure.constants import SyncStatus
from app.domain.exceptions import NotFoundError, DatabaseError


class SwimmerRepository(BaseRepository):
    """Repository for swimmer operations."""

    def __init__(self, db: AsyncSession):
        super().__init__(Swimmer, db)

    async def find_by_coach_id(self, coach_id: str) -> List[Dict[str, Any]]:
        """Find all swimmers for a coach via coach_squads."""
        try:
            result = await self.db.execute(
                select(Swimmer)
                .join(CoachSquad, CoachSquad.squad_id == Swimmer.squad_id)
                .where(CoachSquad.coach_id == coach_id)
                .order_by(Swimmer.first_name, Swimmer.last_name)
            )
            return [self._to_dict(row) for row in result.scalars().all()]
        except Exception as e:
            raise DatabaseError(f"Failed to fetch swimmers for coach {coach_id}") from e

    async def verify_coach_access(self, swimmer_id: str, coach_id: str) -> bool:
        """Verify coach has access to swimmer via squad membership."""
        try:
            result = await self.db.execute(
                select(func.count())
                .select_from(Swimmer)
                .join(CoachSquad, CoachSquad.squad_id == Swimmer.squad_id)
                .where(Swimmer.id == swimmer_id)
                .where(CoachSquad.coach_id == coach_id)
            )
            return result.scalar_one() > 0
        except Exception as e:
            raise DatabaseError(f"Failed to verify coach access to swimmer {swimmer_id}") from e

    async def find_with_external_links(self, swimmer_id: str) -> Optional[Dict[str, Any]]:
        """Find swimmer with external links."""
        try:
            result = await self.db.execute(
                select(Swimmer)
                .options(selectinload(Swimmer.external_links))
                .where(Swimmer.id == swimmer_id)
            )
            swimmer = result.scalar_one_or_none()
            if not swimmer:
                return None

            d = self._to_dict(swimmer)
            d["swimmer_external_links"] = [
                self._link_to_dict(link) for link in swimmer.external_links
            ]
            return d
        except Exception as e:
            raise DatabaseError(f"Failed to fetch swimmer {swimmer_id} with external links") from e

    async def create_with_external_link(
        self,
        swimmer_data: Dict[str, Any],
        external_link_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Create swimmer with external link."""
        try:
            swimmer = Swimmer(**swimmer_data)
            self.db.add(swimmer)
            await self.db.flush()

            external_link_data["swimmer_id"] = swimmer.id
            link = SwimmerExternalLink(**external_link_data)
            self.db.add(link)
            await self.db.flush()

            d = self._to_dict(swimmer)
            d["swimmer_external_links"] = [self._link_to_dict(link)]
            return d
        except Exception as e:
            raise DatabaseError("Failed to create swimmer with external link") from e

    def _link_to_dict(self, link: SwimmerExternalLink) -> Dict[str, Any]:
        d = {}
        for column in link.__table__.columns:
            value = getattr(link, column.name)
            if hasattr(value, 'hex'):
                value = str(value)
            d[column.name] = value
        return d


class SwimmerExternalLinkRepository(BaseRepository):
    """Repository for swimmer external link operations."""

    def __init__(self, db: AsyncSession):
        super().__init__(SwimmerExternalLink, db)

    async def find_by_swimmer_id(self, swimmer_id: str) -> Optional[Dict[str, Any]]:
        """Find external link by swimmer ID."""
        links = await self.find_all(filters={"swimmer_id": swimmer_id}, limit=1)
        return links[0] if links else None

    async def find_by_external_id(self, external_id: str) -> Optional[Dict[str, Any]]:
        """Find external link by external athlete ID."""
        links = await self.find_all(filters={"external_athlete_id": external_id}, limit=1)
        return links[0] if links else None

    async def update_sync_status(
        self,
        link_id: str,
        status: SyncStatus,
        progress: Optional[int] = None,
        total_events: Optional[int] = None,
        error_message: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Update synchronization status."""
        update_data: Dict[str, Any] = {"sync_status": status.value}

        if progress is not None:
            update_data["sync_progress"] = progress
        if total_events is not None:
            update_data["sync_total_events"] = total_events
        if error_message is not None:
            update_data["sync_error_message"] = error_message
        if status == SyncStatus.COMPLETED:
            update_data["sync_error_message"] = None

        return await self.update(link_id, update_data)

    async def cancel_sync(self, link_id: str) -> Dict[str, Any]:
        """Cancel an ongoing sync operation."""
        return await self.update_sync_status(
            link_id, SyncStatus.CANCELLED, error_message="Sync cancelled by user"
        )
