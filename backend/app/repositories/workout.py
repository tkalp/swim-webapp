"""Workout result repository for managing swim performance data."""
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.base import BaseRepository
from app.infrastructure.models import WorkoutResult, RaceSplit
from app.domain.exceptions import DatabaseError


class WorkoutResultRepository(BaseRepository):
    """Repository for workout result operations."""

    def __init__(self, db: AsyncSession):
        super().__init__(WorkoutResult, db)

    async def find_by_swimmer_id(
        self, swimmer_id: str, limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Find workout results for a swimmer."""
        return await self.find_all(
            filters={"swimmer_id": swimmer_id},
            order_by="performed_on.desc",
            limit=limit,
        )

    async def find_best_times(
        self,
        swimmer_id: str,
        interval: Optional[str] = None,
        stroke: Optional[str] = None,
        distance: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """Find best times for a swimmer with optional filters."""
        try:
            query = (
                select(WorkoutResult)
                .where(WorkoutResult.swimmer_id == swimmer_id)
                .where(WorkoutResult.time_result.isnot(None))
            )

            if interval:
                cutoff = self._get_interval_cutoff(interval)
                if cutoff:
                    query = query.where(WorkoutResult.performed_on >= cutoff.date())

            if stroke:
                query = query.where(WorkoutResult.stroke == stroke)
            if distance:
                query = query.where(WorkoutResult.distance == distance)

            query = query.order_by(WorkoutResult.performed_on.desc())

            result = await self.db.execute(query)
            return [self._to_dict(row) for row in result.scalars().all()]
        except Exception as e:
            raise DatabaseError(f"Failed to fetch best times for swimmer {swimmer_id}") from e

    def _get_interval_cutoff(self, interval: str) -> Optional[datetime]:
        now = datetime.now()
        intervals = {
            "week": 7, "month": 30, "3months": 90,
            "6months": 180, "year": 365,
        }
        days = intervals.get(interval)
        return now - timedelta(days=days) if days else None

    async def find_by_external_result_id(self, external_result_id: str) -> Optional[Dict[str, Any]]:
        """Find workout result by swimrankings_result_id."""
        try:
            result = await self.db.execute(
                select(WorkoutResult)
                .where(WorkoutResult.swimrankings_result_id == external_result_id)
            )
            row = result.scalar_one_or_none()
            return self._to_dict(row) if row else None
        except Exception as e:
            raise DatabaseError(f"Failed to find result by external ID: {external_result_id}") from e

    async def bulk_insert(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Insert multiple workout results."""
        try:
            instances = [WorkoutResult(**r) for r in results]
            self.db.add_all(instances)
            await self.db.flush()
            return [self._to_dict(i) for i in instances]
        except Exception as e:
            raise DatabaseError(f"Failed to bulk insert {len(results)} workout results") from e


class RaceSplitRepository(BaseRepository):
    """Repository for race split operations."""

    def __init__(self, db: AsyncSession):
        super().__init__(RaceSplit, db)

    async def find_by_result_id(self, result_id: str) -> List[Dict[str, Any]]:
        """Find race splits for a workout result."""
        try:
            result = await self.db.execute(
                select(RaceSplit)
                .where(RaceSplit.workout_result_id == result_id)
                .order_by(RaceSplit.split_distance)
            )
            return [self._to_dict(row) for row in result.scalars().all()]
        except Exception as e:
            raise DatabaseError(f"Failed to fetch splits for result {result_id}") from e

    async def bulk_insert(self, splits: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Insert multiple race splits."""
        try:
            instances = [RaceSplit(**s) for s in splits]
            self.db.add_all(instances)
            await self.db.flush()
            return [self._to_dict(i) for i in instances]
        except Exception as e:
            raise DatabaseError(f"Failed to bulk insert {len(splits)} race splits") from e
