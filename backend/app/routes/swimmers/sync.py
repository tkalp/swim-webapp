"""Sync management routes for external data."""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from typing import Dict, Any
from datetime import datetime

from app.middleware.auth import get_current_user_id
from app.infrastructure.database import get_supabase_client
from app.utils import logger, log_error

router = APIRouter()


@router.post("/{swimmer_id}/sync-external-data")
async def trigger_swimmer_sync(
    swimmer_id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """Manually trigger a sync of external platform data."""
    logger.info(f"Manual sync triggered for swimmer {swimmer_id}")
    
    try:
        supabase = get_supabase_client()
        
        # Verify swimmer and permissions
        swimmer = _verify_swimmer_exists(supabase, swimmer_id)
        _verify_sync_permissions(supabase, swimmer['squad_id'], user_id)
        
        # Get SwimRankings link
        link = _get_external_link(supabase, swimmer_id)
        
        # Check if already syncing
        if link.get('sync_status') == 'in_progress':
            return {
                "success": False,
                "message": "Sync already in progress for this swimmer",
                "external_link_id": link['id']
            }
        
        # Update status to pending
        supabase.table('swimmer_external_links').update({
            'sync_status': 'pending',
            'last_sync_started_at': datetime.utcnow().isoformat()
        }).eq('id', link['id']).execute()
        
        # Enqueue sync task
        task_id = _enqueue_sync_task(swimmer_id, link)
        
        return {
            "success": True,
            "message": "Sync task enqueued successfully",
            "external_link_id": link['id'],
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
    user_id: str = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """Cancel an in-progress sync for a swimmer."""
    logger.info(f"Sync cancellation requested for swimmer {swimmer_id}")
    
    try:
        supabase = get_supabase_client()
        
        # Verify swimmer and permissions
        swimmer = _verify_swimmer_exists(supabase, swimmer_id)
        _verify_sync_permissions(supabase, swimmer['squad_id'], user_id)
        
        # Get SwimRankings link
        link = _get_external_link(supabase, swimmer_id)
        
        # Check if sync is active
        if link.get('sync_status') not in ['in_progress', 'pending']:
            return {
                "success": False,
                "message": f"No active sync to cancel (status: {link.get('sync_status')})"
            }
        
        # Mark as cancelled
        supabase.table('swimmer_external_links').update({
            'sync_status': 'cancelled',
            'sync_error': 'Cancelled by user'
        }).eq('id', link['id']).execute()
        
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

def _verify_swimmer_exists(supabase, swimmer_id: str) -> Dict[str, Any]:
    """Verify swimmer exists and return data."""
    swimmer_check = supabase.table('swimmers').select(
        'id, squad_id'
    ).eq('id', swimmer_id).execute()
    
    if not swimmer_check.data:
        raise HTTPException(status_code=404, detail="Swimmer not found")
    
    swimmer = swimmer_check.data[0]
    
    if not swimmer.get('squad_id'):
        raise HTTPException(status_code=400, detail="Swimmer must belong to a squad")
    
    return swimmer


def _verify_sync_permissions(supabase, squad_id: str, user_id: str):
    """Verify user has permission to manage swimmer syncs."""
    coach_check = supabase.table('coach_squads').select('id').eq(
        'squad_id', squad_id
    ).eq('coach_id', user_id).execute()
    
    if not coach_check.data:
        raise HTTPException(
            status_code=403, 
            detail="Not authorized to manage this swimmer"
        )


def _get_external_link(supabase, swimmer_id: str) -> Dict[str, Any]:
    """Get SwimRankings external link for swimmer."""
    link_result = supabase.table('swimmer_external_links').select('*').eq(
        'swimmer_id', swimmer_id
    ).eq('platform', 'swimrankings').execute()
    
    if not link_result.data:
        raise HTTPException(
            status_code=404, 
            detail="No SwimRankings link found for this swimmer"
        )
    
    return link_result.data[0]


def _enqueue_sync_task(swimmer_id: str, link: Dict[str, Any]) -> str:
    """Enqueue background sync task using Celery."""
    try:
        from app.celery_app import celery_app
        
        task = celery_app.send_task(
            'worker.sync_tasks.sync_swimmer_task',
            kwargs={
                'swimmer_id': swimmer_id,
                'external_link_id': link['id'],
                'external_id': link['external_id'],
                'limit_events': None
            }
        )
        
        logger.info(f"Enqueued sync task {task.id} for swimmer {swimmer_id}")
        return task.id
        
    except Exception as e:
        logger.error(f"Failed to enqueue sync task: {e}")
        log_error(e, context="trigger_manual_sync", swimmer_id=swimmer_id)
        raise HTTPException(status_code=500, detail="Failed to enqueue sync task")
