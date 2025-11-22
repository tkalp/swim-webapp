"""
Admin-only API routes for bulk operations
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.middleware.auth import get_current_user
from app.infrastructure.database import get_supabase_client
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
    started_at: Optional[str] = None  # Optional in case job hasn't started yet
    completed_at: Optional[str] = None  # Keep as string from DB
    error_message: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class BulkSyncFailure(BaseModel):
    """Individual swimmer failure in bulk sync"""
    swimmer_name: str
    error_message: str
    failed_at: str  # Keep as string from DB


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
    current_user: dict = Depends(require_admin)
):
    """
    Start a bulk sync of all swimmers
    
    Requires admin role
    """
    try:
        # Extract user ID from JWT token
        user_id = current_user.get('sub')
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found in token"
            )
        
        print("User ID for bulk sync:", user_id)
        # Enqueue bulk sync task using Celery (don't wait for result)
        task = celery_app.send_task(
            'worker.sync_tasks.bulk_sync_all_swimmers_task',
            kwargs={
                'triggered_by_user_id': user_id,
                'force_update': request.force_update
            }
        )
        
        # Return immediately with task ID
        # The task will create the job and return the job_id in its result
        # Frontend should poll the history endpoint to see the new job
        return BulkSyncResponse(
            success=True,
            job_id=None,  # Job ID will be available once task starts
            total_swimmers=None,  # Will be known once task starts
            message=f"Bulk sync task queued successfully (task_id: {task.id})"
        )
        
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
    current_user: dict = Depends(require_admin)
):
    """
    Get recent bulk sync jobs
    
    Requires admin role
    """
    try:
        supabase = get_supabase_client()
        
        result = supabase.table('bulk_sync_jobs').select('*').order(
            'created_at', desc=True
        ).limit(limit).execute()
        
        # Return empty list if no data
        if not result.data:
            return []
        
        return result.data
    except Exception as e:
        # Supabase returns 204 error - check if it's a dict or string
        error_info = str(e) if not isinstance(e, dict) else e
        error_str = str(error_info)
        
        if '204' in error_str or 'Missing response' in error_str:
            return []
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get bulk sync history: {error_str}"
        )


@router.get("/sync/bulk/{job_id}", response_model=BulkSyncJobStatus)
async def get_bulk_sync_status(
    job_id: str,
    current_user: dict = Depends(require_admin)
):
    """
    Get status of a bulk sync job
    
    Requires admin role
    """
    try:
        supabase = get_supabase_client()
        
        result = supabase.table('bulk_sync_jobs').select('*').eq(
            'id', job_id
        ).maybe_single().execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Bulk sync job {job_id} not found"
            )
        
        return result.data
        
    except HTTPException:
        # Re-raise our own HTTP exceptions
        raise
    except Exception as e:
        # Supabase returns 204 error - check if it's a dict or string
        error_info = str(e) if not isinstance(e, dict) else e
        error_str = str(error_info)
        
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
    current_user: dict = Depends(require_admin)
):
    """
    Get failures for a bulk sync job
    
    Requires admin role
    """
    try:
        supabase = get_supabase_client()
        
        result = supabase.table('bulk_sync_failures').select(
            'swimmer_name, error_message, failed_at'
        ).eq('bulk_sync_job_id', job_id).order('failed_at', desc=True).execute()
        
        if not result.data:
            return []
        
        return result.data
        
    except Exception as e:
        # Supabase returns 204 error - check if it's a dict or string
        error_info = str(e) if not isinstance(e, dict) else e
        error_str = str(error_info)
        
        if '204' in error_str or 'Missing response' in error_str:
            return []
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get failures: {error_str}"
        )


@router.post("/sync/bulk/{job_id}/cancel")
async def cancel_bulk_sync(
    job_id: str,
    current_user: dict = Depends(require_admin)
):
    """
    Cancel a bulk sync job
    
    Note: This only marks the job as cancelled. Already-enqueued tasks will still run.
    
    Requires admin role
    """
    try:
        supabase = get_supabase_client()
        
        # Check if job exists
        result = supabase.table('bulk_sync_jobs').select('status').eq(
            'id', job_id
        ).maybe_single().execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Bulk sync job {job_id} not found"
            )
        
        # Can only cancel pending or in_progress jobs
        current_status = result.data['status']
        if current_status in ['completed', 'failed', 'cancelled']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot cancel job with status '{current_status}'"
            )
        
        # Update status to cancelled
        supabase.table('bulk_sync_jobs').update({
            'status': 'cancelled',
            'completed_at': datetime.utcnow().isoformat()
        }).eq('id', job_id).execute()
        
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

