"""
Database service for worker operations.
Handles all database interactions via synchronous SQLAlchemy sessions.
"""

import logging
from typing import List, Dict, Optional, Tuple, Any
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update, delete, func, and_, text
from sqlalchemy.orm import Session

from app.infrastructure.models import (
    WorkoutResult as WorkoutResultModel,
    RaceSplit as RaceSplitModel,
    SwimmerExternalLink,
)
from worker.models import (
    SyncStatusUpdate,
    WorkoutResult,
    RaceSplit,
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

    def get_swimmer_recent_results(
        self,
        swimmer_id: str,
        hours: int = 48,
    ) -> Tuple[Dict[str, Dict[str, Any]], set, set]:
        """
        Get swimmer's results OUTSIDE the freshness window (older than *hours*).

        Returns:
            (recent_results dict, stale_event_keys set, all_event_keys set)
        """
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)

        # Stale swim results (older than cutoff)
        stmt = (
            select(
                WorkoutResultModel.id,
                WorkoutResultModel.swimrankings_result_id,
                WorkoutResultModel.created_at,
                WorkoutResultModel.distance,
                WorkoutResultModel.stroke,
                WorkoutResultModel.result_units,
            )
            .where(
                and_(
                    WorkoutResultModel.swimmer_id == swimmer_id,
                    WorkoutResultModel.activity == "swim",
                    WorkoutResultModel.swimrankings_result_id.isnot(None),
                    WorkoutResultModel.created_at < cutoff_time,
                )
            )
        )
        rows = self.session.execute(stmt).all()

        print("Fetched stale results: ", len(rows))

        # All event keys for this swimmer
        all_event_keys = self.get_swimmer_all_event_keys(swimmer_id)

        if not rows:
            return {}, set(), all_event_keys

        workout_result_ids = [str(r.id) for r in rows]

        # Bulk check which results have splits
        BATCH_SIZE = 100
        ids_with_splits: set = set()

        for i in range(0, len(workout_result_ids), BATCH_SIZE):
            batch_ids = workout_result_ids[i : i + BATCH_SIZE]
            splits_stmt = (
                select(RaceSplitModel.workout_result_id)
                .where(RaceSplitModel.workout_result_id.in_(batch_ids))
            )
            split_rows = self.session.execute(splits_stmt).all()
            ids_with_splits.update(str(r.workout_result_id) for r in split_rows)

        recent_results: Dict[str, Dict[str, Any]] = {}
        stale_event_keys: set = set()

        for row in rows:
            sr_id = str(row.swimrankings_result_id)
            wr_id = str(row.id)

            recent_results[sr_id] = {
                "id": wr_id,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "has_splits": wr_id in ids_with_splits,
                "distance": row.distance,
                "stroke": row.stroke,
                "result_units": row.result_units,
            }

            event_key = f"{row.distance}_{row.stroke}_{row.result_units}"
            stale_event_keys.add(event_key)

        return recent_results, stale_event_keys, all_event_keys

    def get_swimmer_most_recent_result_per_event(
        self,
        swimmer_id: str,
    ) -> Dict[str, Dict[str, Any]]:
        """
        Get the MOST RECENT result for each event.

        Used for smart comparison: if most recent external result matches
        most recent DB result, skip the entire event.
        """
        stmt = (
            select(
                WorkoutResultModel.id,
                WorkoutResultModel.swimrankings_result_id,
                WorkoutResultModel.created_at,
                WorkoutResultModel.time_result,
                WorkoutResultModel.performed_on,
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
            .order_by(WorkoutResultModel.created_at.desc())
        )
        rows = self.session.execute(stmt).all()

        if not rows:
            return {}

        most_recent_per_event: Dict[str, Dict[str, Any]] = {}

        for row in rows:
            event_key = f"{row.distance}_{row.stroke}_{row.result_units}"

            if event_key in most_recent_per_event:
                continue

            most_recent_per_event[event_key] = {
                "swimrankings_result_id": str(row.swimrankings_result_id),
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "time_result": row.time_result,
                "performed_on": str(row.performed_on) if row.performed_on else None,
                "distance": row.distance,
                "stroke": row.stroke,
                "result_units": row.result_units,
            }

        return most_recent_per_event

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

    def bulk_insert_workout_results_with_splits(
        self,
        results: List[WorkoutResult],
        splits_map: Dict[str, List[RaceSplit]],
    ) -> List[Dict]:
        """
        Bulk insert workout results and their associated splits together.

        Returns a list of inserted workout result records (dicts with ids).
        """
        if not results:
            return []

        # Insert workout results first
        inserted_results = self.bulk_insert_workout_results(results)

        if not inserted_results or not splits_map:
            return inserted_results

        # Map swimrankings_result_id -> database ID
        sr_id_to_db_id = {
            record["swimrankings_result_id"]: record["id"]
            for record in inserted_results
            if record.get("swimrankings_result_id")
        }

        # Build split ORM objects
        split_objects = []
        for sr_id, splits in splits_map.items():
            workout_result_id = sr_id_to_db_id.get(sr_id)
            if not workout_result_id:
                logger.debug(
                    f"No database ID found for swimrankings_result_id {sr_id}, "
                    f"skipping {len(splits)} splits"
                )
                continue

            for split in splits:
                split_objects.append(
                    RaceSplitModel(
                        workout_result_id=workout_result_id,
                        split_distance=split.split_distance,
                        split_time=self._seconds_to_interval(split.split_time),
                        cumulative_time=self._seconds_to_interval(split.cumulative_time),
                        split_order=split.split_order,
                    )
                )

        if split_objects:
            try:
                self.session.add_all(split_objects)
                self.session.commit()
                logger.info(f"Successfully inserted {len(split_objects)} race splits")
            except Exception as e:
                self.session.rollback()
                logger.error(
                    f"Error inserting {len(split_objects)} race splits: {e}",
                    exc_info=True,
                )
                # Still return inserted results even if splits fail

        return inserted_results

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

    def bulk_insert_race_splits(
        self,
        workout_result_id: str,
        splits: List[RaceSplit],
    ) -> None:
        """Bulk insert race splits for a workout result."""
        if not splits:
            return

        split_objects = [
            RaceSplitModel(
                workout_result_id=workout_result_id,
                split_distance=split.split_distance,
                split_time=self._seconds_to_interval(split.split_time),
                cumulative_time=self._seconds_to_interval(split.cumulative_time),
                split_order=split.split_order,
            )
            for split in splits
        ]

        try:
            self.session.add_all(split_objects)
            self.session.commit()
            logger.info(
                f"Inserted {len(split_objects)} splits for result {workout_result_id}"
            )
        except Exception as e:
            self.session.rollback()
            logger.error(
                f"Error inserting splits for {workout_result_id}: {e}", exc_info=True
            )

    def bulk_insert_splits_for_multiple_results(
        self,
        splits_map: Dict[str, List[RaceSplit]],
    ) -> None:
        """Bulk insert splits for multiple workout results."""
        if not splits_map:
            return

        all_split_objects = []
        for workout_result_id, splits in splits_map.items():
            for split in splits:
                all_split_objects.append(
                    RaceSplitModel(
                        workout_result_id=workout_result_id,
                        split_distance=split.split_distance,
                        split_time=self._seconds_to_interval(split.split_time),
                        cumulative_time=self._seconds_to_interval(split.cumulative_time),
                        split_order=split.split_order,
                    )
                )

        if all_split_objects:
            try:
                self.session.add_all(all_split_objects)
                self.session.commit()
                logger.info(
                    f"Inserted {len(all_split_objects)} splits for "
                    f"{len(splits_map)} results"
                )
            except Exception as e:
                self.session.rollback()
                logger.error(
                    f"Error inserting {len(all_split_objects)} splits: {e}",
                    exc_info=True,
                )

    def update_stale_results_timestamp(
        self,
        workout_result_ids: List[str],
    ) -> None:
        """Update created_at timestamp for stale results to mark them as fresh."""
        if not workout_result_ids:
            return

        BATCH_SIZE = 100
        for i in range(0, len(workout_result_ids), BATCH_SIZE):
            batch_ids = workout_result_ids[i : i + BATCH_SIZE]
            stmt = (
                update(WorkoutResultModel)
                .where(WorkoutResultModel.id.in_(batch_ids))
                .values(created_at=func.now())
            )
            self.session.execute(stmt)

        self.session.commit()

    def mark_results_without_splits(
        self,
        workout_result_ids: List[str],
    ) -> None:
        """Mark results as having no splits available on SwimRankings."""
        if not workout_result_ids:
            return

        BATCH_SIZE = 100
        for i in range(0, len(workout_result_ids), BATCH_SIZE):
            batch_ids = workout_result_ids[i : i + BATCH_SIZE]
            stmt = (
                update(WorkoutResultModel)
                .where(WorkoutResultModel.id.in_(batch_ids))
                .values(has_splits_available=False)
            )
            self.session.execute(stmt)

        self.session.commit()

    def get_events_checked(self, external_link_id: str) -> Dict[str, str]:
        """
        Get events_checked map from swimmer_external_links.

        Returns a dict mapping event keys to ISO 8601 timestamps,
        or an empty dict if not found.
        """
        stmt = (
            select(SwimmerExternalLink.events_checked)
            .where(SwimmerExternalLink.id == external_link_id)
        )
        row = self.session.execute(stmt).first()

        if row is None or not row[0]:
            return {}

        # events_checked may be stored as a JSONB dict or a simple value
        value = row[0]
        if isinstance(value, dict):
            return value
        return {}

    def update_events_checked(
        self,
        external_link_id: str,
        event_keys: List[str],
        timestamp: Optional[str] = None,
    ) -> None:
        """
        Update events_checked map with new event check timestamps.

        Merges new event keys (with current timestamp) into the existing map.
        """
        if not event_keys:
            return

        if timestamp is None:
            timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f") + "Z"

        updates = {key: timestamp for key in event_keys}

        # Get current events_checked and merge
        current = self.get_events_checked(external_link_id)
        current.update(updates)

        stmt = (
            update(SwimmerExternalLink)
            .where(SwimmerExternalLink.id == external_link_id)
            .values(events_checked=current)
        )
        self.session.execute(stmt)
        self.session.commit()
