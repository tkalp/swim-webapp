"""
Database service for worker operations.
Handles all database interactions via synchronous SQLAlchemy sessions.
"""

import logging
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update, delete, func, and_, text
from sqlalchemy.orm import Session

from app.infrastructure.models import (
    WorkoutResult as WorkoutResultModel,
    SwimmerExternalLink,
)
from worker.models import (
    SyncStatusUpdate,
    WorkoutResult,
    SyncStatus,
)

logger = logging.getLogger("database_service")


class DatabaseService:
    """Service for database operations using synchronous SQLAlchemy."""

    def __init__(self, session: Session):
        self.session = session

    # ──────────────────────────────────────────────
    # Sync status helpers
    # ──────────────────────────────────────────────

    def update_sync_status(
        self,
        external_link_id: str,
        status_update: SyncStatusUpdate,
    ) -> None:
        """Update sync status in swimmer_external_links table."""
        values: dict = {}

        if status_update.sync_status:
            values["sync_status"] = status_update.sync_status
        if status_update.last_sync_started_at:
            values["last_sync_started_at"] = status_update.last_sync_started_at
        if status_update.last_sync_completed_at:
            values["last_sync_completed_at"] = status_update.last_sync_completed_at
        if status_update.sync_error is not None:
            values["sync_error_message"] = status_update.sync_error
        if status_update.sync_progress is not None:
            values["sync_progress"] = status_update.sync_progress
        if status_update.sync_total is not None:
            values["sync_total_events"] = status_update.sync_total
        if status_update.results_count is not None:
            values["results_count"] = status_update.results_count

        if values:
            stmt = (
                update(SwimmerExternalLink)
                .where(SwimmerExternalLink.id == external_link_id)
                .values(**values)
            )
            self.session.execute(stmt)
            self.session.commit()

    def check_sync_status(self, external_link_id: str) -> Optional[SyncStatus]:
        """Check current sync status for an external link."""
        stmt = (
            select(SwimmerExternalLink.sync_status)
            .where(SwimmerExternalLink.id == external_link_id)
        )
        row = self.session.execute(stmt).first()

        if not row:
            return None

        return row[0]

    def get_last_sync_time(self, external_link_id: str):
        """Get the last completed sync time for an external link.

        Returns None if never synced.
        """
        stmt = (
            select(SwimmerExternalLink.last_sync_completed_at)
            .where(SwimmerExternalLink.id == external_link_id)
        )
        row = self.session.execute(stmt).first()
        if row is None or row[0] is None:
            return None
        return row[0]

    # ──────────────────────────────────────────────
    # Swimmer result queries
    # ──────────────────────────────────────────────

    def swimmer_has_any_results(self, swimmer_id: str) -> bool:
        """Check if swimmer has any results in the database."""
        stmt = (
            select(WorkoutResultModel.id)
            .where(WorkoutResultModel.swimmer_id == swimmer_id)
            .limit(1)
        )
        row = self.session.execute(stmt).first()
        return row is not None

    def check_existing_results(
        self,
        swimrankings_result_ids: List[str],
        swimmer_id: str,
        chunk_size: int = 50,
    ) -> Dict[str, str]:
        """
        Check which results already exist in the database for a specific swimmer.

        Returns a dict mapping swimrankings_result_id -> database id.
        """
        if not swimrankings_result_ids:
            return {}

        existing: Dict[str, str] = {}

        for i in range(0, len(swimrankings_result_ids), chunk_size):
            chunk = swimrankings_result_ids[i : i + chunk_size]
            stmt = (
                select(
                    WorkoutResultModel.id,
                    WorkoutResultModel.swimrankings_result_id,
                )
                .where(
                    and_(
                        WorkoutResultModel.swimmer_id == swimmer_id,
                        WorkoutResultModel.swimrankings_result_id.in_(chunk),
                    )
                )
            )
            rows = self.session.execute(stmt).all()
            for row in rows:
                existing[str(row.swimrankings_result_id)] = str(row.id)

        return existing

    def get_swimmer_all_event_keys(self, swimmer_id: str) -> set:
        """
        Get all event keys for swimmer's existing results (no time filter).
        Used to determine which events are missing vs stale.

        Returns a set of event keys in ``distance_stroke_course`` format.
        """
        stmt = (
            select(
                WorkoutResultModel.distance,
                WorkoutResultModel.stroke,
                WorkoutResultModel.result_units,
            )
            .where(
                and_(
                    WorkoutResultModel.swimmer_id == swimmer_id,
                    WorkoutResultModel.activity == "swim",
                    WorkoutResultModel.swimrankings_result_id.isnot(None),
                )
            )
        )
        rows = self.session.execute(stmt).all()

        if not rows:
            return set()

        return {f"{r.distance}_{r.stroke}_{r.result_units}" for r in rows}

    def get_existing_result_count(
        self,
        swimmer_id: str,
        distance: int,
        stroke: str,
    ) -> int:
        """Get count of existing results for a specific event."""
        stmt = (
            select(func.count(WorkoutResultModel.id))
            .where(
                and_(
                    WorkoutResultModel.swimmer_id == swimmer_id,
                    WorkoutResultModel.distance == distance,
                    WorkoutResultModel.stroke == stroke,
                    WorkoutResultModel.source == "swimrankings",
                )
            )
        )
        count = self.session.execute(stmt).scalar()
        return count or 0

    # ──────────────────────────────────────────────
    # Bulk inserts
    # ──────────────────────────────────────────────

    def bulk_insert_workout_results(
        self,
        results: List[WorkoutResult],
    ) -> List[Any]:
        """
        Bulk insert workout results.

        Returns a list of dicts (with 'id' and 'swimrankings_result_id') for
        the newly inserted rows.
        """
        if not results:
            return []

        orm_objects = [
            WorkoutResultModel(
                swimmer_id=r.swimmer_id,
                distance=r.distance,
                stroke=r.stroke,
                time_result=r.time_result,
                result_units=r.result_units,
                performed_on=r.performed_on,
                meet_name=r.meet_name,
                meet_city=r.meet_city,
                meet_nation=r.meet_nation,
                source=r.source,
                swimrankings_result_id=r.swimrankings_result_id,
                reaction_time=r.reaction_time,
                activity=r.activity,
                equipment=r.equipment,
                has_splits_available=r.has_splits_available,
            )
            for r in results
        ]

        self.session.add_all(orm_objects)
        self.session.flush()  # Populate IDs without committing

        inserted = [
            {
                "id": str(obj.id),
                "swimrankings_result_id": obj.swimrankings_result_id,
            }
            for obj in orm_objects
        ]

        self.session.commit()
        return inserted

    @staticmethod
    def _seconds_to_interval(seconds: float) -> str:
        """
        Convert seconds (float) to PostgreSQL interval format.

        Returns an interval string in MM:SS.MS or HH:MM:SS.MS format.
        """
        if seconds < 0:
            seconds = 0
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = seconds % 60
        if hours > 0:
            return f"{hours:02d}:{minutes:02d}:{secs:06.3f}"
        else:
            return f"{minutes:02d}:{secs:06.3f}"

    def deduplicate_swimmer_results(self, swimmer_id: str) -> int:
        """
        Remove duplicate workout results for a swimmer.

        Keeps the oldest record for each unique result (same swimmer, stroke,
        distance, course, time, date, meet).
        """
        dedup_query = text("""
            WITH duplicate_groups AS (
              SELECT
                swimmer_id,
                stroke,
                distance,
                result_units,
                time_result,
                performed_on,
                meet_name,
                MIN(created_at) as keep_created_at,
                COUNT(*) as duplicate_count
              FROM workout_result
              WHERE swimmer_id = :swimmer_id AND activity = 'swim'
              GROUP BY
                swimmer_id,
                stroke,
                distance,
                result_units,
                time_result,
                performed_on,
                meet_name
              HAVING COUNT(*) > 1
            ),
            records_to_delete AS (
              SELECT wr.id
              FROM workout_result wr
              INNER JOIN duplicate_groups dg ON
                wr.swimmer_id = dg.swimmer_id
                AND wr.stroke = dg.stroke
                AND wr.distance = dg.distance
                AND wr.result_units = dg.result_units
                AND wr.time_result = dg.time_result
                AND wr.performed_on = dg.performed_on
                AND (wr.meet_name = dg.meet_name OR (wr.meet_name IS NULL AND dg.meet_name IS NULL))
              WHERE wr.created_at > dg.keep_created_at
            )
            DELETE FROM workout_result
            WHERE id IN (SELECT id FROM records_to_delete)
        """)

        try:
            result = self.session.execute(dedup_query, {"swimmer_id": swimmer_id})
            deleted_count = result.rowcount
            self.session.commit()
            return deleted_count
        except Exception as e:
            self.session.rollback()
            logger.warning(
                f"Could not deduplicate results for swimmer {swimmer_id}: {e}"
            )
            return 0
