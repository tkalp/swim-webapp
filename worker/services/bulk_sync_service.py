"""
Bulk sync service for orchestrating multi-swimmer synchronization.
Uses synchronous SQLAlchemy sessions.
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

from sqlalchemy import select, update, func
from sqlalchemy.orm import Session

from app.infrastructure.models import (
    SwimmerExternalLink,
    Swimmer,
    BulkSyncJob,
    BulkSyncFailure,
)

logger = logging.getLogger('bulk_sync_service')


class BulkSyncService:
    """Service for managing bulk swimmer synchronization operations."""

    def __init__(self, session: Session):
        self.session = session

    def create_bulk_sync_job(self, triggered_by_user_id: str, total_swimmers: int) -> str:
        """
        Create a new bulk sync job record.

        Returns:
            Job ID (UUID as string)
        """
        job = BulkSyncJob(
            triggered_by=triggered_by_user_id,
            status='pending',
            total_swimmers=total_swimmers,
            swimmers_processed=0,
            swimmers_succeeded=0,
            swimmers_failed=0,
            started_at=datetime.now(timezone.utc),
        )

        self.session.add(job)
        self.session.commit()

        job_id = str(job.id)
        logger.info(f"Created bulk sync job {job_id} for {total_swimmers} swimmers")

        return job_id

    def get_squad_swimrankings_links(self, squad_id: str) -> List[Dict[str, Any]]:
        """
        Get swimmer external links for SwimRankings filtered by squad.

        Args:
            squad_id: Squad UUID to filter by.

        Returns:
            List of dicts with keys: id, swimmer_id, external_id,
            first_name, last_name.
        """
        stmt = (
            select(
                SwimmerExternalLink.id,
                SwimmerExternalLink.swimmer_id,
                SwimmerExternalLink.external_athlete_id,
                Swimmer.first_name,
                Swimmer.last_name,
            )
            .join(Swimmer, SwimmerExternalLink.swimmer_id == Swimmer.id)
            .where(
                SwimmerExternalLink.external_source == 'swimrankings',
                Swimmer.squad_id == squad_id,
            )
        )

        rows = self.session.execute(stmt).all()

        return [
            {
                'id': str(r.id),
                'swimmer_id': str(r.swimmer_id),
                'external_id': str(r.external_athlete_id),
                'first_name': r.first_name,
                'last_name': r.last_name,
            }
            for r in rows
        ]

    def get_all_swimrankings_links(self) -> List[Dict[str, Any]]:
        """
        Get all swimmer external links for SwimRankings with swimmer details.

        Returns:
            List of dicts with keys: id, swimmer_id, external_id,
            first_name, last_name.
        """
        stmt = (
            select(
                SwimmerExternalLink.id,
                SwimmerExternalLink.swimmer_id,
                SwimmerExternalLink.external_athlete_id,
                Swimmer.first_name,
                Swimmer.last_name,
            )
            .join(Swimmer, SwimmerExternalLink.swimmer_id == Swimmer.id)
            .where(SwimmerExternalLink.external_source == 'swimrankings')
        )

        rows = self.session.execute(stmt).all()

        return [
            {
                'id': str(r.id),
                'swimmer_id': str(r.swimmer_id),
                'external_id': str(r.external_athlete_id),
                'first_name': r.first_name,
                'last_name': r.last_name,
            }
            for r in rows
        ]

    def update_job_total_swimmers(self, job_id: str, total_swimmers: int) -> None:
        """Update total_swimmers count on a pre-created job record."""
        stmt = (
            update(BulkSyncJob)
            .where(BulkSyncJob.id == job_id)
            .values(total_swimmers=total_swimmers)
        )
        self.session.execute(stmt)
        self.session.commit()

    def update_job_status(self, job_id: str, status: str, error_message: Optional[str] = None) -> None:
        """
        Update bulk sync job status.

        Args:
            job_id: Bulk sync job ID
            status: New status (pending, in_progress, completed, failed, cancelled)
            error_message: Optional error message if failed
        """
        values: dict = {
            'status': status,
            'updated_at': datetime.now(timezone.utc),
        }

        if error_message:
            values['error_message'] = error_message

        if status in ('completed', 'failed', 'cancelled'):
            values['completed_at'] = datetime.now(timezone.utc)

        stmt = (
            update(BulkSyncJob)
            .where(BulkSyncJob.id == job_id)
            .values(**values)
        )
        self.session.execute(stmt)
        self.session.commit()

        logger.info(f"Updated bulk sync job {job_id} status to {status}")

    def increment_job_progress(
        self,
        job_id: str,
        succeeded: bool = True,
    ) -> None:
        """
        Increment job progress counters.

        Args:
            job_id: Bulk sync job ID
            succeeded: Whether the sync succeeded or failed
        """
        # Get current job state
        stmt = (
            select(
                BulkSyncJob.swimmers_processed,
                BulkSyncJob.swimmers_succeeded,
                BulkSyncJob.swimmers_failed,
            )
            .where(BulkSyncJob.id == job_id)
        )
        row = self.session.execute(stmt).first()

        if not row:
            logger.error(f"Bulk sync job {job_id} not found")
            return

        new_processed = row.swimmers_processed + 1
        new_succeeded = row.swimmers_succeeded + (1 if succeeded else 0)
        new_failed = row.swimmers_failed + (0 if succeeded else 1)

        update_stmt = (
            update(BulkSyncJob)
            .where(BulkSyncJob.id == job_id)
            .values(
                swimmers_processed=new_processed,
                swimmers_succeeded=new_succeeded,
                swimmers_failed=new_failed,
                updated_at=datetime.now(timezone.utc),
            )
        )
        self.session.execute(update_stmt)
        self.session.commit()

    def record_failure(
        self,
        job_id: str,
        swimmer_id: str,
        external_link_id: str,
        swimmer_name: str,
        error_message: str,
    ) -> None:
        """
        Record a failed swimmer sync.
        """
        failure = BulkSyncFailure(
            bulk_sync_job_id=job_id,
            swimmer_id=swimmer_id,
            external_link_id=external_link_id,
            swimmer_name=swimmer_name,
            error_message=error_message[:500],  # Truncate long errors
        )

        self.session.add(failure)
        self.session.commit()

        logger.warning(f"Recorded failure for swimmer {swimmer_name} in job {job_id}")

    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Get bulk sync job details.

        Returns:
            Dict with job columns, or None if not found.
        """
        stmt = select(BulkSyncJob).where(BulkSyncJob.id == job_id)
        job = self.session.execute(stmt).scalar_one_or_none()

        if not job:
            return None

        return {
            'id': str(job.id),
            'triggered_by': str(job.triggered_by) if job.triggered_by else None,
            'status': job.status,
            'total_swimmers': job.total_swimmers,
            'swimmers_processed': job.swimmers_processed,
            'swimmers_succeeded': job.swimmers_succeeded,
            'swimmers_failed': job.swimmers_failed,
            'started_at': job.started_at.isoformat() if job.started_at else None,
            'completed_at': job.completed_at.isoformat() if job.completed_at else None,
            'error_message': job.error_message,
            'created_at': job.created_at.isoformat() if job.created_at else None,
            'updated_at': job.updated_at.isoformat() if job.updated_at else None,
        }

    def get_job_failures(self, job_id: str) -> List[Dict[str, Any]]:
        """
        Get all failures for a bulk sync job.

        Returns:
            List of failure record dicts.
        """
        stmt = (
            select(BulkSyncFailure)
            .where(BulkSyncFailure.bulk_sync_job_id == job_id)
            .order_by(BulkSyncFailure.failed_at.desc())
        )
        failures = self.session.execute(stmt).scalars().all()

        return [
            {
                'id': str(f.id),
                'bulk_sync_job_id': str(f.bulk_sync_job_id),
                'swimmer_id': str(f.swimmer_id) if f.swimmer_id else None,
                'external_link_id': str(f.external_link_id) if f.external_link_id else None,
                'swimmer_name': f.swimmer_name,
                'error_message': f.error_message,
                'failed_at': f.failed_at.isoformat() if f.failed_at else None,
            }
            for f in failures
        ]

    def cancel_job(self, job_id: str) -> None:
        """Mark a bulk sync job as cancelled."""
        self.update_job_status(job_id, 'cancelled')
        logger.info(f"Cancelled bulk sync job {job_id}")

    def get_recent_jobs(self, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Get recent bulk sync jobs.

        Returns:
            List of recent job record dicts.
        """
        stmt = (
            select(BulkSyncJob)
            .order_by(BulkSyncJob.created_at.desc())
            .limit(limit)
        )
        jobs = self.session.execute(stmt).scalars().all()

        return [
            {
                'id': str(j.id),
                'triggered_by': str(j.triggered_by) if j.triggered_by else None,
                'status': j.status,
                'total_swimmers': j.total_swimmers,
                'swimmers_processed': j.swimmers_processed,
                'swimmers_succeeded': j.swimmers_succeeded,
                'swimmers_failed': j.swimmers_failed,
                'started_at': j.started_at.isoformat() if j.started_at else None,
                'completed_at': j.completed_at.isoformat() if j.completed_at else None,
                'error_message': j.error_message,
                'created_at': j.created_at.isoformat() if j.created_at else None,
                'updated_at': j.updated_at.isoformat() if j.updated_at else None,
            }
            for j in jobs
        ]
