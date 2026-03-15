"""
Squad sync endpoints — SwimRankings data synchronization.

Provides endpoints to trigger and monitor bulk SwimRankings sync jobs
for all linked swimmers in a squad. Requires squad membership.
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db import get_db
from app.infrastructure.models import (
    Swimmer, SwimmerExternalLink, BulkSyncJob,
)
from app.middleware.auth import get_current_user_id
from app.middleware.authorization import get_coach_membership
from app.domain.exceptions import UnauthorizedError
from app.utils import logger, log_error

router = APIRouter(prefix="/squads", tags=["squad-sync"])


@router.post("/{squad_id}/sync")
async def trigger_squad_sync(
    squad_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Trigger a SwimRankings sync for all linked swimmers in a squad."""
    membership = await get_coach_membership(db, user_id, squad_id)
    if not membership.can_manage_squad_settings:
        raise UnauthorizedError("Missing permission: can_manage_squad_settings")
    try:
        # Count swimmers with SwimRankings links
        link_count_result = await db.execute(
            select(func.count(SwimmerExternalLink.id))
            .join(Swimmer, SwimmerExternalLink.swimmer_id == Swimmer.id)
            .where(
                Swimmer.squad_id == squad_id,
                SwimmerExternalLink.external_source == 'swimrankings',
            )
        )
        linked_count = link_count_result.scalar() or 0

        if linked_count == 0:
            raise HTTPException(
                status_code=400,
                detail="No swimmers in this squad have SwimRankings profiles linked"
            )

        # Create job record now so we can return the job_id for polling
        job = BulkSyncJob(
            triggered_by=user_id,
            status='pending',
            total_swimmers=linked_count,
            swimmers_processed=0,
            swimmers_succeeded=0,
            swimmers_failed=0,
            started_at=datetime.now(timezone.utc),
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)
        job_id = str(job.id)

        # Enqueue squad sync task via Celery, passing the pre-created job_id
        from app.celery_app import celery_app
        celery_app.send_task(
            'worker.sync_tasks.sync_squad_swimmers_task',
            kwargs={
                'squad_id': squad_id,
                'triggered_by_user_id': user_id,
                'job_id': job_id,
            }
        )

        return {
            'success': True,
            'job_id': job_id,
            'total_swimmers': linked_count,
            'message': f'Squad sync started for {linked_count} swimmers'
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error triggering squad sync: {str(e)}")
        log_error(e, context="trigger_squad_sync", squad_id=squad_id)
        raise HTTPException(status_code=500, detail=f"Failed to start squad sync: {str(e)}")


@router.get("/{squad_id}/sync/status/{job_id}")
async def get_squad_sync_status(
    squad_id: str,
    job_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get status of a squad sync job."""
    await get_coach_membership(db, user_id, squad_id)
    try:
        # Get job status
        result = await db.execute(
            select(BulkSyncJob).where(BulkSyncJob.id == job_id)
        )
        job = result.scalar_one_or_none()

        if not job:
            raise HTTPException(status_code=404, detail=f"Sync job {job_id} not found")

        return {
            'id': str(job.id),
            'status': job.status,
            'total_swimmers': job.total_swimmers,
            'swimmers_processed': job.swimmers_processed,
            'swimmers_succeeded': job.swimmers_succeeded,
            'swimmers_failed': job.swimmers_failed,
            'started_at': job.started_at.isoformat() if job.started_at else None,
            'completed_at': job.completed_at.isoformat() if job.completed_at else None,
            'error_message': job.error_message,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting squad sync status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get sync status: {str(e)}")
