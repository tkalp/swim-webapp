# backend/app/routes/swimmers.py (REFACTORED)
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks, Depends, Request
from typing import Optional, Dict, Any, List
from pydantic import BaseModel

from app.services.swimmer_service import SwimmerService
from app.services.performance_service import PerformanceService
from app.middleware.auth import get_current_user_id
from app.infrastructure.database import get_supabase_client
from app.infrastructure.constants import SyncStatus
from app.domain.exceptions import (
    ApplicationError,
    NotFoundError,
    UnauthorizedError,
    ValidationError,
    DatabaseError
)
from app.utils import logger, log_error
from app.utils.fina_calculator import calculate_fina_points, get_supported_events
from app.domain.value_objects.time import interval_to_seconds
from datetime import datetime

router = APIRouter(prefix="/swimmers", tags=["swimmers"])


# === Pydantic Models ===

class SwimmerData(BaseModel):
    first_name: str
    last_name: str
    sex: Optional[str] = None
    date_of_birth: Optional[str] = None
    squad_id: str


class ExternalLinkData(BaseModel):
    platform: str
    external_id: str
    external_url: Optional[str] = None
    external_name: Optional[str] = None
    birth_year: Optional[int] = None
    nation_code: Optional[str] = None
    club_name: Optional[str] = None
    gender: Optional[str] = None


class CreateSwimmerWithLinkRequest(BaseModel):
    swimmer: SwimmerData
    external_link: ExternalLinkData
    auto_sync: bool = True


class CreateSwimmerWithLinkResponse(BaseModel):
    swimmer_id: str
    external_link_id: str
    sync_started: bool
    message: str


# === Error Handler ===

def handle_service_error(e: Exception) -> HTTPException:
    """Convert service exceptions to HTTP exceptions."""
    if isinstance(e, NotFoundError):
        return HTTPException(status_code=404, detail=e.message)
    elif isinstance(e, UnauthorizedError):
        return HTTPException(status_code=403, detail=e.message)
    elif isinstance(e, ValidationError):
        return HTTPException(status_code=422, detail=e.message)
    elif isinstance(e, DatabaseError):
        # Expose database errors with their messages for debugging
        log_error(e, context="database_error")
        return HTTPException(status_code=500, detail=e.message)
    elif isinstance(e, ApplicationError):
        return HTTPException(status_code=e.status_code, detail=e.message)
    else:
        log_error(e, context="swimmers_route")
        return HTTPException(status_code=500, detail="Internal server error")


# === Routes ===

@router.get("/")
async def list_swimmers(
    request: Request,
    user_id: str = Depends(get_current_user_id)
) -> List[Dict[str, Any]]:
    """Get all swimmers for the authenticated user."""
    try:
        swimmer_service = SwimmerService()
        swimmers = swimmer_service.get_swimmers_for_user(user_id)
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


@router.post("/with-external-link", response_model=CreateSwimmerWithLinkResponse)
async def create_swimmer_with_external_link(
    request: CreateSwimmerWithLinkRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id)
):
    """Create a swimmer with an external platform link and optionally start background data sync."""
    logger.info(f"Creating swimmer with external link: {request.swimmer.first_name} {request.swimmer.last_name}")
    
    try:
        supabase = get_supabase_client()
        
        # Verify user has permission to add swimmers to this squad
        squad_id = request.swimmer.squad_id
        coach_check = supabase.table('coach_squads').select('id, can_manage_swimmers').eq(
            'squad_id', squad_id
        ).eq('coach_id', user_id).execute()
        
        if not coach_check.data:
            raise HTTPException(status_code=403, detail="Not authorized to add swimmers to this squad")
        
        # Create the swimmer
        swimmer_data = {
            'first_name': request.swimmer.first_name,
            'last_name': request.swimmer.last_name,
            'sex': request.swimmer.sex,
            'date_of_birth': request.swimmer.date_of_birth,
            'squad_id': request.swimmer.squad_id
        }
        
        swimmer_result = supabase.table('swimmers').insert(swimmer_data).execute()
        
        if not swimmer_result.data:
            raise HTTPException(status_code=500, detail="Failed to create swimmer")
        
        swimmer = swimmer_result.data[0]
        swimmer_id = str(swimmer['id']) # type: ignore 
        
        logger.info(f"Created swimmer {swimmer_id}")
        
        # Create the external link
        link_data = {
            'swimmer_id': swimmer_id,
            'platform': request.external_link.platform,
            'external_id': request.external_link.external_id,
            'external_url': request.external_link.external_url,
            'external_name': request.external_link.external_name,
            'birth_year': request.external_link.birth_year,
            'nation_code': request.external_link.nation_code,
            'club_name': request.external_link.club_name,
            'gender': request.external_link.gender,
            'verified': True,
            'auto_import_enabled': True,
            'sync_status': 'pending',
            'created_by': user_id
        }
        
        link_result = supabase.table('swimmer_external_links').insert(link_data).execute()
        
        if not link_result.data:
            raise HTTPException(status_code=500, detail="Failed to create external link")
        
        link = link_result.data[0]
        external_link_id = str(link['id']) # type: ignore
        
        logger.info(f"Created external link {external_link_id}")
        
        # Start background sync if requested
        sync_started = False
        if request.auto_sync and request.external_link.platform == 'swimrankings':
            try:
                from app.celery_app import celery_app
                
                task = celery_app.send_task(
                    'worker.sync_tasks.sync_swimmer_task',
                    kwargs={
                        'swimmer_id': swimmer_id,
                        'external_link_id': external_link_id,
                        'external_id': request.external_link.external_id,
                    }
                )
                
                sync_started = True
                logger.info(f"Enqueued sync task {task.id} for new swimmer {swimmer_id}")
                
            except Exception as e:
                logger.error(f"Failed to enqueue sync task: {e}")
                log_error(e, context="start_background_sync", swimmer_id=swimmer_id)
        
        return CreateSwimmerWithLinkResponse(
            swimmer_id=swimmer_id,
            external_link_id=external_link_id,
            sync_started=sync_started,
            message=f"Swimmer created successfully{' and data import started' if sync_started else ''}"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        log_error(e, context="create_swimmer_with_external_link")
        raise HTTPException(status_code=500, detail="Failed to create swimmer with external link")


@router.get("/{swimmer_id}/best-times")
async def get_best_times(
    swimmer_id: int,
    interval: Optional[str] = Query(None),
    stroke: Optional[str] = Query(None),
    distance: Optional[int] = Query(None),
    user_id: str = Depends(get_current_user_id)
) -> List[Dict[str, Any]]:
    """Get best times for a swimmer with optional filters."""
    try:
        performance_service = PerformanceService()
        best_times = performance_service.get_best_times(
            swimmer_id=swimmer_id, # type: ignore
            user_id=user_id,
            interval=interval,
            stroke=stroke,
            distance=distance
        )
        return best_times
    except Exception as e:
        raise handle_service_error(e)


@router.get("/{swimmer_id}/best-splits/{distance}/{stroke}")
async def get_best_splits_by_event(
    swimmer_id: str,
    distance: int,
    stroke: str,
    activity: str = Query(default="swim"),
    equipment: str = Query(default="none"),
    result_units: str = Query(default="SCM")
) -> Dict[str, Any]:
    """
    Get the best (fastest) cumulative time at each split distance for a swimmer's event.
    
    This creates a "perfect race" benchmark by taking the fastest time ever achieved
    at each split point (50m, 100m, 150m, etc.) across all attempts.
    """
    try:
        supabase = get_supabase_client()
        
        # Get all workout results for this event
        results_response = supabase.table('workout_result').select(
            'id, performed_on, time_result, race_splits(split_distance, cumulative_time)'
        ).eq('swimmer_id', swimmer_id).eq(
            'distance', distance
        ).eq('stroke', stroke).eq(
            'activity', activity
        ).eq('equipment', equipment).eq(
            'result_units', result_units
        ).execute()
        
        if not results_response.data:
            return {
                "distance": distance,
                "stroke": stroke,
                "best_splits": [],
                "total_attempts_analyzed": 0
            }
        
        # Filter out null time_results
        valid_attempts = [r for r in results_response.data if r.get('time_result')]
        
        if not valid_attempts:
            return {
                "distance": distance,
                "stroke": stroke,
                "best_splits": [],
                "total_attempts_analyzed": 0
            }
        
        # Build a map: split_distance -> {best_time, attempt_id}
        best_splits_map: Dict[int, Dict[str, Any]] = {}
        
        for attempt in valid_attempts:
            if not attempt.get('race_splits'):
                continue
                
            for split in attempt['race_splits']:
                split_distance = split['split_distance']
                cumulative_time = split['cumulative_time']
                
                # Convert interval to seconds for comparison
                time_seconds = interval_to_seconds(cumulative_time)
                
                if split_distance not in best_splits_map:
                    best_splits_map[split_distance] = {
                        'best_cumulative_time': cumulative_time,
                        'best_seconds': time_seconds,
                        'from_attempt_id': attempt['id'],
                        'from_attempt_date': attempt.get('performed_on')
                    }
                else:
                    # Compare and keep the best
                    if time_seconds < best_splits_map[split_distance]['best_seconds']:
                        best_splits_map[split_distance] = {
                            'best_cumulative_time': cumulative_time,
                            'best_seconds': time_seconds,
                            'from_attempt_id': attempt['id'],
                            'from_attempt_date': attempt.get('performed_on')
                        }
        
        # Convert to sorted list
        best_splits = [
            {
                'split_distance': dist,
                'best_cumulative_time': data['best_cumulative_time'],
                'best_seconds': data['best_seconds'],
                'from_attempt_id': data['from_attempt_id'],
                'from_attempt_date': data['from_attempt_date']
            }
            for dist, data in sorted(best_splits_map.items())
        ]
        
        return {
            "distance": distance,
            "stroke": stroke,
            "activity": activity,
            "equipment": equipment,
            "result_units": result_units,
            "best_splits": best_splits,
            "total_attempts_analyzed": len(valid_attempts)
        }
        
    except Exception as e:
        logger.error(f"Error fetching best splits: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{swimmer_id}/best-splits")
async def get_best_splits(
    swimmer_id: int,
    interval: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user_id)
) -> List[Dict[str, Any]]:
    """Get best splits for a swimmer (general query)."""
    try:
        performance_service = PerformanceService()
        splits = performance_service.get_best_splits(
            swimmer_id=swimmer_id, # type: ignore
            user_id=user_id,
            interval=interval
        )
        return splits
    except Exception as e:
        raise handle_service_error(e)


@router.get("/{swimmer_id}/fina-points")
async def get_swimmer_fina_points(
    swimmer_id: str,
    gender: str = Query(..., description="Swimmer gender (male/female)"),
    course: str = Query(default="LCM", description="Course type (LCM or SCM)"),
    activity: str = Query(default="swim"),
    equipment: str = Query(default="none"),
    user_id: str = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """Calculate FINA points for all of a swimmer's results."""
    try:
        performance_service = PerformanceService()
        
        # Get all results for the swimmer
        results = performance_service.get_workout_results(
            swimmer_id=swimmer_id,
            user_id=user_id
        )
        
        # Filter by course
        filtered_results = [r for r in results if r.get("result_units") == course]
        
        if not filtered_results:
            return {
                "swimmer_id": swimmer_id,
                "gender": gender,
                "course": course,
                "overall_best_fina_points": 0,
                "overall_average_fina_points": 0,
                "total_results": 0,
                "by_stroke": {},
                "results_with_points": []
            }
        
        # Calculate FINA points for each result
        results_with_points = []
        all_fina_points = []
        
        for result in filtered_results:
            time_seconds = interval_to_seconds(result["time_result"])
            result_course = result.get("result_units", course)
            
            fina_points = calculate_fina_points(
                time_seconds=time_seconds,
                stroke=result["stroke"],
                distance=result["distance"],
                gender=gender,
                course=result_course
            )
            
            if fina_points is not None:
                result_with_points = {
                    "id": result["id"],
                    "distance": result["distance"],
                    "stroke": result["stroke"],
                    "time_result": result["time_result"],
                    "time_seconds": time_seconds,
                    "performed_on": result["performed_on"],
                    "fina_points": fina_points,
                    "result_units": result["result_units"]
                }
                results_with_points.append(result_with_points)
                all_fina_points.append(fina_points)
        
        if not results_with_points:
            return {
                "swimmer_id": swimmer_id,
                "gender": gender,
                "course": course,
                "overall_best_fina_points": 0,
                "overall_average_fina_points": 0,
                "total_results": 0,
                "by_stroke": {},
                "results_with_points": []
            }
        
        # Group by stroke
        by_stroke = {}
        strokes = set(r["stroke"] for r in results_with_points)
        
        for stroke in strokes:
            stroke_results = [r for r in results_with_points if r["stroke"] == stroke]
            stroke_points = [r["fina_points"] for r in stroke_results]
            
            best_by_distance = {}
            distances = set(r["distance"] for r in stroke_results)
            
            for distance in distances:
                distance_results = [r for r in stroke_results if r["distance"] == distance]
                best_result = max(distance_results, key=lambda x: x["fina_points"])
                best_by_distance[str(distance)] = {
                    "id": best_result["id"],
                    "distance": best_result["distance"],
                    "time_result": best_result["time_result"],
                    "time_seconds": best_result["time_seconds"],
                    "fina_points": best_result["fina_points"],
                    "performed_on": best_result["performed_on"]
                }
            
            by_stroke[stroke] = {
                "best_fina_points": max(stroke_points),
                "average_fina_points": round(sum(stroke_points) / len(stroke_points)),
                "total_results": len(stroke_results),
                "best_by_distance": best_by_distance
            }
        
        overall_best = max(all_fina_points)
        overall_average = round(sum(all_fina_points) / len(all_fina_points))
        overall_best_result = max(results_with_points, key=lambda x: x["fina_points"])
        
        return {
            "swimmer_id": swimmer_id,
            "gender": gender,
            "course": course,
            "overall_best_fina_points": overall_best,
            "overall_best_result": {
                "id": overall_best_result["id"],
                "stroke": overall_best_result["stroke"],
                "distance": overall_best_result["distance"],
                "time_result": overall_best_result["time_result"],
                "time_seconds": overall_best_result["time_seconds"],
                "fina_points": overall_best_result["fina_points"],
                "performed_on": overall_best_result["performed_on"]
            },
            "overall_average_fina_points": overall_average,
            "total_results": len(results_with_points),
            "by_stroke": by_stroke,
            "results_with_points": sorted(results_with_points, key=lambda x: x["fina_points"], reverse=True)
        }
        
    except Exception as e:
        raise handle_service_error(e)


@router.get("/fina/supported-events")
async def get_fina_supported_events(
    course: str = Query(default="LCM", description="Course type (LCM or SCM)")
) -> Dict[str, Any]:
    """Get list of all events supported for FINA point calculation."""
    try:
        events = get_supported_events(course)
        return {
            "course": course,
            "events": events
        }
    except Exception as e:
        logger.error(f"Error fetching supported FINA events: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{swimmer_id}/sync-external-data")
async def trigger_swimmer_sync(
    swimmer_id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """Manually trigger a sync of external platform data for a swimmer."""
    logger.info(f"Manual sync triggered for swimmer {swimmer_id}")
    
    try:
        supabase = get_supabase_client()
        
        # Verify swimmer exists and get squad_id
        swimmer_check = supabase.table('swimmers').select('id, squad_id').eq('id', swimmer_id).execute()
        
        if not swimmer_check.data:
            raise HTTPException(status_code=404, detail="Swimmer not found")
        
        swimmer = swimmer_check.data[0]
        squad_id = swimmer.get('squad_id')
        
        if not squad_id:
            raise HTTPException(status_code=400, detail="Swimmer must belong to a squad")
        
        # Verify user has permission
        coach_check = supabase.table('coach_squads').select('id').eq(
            'squad_id', squad_id
        ).eq('coach_id', user_id).execute()
        
        if not coach_check.data:
            raise HTTPException(status_code=403, detail="Not authorized to manage this swimmer")
        
        # Get SwimRankings link
        link_result = supabase.table('swimmer_external_links').select('*').eq(
            'swimmer_id', swimmer_id
        ).eq('platform', 'swimrankings').execute()
        
        if not link_result.data:
            raise HTTPException(status_code=404, detail="No SwimRankings link found for this swimmer")
        
        link = link_result.data[0]
        
        # Check if already syncing
        if link.get('sync_status') == 'in_progress':
            return {
                "success": False,
                "message": "Sync already in progress for this swimmer",
                "external_link_id": link['id']
            }
        
        # Update status to pending before starting sync
        supabase.table('swimmer_external_links').update({
            'sync_status': 'pending',
            'last_sync_started_at': datetime.utcnow().isoformat()
        }).eq('id', link['id']).execute()
        
        # Start background sync using Celery worker
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
            
            return {
                "success": True,
                "message": "Sync task enqueued successfully",
                "external_link_id": link['id'],
                "task_id": task.id
            }
            
        except Exception as e:
            logger.error(f"Failed to enqueue sync task: {e}")
            log_error(e, context="trigger_manual_sync", swimmer_id=swimmer_id)
            raise HTTPException(status_code=500, detail="Failed to enqueue sync task")
        
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
        
        # Verify swimmer exists and get squad_id
        swimmer_check = supabase.table('swimmers').select('id, squad_id').eq('id', swimmer_id).execute()
        
        if not swimmer_check.data:
            raise HTTPException(status_code=404, detail="Swimmer not found")
        
        swimmer = swimmer_check.data[0]
        squad_id = swimmer.get('squad_id')
        
        if not squad_id:
            raise HTTPException(status_code=400, detail="Swimmer must belong to a squad")
        
        # Verify user has permission
        coach_check = supabase.table('coach_squads').select('id').eq(
            'squad_id', squad_id
        ).eq('coach_id', user_id).execute()
        
        if not coach_check.data:
            raise HTTPException(status_code=403, detail="Not authorized to manage this swimmer")
        
        # Get SwimRankings link
        link_result = supabase.table('swimmer_external_links').select('*').eq(
            'swimmer_id', swimmer_id
        ).eq('platform', 'swimrankings').execute()
        
        if not link_result.data:
            raise HTTPException(status_code=404, detail="No SwimRankings link found for this swimmer")
        
        link = link_result.data[0]
        
        # Check if sync is actually in progress
        if link.get('sync_status') not in ['in_progress', 'pending']:
            return {
                "success": False,
                "message": f"No active sync to cancel (status: {link.get('sync_status')})"
            }
        
        # Mark as cancelled - the sync task will pick this up
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
