"""Core swimmer routes - CRUD operations."""
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks, Depends
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta

from app.services.swimmer_service import SwimmerService
from app.middleware.auth import get_current_user_id
from app.infrastructure.database import get_supabase_client
from app.utils import logger, log_error

from .models import (
    CreateSwimmerWithLinkRequest,
    CreateSwimmerWithLinkResponse
)
from .error_handlers import handle_service_error

router = APIRouter()


@router.get("/")
async def list_swimmers(
    squad_id: Optional[str] = Query(None),
    include_stats: bool = Query(False),
    user_id: str = Depends(get_current_user_id)
) -> List[Dict[str, Any]]:
    """Get all swimmers for the authenticated user."""
    try:
        swimmer_service = SwimmerService()
        
        if squad_id:
            supabase = get_supabase_client()
            swimmers_result = supabase.table('swimmers').select(
                'id, first_name, last_name, date_of_birth, sex, created_at, squad_id'
            ).eq('squad_id', squad_id).execute()
            swimmers = swimmers_result.data or []
        else:
            swimmers = swimmer_service.get_swimmers_for_user(user_id)
        
        if include_stats and swimmers:
            swimmers = _enrich_swimmers_with_stats(swimmers)
        
        return swimmers
    except Exception as e:
        raise handle_service_error(e)


@router.get("/{swimmer_id}")
async def get_swimmer(
    swimmer_id: int,
    include_external_link: bool = Query(False),
    user_id: str = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """Get a specific swimmer by ID."""
    try:
        swimmer_service = SwimmerService()
        swimmer = swimmer_service.get_swimmer(
            swimmer_id,
            user_id=user_id,
            include_external_link=include_external_link
        )
        return swimmer
    except Exception as e:
        raise handle_service_error(e)


@router.get("/{swimmer_id}/enhanced")
async def get_swimmer_enhanced(
    swimmer_id: int,
    user_id: str = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """Get swimmer with enhanced stats."""
    try:
        swimmer_service = SwimmerService()
        supabase = get_supabase_client()
        
        swimmer = swimmer_service.get_swimmer(
            swimmer_id, user_id=user_id, include_external_link=True
        )
        
        # Get last activity
        last_activity_result = supabase.table('workout_result').select(
            'created_at'
        ).eq('swimmer_id', swimmer_id).order('created_at', desc=True).limit(1).execute()
        
        last_activity = (
            last_activity_result.data[0]['created_at'] 
            if last_activity_result.data else None
        )
        
        # Get attendance rate
        thirty_days_ago = (datetime.now() - timedelta(days=30)).isoformat()
        attendance_result = supabase.table('training_attendance').select(
            'status'
        ).eq('swimmer_id', swimmer_id).gte('created_at', thirty_days_ago).execute()
        
        attendance_rate = _calculate_attendance_rate(attendance_result.data)
        
        swimmer.update({
            'last_activity': last_activity,
            'recent_pr_count': 0,
            'attendance_rate': round(attendance_rate, 1),
            'has_external_tracking': swimmer.get('external_link') is not None
        })
        
        return swimmer
    except Exception as e:
        raise handle_service_error(e)


@router.post("/with-external-link", response_model=CreateSwimmerWithLinkResponse)
async def create_swimmer_with_external_link(
    request: CreateSwimmerWithLinkRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id)
):
    """Create a swimmer with an external platform link."""
    logger.info(
        f"Creating swimmer: {request.swimmer.first_name} {request.swimmer.last_name}"
    )
    
    try:
        supabase = get_supabase_client()
        
        # Verify permissions
        _verify_squad_permissions(supabase, request.swimmer.squad_id, user_id)
        
        # Create swimmer
        swimmer_id = _create_swimmer_record(supabase, request.swimmer)
        logger.info(f"Created swimmer {swimmer_id}")
        
        # Create external link
        external_link_id = _create_external_link_record(
            supabase, swimmer_id, request.external_link, user_id
        )
        logger.info(f"Created external link {external_link_id}")
        
        # Start sync if requested
        sync_started = False
        if request.auto_sync and request.external_link.platform == 'swimrankings':
            sync_started = _enqueue_sync_task(
                swimmer_id, external_link_id, request.external_link.external_id
            )
        
        return CreateSwimmerWithLinkResponse(
            swimmer_id=swimmer_id,
            external_link_id=external_link_id,
            sync_started=sync_started,
            message=(
                f"Swimmer created successfully"
                f"{' and data import started' if sync_started else ''}"
            )
        )
        
    except HTTPException:
        raise
    except Exception as e:
        log_error(e, context="create_swimmer_with_external_link")
        raise HTTPException(
            status_code=500, 
            detail="Failed to create swimmer with external link"
        )


# === Helper Functions ===

def _enrich_swimmers_with_stats(swimmers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Enrich swimmers with statistics."""
    supabase = get_supabase_client()
    thirty_days_ago = (datetime.now() - timedelta(days=30)).isoformat()
    swimmer_ids = [s['id'] for s in swimmers]
    
    # Batch get last activities
    last_activities_result = supabase.table('workout_result').select(
        'swimmer_id, created_at'
    ).in_('swimmer_id', swimmer_ids).order('created_at', desc=True).execute()
    
    last_activities = {}
    for row in (last_activities_result.data or []):
        sid = row['swimmer_id']
        if sid not in last_activities:
            last_activities[sid] = row['created_at']
    
    # Batch get attendance
    attendance_result = supabase.table('training_attendance').select(
        'swimmer_id, status'
    ).in_('swimmer_id', swimmer_ids).gte('created_at', thirty_days_ago).execute()
    
    attendance_rates = {}
    for sid in swimmer_ids:
        swimmer_attendance = [
            a for a in (attendance_result.data or []) 
            if a['swimmer_id'] == sid
        ]
        if swimmer_attendance:
            total = len(swimmer_attendance)
            present = sum(
                1 for a in swimmer_attendance 
                if a.get('status') and a['status'].lower() == 'present'
            )
            attendance_rates[sid] = round((present / total * 100), 1) if total > 0 else 0
        else:
            attendance_rates[sid] = 0
    
    # Check for external tracking
    external_links_result = supabase.table('swimmer_external_links').select(
        'swimmer_id'
    ).in_('swimmer_id', swimmer_ids).execute()
    has_tracking = {row['swimmer_id'] for row in (external_links_result.data or [])}
    
    # Enhance swimmers
    for swimmer in swimmers:
        sid = swimmer['id']
        swimmer['last_activity'] = last_activities.get(sid)
        swimmer['recent_pr_count'] = 0
        swimmer['attendance_rate'] = attendance_rates.get(sid, 0)
        swimmer['has_external_tracking'] = sid in has_tracking
    
    return swimmers


def _calculate_attendance_rate(attendance_data: List[Dict[str, Any]]) -> float:
    """Calculate attendance rate from attendance records."""
    if not attendance_data:
        return 0.0
    
    total_sessions = len(attendance_data)
    present_sessions = sum(
        1 for a in attendance_data 
        if a.get('status') and a['status'].lower() == 'present'
    )
    return (present_sessions / total_sessions * 100) if total_sessions > 0 else 0.0


def _verify_squad_permissions(supabase, squad_id: str, user_id: str):
    """Verify user has permission to manage swimmers in squad."""
    coach_check = supabase.table('coach_squads').select(
        'id, can_manage_swimmers'
    ).eq('squad_id', squad_id).eq('coach_id', user_id).execute()
    
    if not coach_check.data:
        raise HTTPException(
            status_code=403, 
            detail="Not authorized to add swimmers to this squad"
        )


def _create_swimmer_record(supabase, swimmer_data) -> str:
    """Create swimmer database record."""
    data = {
        'first_name': swimmer_data.first_name,
        'last_name': swimmer_data.last_name,
        'sex': swimmer_data.sex,
        'date_of_birth': swimmer_data.date_of_birth,
        'squad_id': swimmer_data.squad_id
    }
    
    result = supabase.table('swimmers').insert(data).execute()
    
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create swimmer")
    
    return str(result.data[0]['id'])


def _create_external_link_record(
    supabase, 
    swimmer_id: str, 
    link_data, 
    user_id: str
) -> str:
    """Create external link database record."""
    data = {
        'swimmer_id': swimmer_id,
        'platform': link_data.platform,
        'external_id': link_data.external_id,
        'external_url': link_data.external_url,
        'external_name': link_data.external_name,
        'birth_year': link_data.birth_year,
        'nation_code': link_data.nation_code,
        'club_name': link_data.club_name,
        'gender': link_data.gender,
        'verified': True,
        'auto_import_enabled': True,
        'sync_status': 'pending',
        'created_by': user_id
    }
    
    result = supabase.table('swimmer_external_links').insert(data).execute()
    
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create external link")
    
    return str(result.data[0]['id'])


def _enqueue_sync_task(
    swimmer_id: str, 
    external_link_id: str, 
    external_id: str
) -> bool:
    """Enqueue background sync task."""
    try:
        from app.celery_app import celery_app
        
        task = celery_app.send_task(
            'worker.sync_tasks.sync_swimmer_task',
            kwargs={
                'swimmer_id': swimmer_id,
                'external_link_id': external_link_id,
                'external_id': external_id,
            }
        )
        
        logger.info(f"Enqueued sync task {task.id} for swimmer {swimmer_id}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to enqueue sync task: {e}")
        log_error(e, context="start_background_sync", swimmer_id=swimmer_id)
        return False
