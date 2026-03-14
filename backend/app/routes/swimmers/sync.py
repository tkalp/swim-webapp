"""Sync management routes for external data."""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from typing import Dict, Any
from datetime import datetime

from sqlalchemy import select, and_  # noqa: F401 (and_ kept for potential future use)
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.auth import get_current_user_id
from app.middleware.authorization import get_coach_membership
from app.domain.exceptions import UnauthorizedError
from app.infrastructure.db import get_db
from app.infrastructure.models import Swimmer, SwimmerExternalLink
from app.utils import logger, log_error

router = APIRouter()


@router.post("/{swimmer_id}/sync-external-data")
async def trigger_swimmer_sync(
    swimmer_id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Manually trigger a sync of external platform data."""
    logger.info(f"Manual sync triggered for swimmer {swimmer_id}")

    try:
        # Verify swimmer and permissions
        swimmer = await _verify_swimmer_exists(db, swimmer_id)
        membership = await get_coach_membership(db, user_id, str(swimmer.squad_id))
        if not membership.can_manage_swimmers:
            raise UnauthorizedError("Missing permission: can_manage_swimmers")

        # Get SwimRankings link
        link = await _get_external_link(db, swimmer_id)

        # Check if already syncing
        if link.sync_status == 'in_progress':
            return {
                "success": False,
                "message": "Sync already in progress for this swimmer",
                "external_link_id": str(link.id)
            }

        # Update status to pending
        link.sync_status = 'pending'
        link.last_sync_started_at = datetime.utcnow()
        await db.commit()

        # Enqueue sync task
        task_id = _enqueue_sync_task(swimmer_id, link)

        return {
            "success": True,
            "message": "Sync task enqueued successfully",
            "external_link_id": str(link.id),
            "task_id": task_id
        }

    except HTTPException:
        raise
    except Exception as e:
        log_error(e, context="trigger_swimmer_sync", swimmer_id=swimmer_id)
        raise HTTPException(status_code=500, detail="Failed to trigger sync")


@router.post("/{swimmer_id}/cancel-sync")
async def cancel_swimmer_sync(
    swimmer_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Cancel an in-progress sync for a swimmer."""
    logger.info(f"Sync cancellation requested for swimmer {swimmer_id}")

    try:
        # Verify swimmer and permissions
        swimmer = await _verify_swimmer_exists(db, swimmer_id)
        membership = await get_coach_membership(db, user_id, str(swimmer.squad_id))
        if not membership.can_manage_swimmers:
            raise UnauthorizedError("Missing permission: can_manage_swimmers")

        # Get SwimRankings link
        link = await _get_external_link(db, swimmer_id)

        # Check if sync is active
        if link.sync_status not in ['in_progress', 'pending']:
            return {
                "success": False,
                "message": f"No active sync to cancel (status: {link.sync_status})"
            }

        # Mark as cancelled
        link.sync_status = 'cancelled'
        link.sync_error_message = 'Cancelled by user'
        await db.commit()

        logger.info(f"Marked sync as cancelled for swimmer {swimmer_id}")

        return {
            "success": True,
            "message": "Sync cancellation requested"
        }

    except HTTPException:
        raise
    except Exception as e:
        log_error(e, context="cancel_swimmer_sync", swimmer_id=swimmer_id)
        raise HTTPException(status_code=500, detail="Failed to cancel sync")


# === Helper Functions ===

async def _verify_swimmer_exists(db: AsyncSession, swimmer_id: str) -> Swimmer:
    """Verify swimmer exists and return the ORM instance."""
    result = await db.execute(
        select(Swimmer).where(Swimmer.id == swimmer_id)
    )
    swimmer = result.scalar_one_or_none()

    if not swimmer:
        raise HTTPException(status_code=404, detail="Swimmer not found")

    if not swimmer.squad_id:
        raise HTTPException(status_code=400, detail="Swimmer must belong to a squad")

    return swimmer


async def _get_external_link(
    db: AsyncSession, swimmer_id: str
) -> SwimmerExternalLink:
    """Get SwimRankings external link for swimmer."""
    result = await db.execute(
        select(SwimmerExternalLink).where(
            and_(
                SwimmerExternalLink.swimmer_id == swimmer_id,
                SwimmerExternalLink.external_source == 'swimrankings'
            )
        )
    )
    link = result.scalar_one_or_none()

    if not link:
        raise HTTPException(
            status_code=404,
            detail="No SwimRankings link found for this swimmer"
        )

    return link


def _enqueue_sync_task(swimmer_id: str, link: SwimmerExternalLink) -> str:
    """Enqueue background sync task using Celery."""
    try:
        from app.celery_app import celery_app

        task = celery_app.send_task(
            'worker.sync_tasks.sync_swimmer_task',
            kwargs={
                'swimmer_id': swimmer_id,
                'external_link_id': str(link.id),
                'external_id': link.external_athlete_id,
                'limit_events': None
            }
        )

        logger.info(f"Enqueued sync task {task.id} for swimmer {swimmer_id}")
        return task.id

    except Exception as e:
        logger.error(f"Failed to enqueue sync task: {e}")
        log_error(e, context="trigger_manual_sync", swimmer_id=swimmer_id)
        raise HTTPException(status_code=500, detail="Failed to enqueue sync task")
