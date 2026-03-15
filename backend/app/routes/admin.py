"""
Admin-only API routes for bulk operations
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.infrastructure.db import get_db
from app.infrastructure.models import BulkSyncJob, BulkSyncFailure as BulkSyncFailureModel
from app.middleware.auth import get_current_user
from app.celery_app import celery_app

router = APIRouter(prefix="/admin", tags=["admin"])


class BulkSyncRequest(BaseModel):
    """Request to start a bulk sync"""
    force_update: bool = False


class BulkSyncResponse(BaseModel):
    """Response from bulk sync start"""
    success: bool
    job_id: Optional[str] = None
    total_swimmers: Optional[int] = None
    message: str
    error: Optional[str] = None


class BulkSyncJobStatus(BaseModel):
    """Bulk sync job status"""
    id: str
    status: str
    total_swimmers: int
    swimmers_processed: int
    swimmers_succeeded: int
    swimmers_failed: int
    triggered_by: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error_message: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class BulkSyncFailure(BaseModel):
    """Individual swimmer failure in bulk sync"""
    swimmer_name: str
    error_message: str
    failed_at: str


def _job_to_dict(job: BulkSyncJob) -> dict:
    """Convert a BulkSyncJob ORM instance to a dict for BulkSyncJobStatus."""
    return {
        "id": str(job.id),
        "status": job.status,
        "total_swimmers": job.total_swimmers,
        "swimmers_processed": job.swimmers_processed,
        "swimmers_succeeded": job.swimmers_succeeded,
        "swimmers_failed": job.swimmers_failed,
        "triggered_by": str(job.triggered_by) if job.triggered_by else "",
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "error_message": job.error_message,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "updated_at": job.updated_at.isoformat() if job.updated_at else None,
    }


def _failure_to_dict(failure: BulkSyncFailureModel) -> dict:
    """Convert a BulkSyncFailure ORM instance to a dict."""
    return {
        "swimmer_name": failure.swimmer_name or "",
        "error_message": failure.error_message or "",
        "failed_at": failure.failed_at.isoformat() if failure.failed_at else "",
    }


async def require_admin(current_user: dict = Depends(get_current_user)):
    """
    Dependency to ensure user is an admin

    Raises:
        HTTPException: If user is not an admin
    """
    # Check if user email is the admin email
    user_email = current_user.get('email', '')
    is_admin = user_email == 'teddy.kalp@lablytics.com'

    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    return current_user


@router.post("/sync/bulk", response_model=BulkSyncResponse)
async def start_bulk_sync(
    request: BulkSyncRequest,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Start a bulk sync of all swimmers.

    Creates a BulkSyncJob record immediately so clients can poll for status,
    then dispatches a Celery task to do the actual work.

    Requires admin role.
    """
    try:
        user_id = current_user.get('sub')
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found in token"
            )

        # Create the job record now so the client has a job_id to poll
        job = BulkSyncJob(
            triggered_by=user_id,
            status='pending',
            total_swimmers=0,
            swimmers_processed=0,
            swimmers_succeeded=0,
            swimmers_failed=0,
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)
        job_id = str(job.id)

        # Dispatch Celery task — passes job_id so the worker uses the existing record
        celery_app.send_task(
            'worker.sync_tasks.bulk_sync_all_swimmers_task',
            kwargs={
                'triggered_by_user_id': user_id,
                'force_update': request.force_update,
                'job_id': job_id,
            }
        )

        return BulkSyncResponse(
            success=True,
            job_id=job_id,
            total_swimmers=None,
            message=f"Bulk sync queued (job_id: {job_id})"
        )

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"Failed to start bulk sync: {str(e)}\n{traceback.format_exc()}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_detail
        )


# NOTE: /history route must come BEFORE /{job_id} route to avoid FastAPI matching "history" as a job_id
@router.get("/sync/bulk/history", response_model=List[BulkSyncJobStatus])
async def get_bulk_sync_history(
    limit: int = 20,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Get recent bulk sync jobs

    Requires admin role
    """
    try:
        result = await db.execute(
            select(BulkSyncJob)
            .order_by(BulkSyncJob.created_at.desc())
            .limit(limit)
        )
        rows = result.scalars().all()

        if not rows:
            return []

        return [_job_to_dict(row) for row in rows]
    except Exception as e:
        error_str = str(e)

        if '204' in error_str or 'Missing response' in error_str:
            return []

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get bulk sync history: {error_str}"
        )


@router.get("/sync/bulk/{job_id}", response_model=BulkSyncJobStatus)
async def get_bulk_sync_status(
    job_id: str,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Get status of a bulk sync job

    Requires admin role
    """
    try:
        result = await db.execute(
            select(BulkSyncJob).where(BulkSyncJob.id == job_id)
        )
        job = result.scalar_one_or_none()

        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Bulk sync job {job_id} not found"
            )

        return _job_to_dict(job)

    except HTTPException:
        raise
    except Exception as e:
        error_str = str(e)

        if '204' in error_str or 'Missing response' in error_str:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Bulk sync job {job_id} not found"
            )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {error_str}"
        )


@router.get("/sync/bulk/{job_id}/failures", response_model=List[BulkSyncFailure])
async def get_bulk_sync_failures(
    job_id: str,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Get failures for a bulk sync job

    Requires admin role
    """
    try:
        result = await db.execute(
            select(BulkSyncFailureModel)
            .where(BulkSyncFailureModel.bulk_sync_job_id == job_id)
            .order_by(BulkSyncFailureModel.failed_at.desc())
        )
        rows = result.scalars().all()

        if not rows:
            return []

        return [_failure_to_dict(row) for row in rows]

    except Exception as e:
        error_str = str(e)

        if '204' in error_str or 'Missing response' in error_str:
            return []

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get failures: {error_str}"
        )


@router.post("/sync/bulk/{job_id}/cancel")
async def cancel_bulk_sync(
    job_id: str,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Cancel a bulk sync job

    Note: This only marks the job as cancelled. Already-enqueued tasks will still run.

    Requires admin role
    """
    try:
        # Check if job exists
        result = await db.execute(
            select(BulkSyncJob).where(BulkSyncJob.id == job_id)
        )
        job = result.scalar_one_or_none()

        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Bulk sync job {job_id} not found"
            )

        # Can only cancel pending or in_progress jobs
        current_status = job.status
        if current_status in ['completed', 'failed', 'cancelled']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot cancel job with status '{current_status}'"
            )

        # Update status to cancelled
        job.status = 'cancelled'
        job.completed_at = datetime.now(timezone.utc)
        await db.commit()

        return {
            'success': True,
            'message': f'Bulk sync job {job_id} cancelled'
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel job: {str(e)}"
        )
