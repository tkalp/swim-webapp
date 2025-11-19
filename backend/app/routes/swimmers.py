# backend/app/routes/swimmers.py
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks, Depends
from typing import Optional, Dict, Any, List
from supabase import create_client, Client
from pydantic import BaseModel
from datetime import datetime
from app.utils import logger, log_error
from app.utils.fina_calculator import calculate_fina_points, get_supported_events
from app.middleware.auth import get_current_user_id
import os

router = APIRouter(prefix="/swimmers", tags=["swimmers"])


def get_supabase_client() -> Client:
    """Get Supabase client instance"""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        raise ValueError("Missing Supabase credentials")
    
    return create_client(supabase_url, supabase_key)


@router.get("/{swimmer_id}/best-splits/{distance}/{stroke}")
async def get_best_splits(
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
    
    Returns:
        {
            "distance": 200,
            "stroke": "free",
            "best_splits": [
                {"split_distance": 50, "best_cumulative_time": "00:00:28.45", "from_attempt_id": "uuid"},
                {"split_distance": 100, "best_cumulative_time": "00:00:58.12", "from_attempt_id": "uuid"},
                ...
            ],
            "total_attempts_analyzed": 15
        }
    """
    try:
        supabase = get_supabase_client()
        
        # First, get all workout results for this event
        results_response = supabase.table('workout_result').select(
            'id, performed_on, time_result, race_splits(split_distance, cumulative_time)'
        ).eq('swimmer_id', swimmer_id).eq(
            'distance', distance
        ).eq('stroke', stroke).eq(
            'activity', activity
        ).eq('equipment', equipment).eq(
            'result_units', result_units
        ).execute()
        
        if results_response.data is None or len(results_response.data) == 0:
            return {
                "distance": distance,
                "stroke": stroke,
                "best_splits": [],
                "total_attempts_analyzed": 0
            }
        
        # Filter out null time_results
        valid_attempts = [r for r in results_response.data if r.get('time_result')]
        
        if len(valid_attempts) == 0:
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
                time_seconds = _interval_to_seconds(cumulative_time)
                
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


def _interval_to_seconds(interval_str: str) -> float:
    """Convert PostgreSQL interval string to seconds"""
    if not interval_str:
        return float('inf')
    
    # Handle formats like "00:00:28.45" or "00:01:58.12"
    parts = interval_str.split(':')
    
    try:
        if len(parts) == 3:
            hours = int(parts[0])
            minutes = int(parts[1])
            seconds = float(parts[2])
            return hours * 3600 + minutes * 60 + seconds
        elif len(parts) == 2:
            minutes = int(parts[0])
            seconds = float(parts[1])
            return minutes * 60 + seconds
        else:
            return float(interval_str)
    except (ValueError, IndexError):
        return float('inf')


@router.get("/{swimmer_id}/fina-points")
async def get_swimmer_fina_points(
    swimmer_id: str,
    gender: str = Query(..., description="Swimmer gender (male/female)"),
    course: str = Query(default="LCM", description="Course type (LCM or SCM)"),
    activity: str = Query(default="swim", description="Activity type filter"),
    equipment: str = Query(default="none", description="Equipment filter")
) -> Dict[str, Any]:
    """
    Calculate FINA points for all of a swimmer's results
    
    Returns:
    - Overall best and average FINA points
    - Best FINA points by stroke
    - Best results with FINA points for each event
    """
    try:
        supabase = get_supabase_client()
        
        # Fetch all results for the swimmer, filtered by course (result_units)
        response = supabase.table("workout_result").select(
            "id, distance, stroke, time_result, performed_on, activity, equipment, result_units"
        ).eq("swimmer_id", swimmer_id).eq("activity", activity).eq("equipment", equipment).eq("result_units", course).execute()
        
        if not response.data:
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
        
        results = response.data
        
        # Calculate FINA points for each result
        results_with_points = []
        all_fina_points = []
        
        for result in results:
            # Convert time to seconds
            time_seconds = _interval_to_seconds(result["time_result"])
            
            # Use the result's own result_units (SCM/LCM/SCY) for accurate FINA calculation
            result_course = result.get("result_units", course)
            
            # Calculate FINA points using the result's actual course
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
        
        # Group by stroke and calculate summaries
        by_stroke = {}
        strokes = set(r["stroke"] for r in results_with_points)
        
        for stroke in strokes:
            stroke_results = [r for r in results_with_points if r["stroke"] == stroke]
            stroke_points = [r["fina_points"] for r in stroke_results]
            
            # Find best result for each distance
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
        
        # Calculate overall statistics
        overall_best = max(all_fina_points)
        overall_average = round(sum(all_fina_points) / len(all_fina_points))
        
        # Find the overall best result (event with highest FINA points)
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
        logger.error(f"Error calculating FINA points for swimmer {swimmer_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/fina/supported-events")
async def get_fina_supported_events(
    course: str = Query(default="LCM", description="Course type (LCM or SCM)")
) -> Dict[str, Any]:
    """
    Get list of all events supported for FINA point calculation
    
    Returns:
    - Supported events by gender and stroke
    """
    try:
        events = get_supported_events(course)
        return {
            "course": course,
            "events": events
        }
    except Exception as e:
        logger.error(f"Error fetching supported FINA events: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Pydantic models for new endpoint
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
    auto_sync: bool = True  # Whether to immediately start background sync


class CreateSwimmerWithLinkResponse(BaseModel):
    swimmer_id: str
    external_link_id: str
    sync_started: bool
    message: str


@router.post("/with-external-link", response_model=CreateSwimmerWithLinkResponse)
async def create_swimmer_with_external_link(
    request: CreateSwimmerWithLinkRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id)
):
    """
    Create a swimmer with an external platform link and optionally start background data sync
    
    This endpoint:
    1. Creates a new swimmer in the database
    2. Links them to an external platform (e.g., SwimRankings)
    3. Optionally triggers a background job to import their historical results
    
    Args:
        request: Swimmer data and external link information
        background_tasks: FastAPI background tasks
        user_id: Authenticated user ID
    
    Returns:
        Created swimmer and link IDs, sync status
    """
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
        swimmer_id = swimmer['id']
        
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
        external_link_id = link['id']
        
        logger.info(f"Created external link {external_link_id}")
        
        # Start background sync if requested
        sync_started = False
        if request.auto_sync and request.external_link.platform == 'swimrankings':
            try:
                from app.tasks.swimrankings_sync import start_swimmer_sync
                
                background_tasks.add_task(
                    start_swimmer_sync,
                    swimmer_id=swimmer_id,
                    external_link_id=external_link_id,
                    external_id=request.external_link.external_id,
                    limit_events=10  # Initially sync top 10 events, full sync happens in daily job
                )
                
                sync_started = True
                logger.info(f"Started background sync for swimmer {swimmer_id}")
                
            except Exception as e:
                logger.error(f"Failed to start background sync: {e}")
                log_error(e, context="start_background_sync", swimmer_id=swimmer_id)
                # Don't fail the request if background sync fails to start
        
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


@router.post("/{swimmer_id}/sync-external-data")
async def trigger_swimmer_sync(
    swimmer_id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id)
):
    """
    Manually trigger a sync of external platform data for a swimmer
    
    This endpoint allows coaches to manually re-sync a swimmer's data
    from their linked external platform (e.g., SwimRankings)
    
    Args:
        swimmer_id: Swimmer ID
        background_tasks: FastAPI background tasks
        user_id: Authenticated user ID
    
    Returns:
        Sync status message
    """
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
        
        # Start background sync
        try:
            from app.tasks.swimrankings_sync import start_swimmer_sync
            
            background_tasks.add_task(
                start_swimmer_sync,
                swimmer_id=swimmer_id,
                external_link_id=link['id'],
                external_id=link['external_id'],
                limit_events=None  # Full sync
            )
            
            logger.info(f"Started manual sync for swimmer {swimmer_id}")
            
            return {
                "success": True,
                "message": "Sync started successfully",
                "external_link_id": link['id']
            }
            
        except Exception as e:
            logger.error(f"Failed to start manual sync: {e}")
            log_error(e, context="trigger_manual_sync", swimmer_id=swimmer_id)
            raise HTTPException(status_code=500, detail="Failed to start sync")
        
    except HTTPException:
        raise
    except Exception as e:
        log_error(e, context="trigger_swimmer_sync", swimmer_id=swimmer_id)
        raise HTTPException(status_code=500, detail="Failed to trigger sync")


@router.post("/{swimmer_id}/cancel-sync")
async def cancel_swimmer_sync(
    swimmer_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """
    Cancel an in-progress sync for a swimmer
    
    Args:
        swimmer_id: Swimmer ID
        user_id: Authenticated user ID
    
    Returns:
        Cancellation status
    """
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

