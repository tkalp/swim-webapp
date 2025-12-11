# backend/app/routes/swimmers.py (REFACTORED)
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks, Depends, Request
from typing import Optional, Dict, Any, List
from pydantic import BaseModel

from app.services.swimmer_service import SwimmerService
from app.services.performance_service import PerformanceService
from app.services.prediction_service import PredictionService
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
from datetime import datetime, timedelta

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
    squad_id: Optional[str] = Query(None),
    include_stats: bool = Query(False),
    user_id: str = Depends(get_current_user_id)
) -> List[Dict[str, Any]]:
    """Get all swimmers for the authenticated user. Set include_stats=true for enhanced data."""
    try:
        swimmer_service = SwimmerService()
        
        # Filter by squad if provided
        if squad_id:
            supabase = get_supabase_client()
            swimmers_result = supabase.table('swimmers').select(
                'id, first_name, last_name, date_of_birth, sex, created_at, squad_id'
            ).eq('squad_id', squad_id).execute()
            swimmers = swimmers_result.data or []
        else:
            swimmers = swimmer_service.get_swimmers_for_user(user_id)
        
        if include_stats and swimmers:
            supabase = get_supabase_client()
            thirty_days_ago = (datetime.now() - timedelta(days=30)).isoformat()
            
            # Get swimmer IDs
            swimmer_ids = [s['id'] for s in swimmers]
            
            # Batch get last activities - use IN clause for efficiency
            last_activities_result = supabase.table('workout_result').select(
                'swimmer_id, created_at'
            ).in_('swimmer_id', swimmer_ids).order('created_at', desc=True).execute()
            
            # Get most recent for each swimmer
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
                swimmer_attendance = [a for a in (attendance_result.data or []) if a['swimmer_id'] == sid]
                if swimmer_attendance:
                    total = len(swimmer_attendance)
                    present = sum(1 for a in swimmer_attendance if a.get('status') and a['status'].lower() == 'present')
                    attendance_rates[sid] = round((present / total * 100), 1) if total > 0 else 0
                else:
                    attendance_rates[sid] = 0
            
            # Check for external tracking
            external_links_result = supabase.table('swimmer_external_links').select(
                'swimmer_id'
            ).in_('swimmer_id', swimmer_ids).execute()
            has_tracking = {row['swimmer_id'] for row in (external_links_result.data or [])}
            
            # Enhance each swimmer
            for swimmer in swimmers:
                sid = swimmer['id']
                swimmer['last_activity'] = last_activities.get(sid)
                swimmer['recent_pr_count'] = 0  # PRs require complex RPC calculation, disabled for now
                swimmer['attendance_rate'] = attendance_rates.get(sid, 0)
                swimmer['has_external_tracking'] = sid in has_tracking
        
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
    """Get swimmer with enhanced stats (last activity, recent PRs, attendance, etc)."""
    try:
        swimmer_service = SwimmerService()
        supabase = get_supabase_client()
        
        # Get base swimmer data
        swimmer = swimmer_service.get_swimmer(swimmer_id, user_id=user_id, include_external_link=True)
        
        # Get last activity (most recent workout result)
        last_activity_result = supabase.table('workout_result').select(
            'created_at'
        ).eq('swimmer_id', swimmer_id).order('created_at', desc=True).limit(1).execute()
        
        last_activity = last_activity_result.data[0]['created_at'] if last_activity_result.data else None
        
        # Get attendance rate (last 30 days)
        thirty_days_ago = (datetime.now() - timedelta(days=30)).isoformat()
        attendance_result = supabase.table('training_attendance').select(
            'status'
        ).eq('swimmer_id', swimmer_id).gte('created_at', thirty_days_ago).execute()
        
        if attendance_result.data:
            total_sessions = len(attendance_result.data)
            present_sessions = sum(1 for a in attendance_result.data if a.get('status') and a['status'].lower() == 'present')
            attendance_rate = (present_sessions / total_sessions * 100) if total_sessions > 0 else 0
        else:
            attendance_rate = 0
        
        # Check if has external tracking
        has_external_tracking = swimmer.get('external_link') is not None
        
        # Add enhanced fields
        swimmer['last_activity'] = last_activity
        swimmer['recent_pr_count'] = 0  # PRs require complex RPC calculation, disabled for now
        swimmer['attendance_rate'] = round(attendance_rate, 1)
        swimmer['has_external_tracking'] = has_external_tracking
        
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


@router.get("/{swimmer_id}/predictions")
async def get_swimmer_predictions(
    swimmer_id: str,
    attempts_until_target: int = Query(default=3, description="Number of future attempts to predict"),
    min_attempts: int = Query(default=3, description="Minimum attempts required for prediction"),
    user_id: str = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """
    Get improvement predictions for a swimmer's events.
    
    Returns predicted future times based on historical performance trends.
    Only events with sufficient data (min_attempts) will have predictions.
    Includes attendance data if available to improve prediction accuracy.
    """
    try:
        performance_service = PerformanceService()
        supabase = get_supabase_client()
        
        # Verify swimmer exists and user has permission
        swimmer_check = supabase.table('swimmers').select('id, squad_id, first_name, last_name').eq('id', swimmer_id).execute()
        
        if not swimmer_check.data:
            raise HTTPException(status_code=404, detail="Swimmer not found")
        
        swimmer = swimmer_check.data[0]
        squad_id = swimmer.get('squad_id')
        
        if squad_id:
            # Verify user has permission to this squad
            coach_check = supabase.table('coach_squads').select('id').eq(
                'squad_id', squad_id
            ).eq('coach_id', user_id).execute()
            
            if not coach_check.data:
                raise HTTPException(status_code=403, detail="Unauthorized to access this swimmer")
        
        # Fetch attendance data for last 30 days
        from datetime import datetime, timedelta
        thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).isoformat()
        
        attendance_result = supabase.table('training_attendance').select(
            'status'
        ).eq('swimmer_id', swimmer_id).gte('created_at', thirty_days_ago).execute()
        
        # Calculate attendance rate
        attendance_rate = None
        if attendance_result.data:
            total_sessions = len(attendance_result.data)
            present_sessions = sum(1 for a in attendance_result.data if a.get('status', '').lower() == 'present')
            if total_sessions > 0:
                attendance_rate = round((present_sessions / total_sessions * 100), 1)
        
        # Get all workout results for the swimmer
        results = performance_service.get_workout_results(
            swimmer_id=swimmer_id,
            user_id=user_id
        )
        
        # Group results by event key (distance_stroke_units_activity)
        from collections import defaultdict
        events_data = defaultdict(list)
        
        for result in results:
            # Build event key
            distance = str(result.get('distance', ''))
            stroke = result.get('stroke', '').lower()
            units = result.get('result_units', 'LCM')
            activity = result.get('activity', 'swim').lower()
            
            event_key = f"{distance}_{stroke}_{units}_{activity}"
            
            # Convert time_result interval to seconds
            time_result = result.get('time_result')
            performed_on = result.get('performed_on')
            
            if time_result and performed_on:
                try:
                    # Convert interval to seconds
                    time_seconds = interval_to_seconds(time_result)
                    
                    # Build event display name
                    event_display = f"{distance}m {stroke.title()} {activity.title()} {units}"
                    
                    events_data[event_key].append({
                        'time_seconds': time_seconds,
                        'performed_on': performed_on,
                        'event_display': event_display
                    })
                except Exception as e:
                    logger.warning(f"Failed to convert time_result '{time_result}' for event {event_key}: {e}")
                    continue
        
        # Fetch squad data for comparison if swimmer has squad_id
        squad_improvement_rates = {}
        if squad_id:
            try:
                # Get all swimmers in the squad
                squad_swimmers_response = supabase.table('swimmers').select('id').eq('squad_id', squad_id).execute()
                
                if squad_swimmers_response.data and len(squad_swimmers_response.data) > 1:
                    squad_member_ids = [s['id'] for s in squad_swimmers_response.data]
                    
                    # Get workout results for all squad members
                    squad_results_response = supabase.table('workout_result').select(
                        'swimmer_id, distance, stroke, activity, units, result_units, time_result, performed_on'
                    ).in_('swimmer_id', squad_member_ids).gte('performed_on', start_date).eq('activity', 'swim').order('performed_on', desc=False).execute()
                    
                    # Group by event and calculate squad average improvement rate
                    squad_events = defaultdict(lambda: defaultdict(list))
                    for result in squad_results_response.data:
                        event_key = f"{result['distance']}_{result['stroke']}_{result['activity']}_{result.get('result_units', 'SCM') or 'SCM'}"
                        time_seconds = interval_to_seconds(result['time_result'])
                        squad_events[event_key][result['swimmer_id']].append(time_seconds)
                    
                    # Calculate average improvement rate per event
                    for event_key, swimmers_times in squad_events.items():
                        rates = []
                        for swimmer_times in swimmers_times.values():
                            if len(swimmer_times) >= 2:
                                rate = PredictionService.calculate_improvement_per_attempt(swimmer_times)
                                rates.append(rate)
                        if rates:
                            squad_improvement_rates[event_key] = statistics.mean(rates)
            except Exception as squad_error:
                logger.warning(f"Failed to fetch squad comparison data: {squad_error}")
                # Continue without squad data
        
        # Generate predictions for each event with sufficient data
        predictions = []
        
        for event_key, event_results in events_data.items():
            if len(event_results) < min_attempts:
                continue
            
            # Sort by date to get chronological order
            sorted_results = sorted(event_results, key=lambda x: x['performed_on'])
            
            # Extract times in chronological order
            all_times = [r['time_seconds'] for r in sorted_results]
            current_best = min(all_times)
            event_display = sorted_results[0]['event_display']
            
            # Get squad improvement rate for this event if available
            squad_rate = squad_improvement_rates.get(event_key)
            
            # Fetch recent workouts for this swimmer (last 30 days)
            recent_workouts = []
            try:
                from app.services.prediction_service import WorkoutContext
                
                # Get sessions where this swimmer attended
                attendance_response = supabase.table('training_attendance').select(
                    'training_session_id, status'
                ).eq('swimmer_id', swimmer_id).execute()
                
                attended_session_ids = [
                    a['training_session_id'] for a in attendance_response.data 
                    if a.get('training_session_id') and a.get('status') == 'present'
                ] if attendance_response.data else []
                
                # Get training sessions with workouts for sessions the swimmer attended
                if attended_session_ids:
                    workouts_response = supabase.table('training_sessions').select(
                        'id, start_date, workout_id, workout_template(total_meters, effort_level, json_description)'
                    ).in_('id', attended_session_ids).gte(
                        'start_date', thirty_days_ago
                    ).execute()
                else:
                    workouts_response = None
                
                if workouts_response and workouts_response.data:
                    for session in workouts_response.data:
                        workout_template = session.get('workout_template')
                        if workout_template:
                            # Categorize workout type
                            effort_level = workout_template.get('effort_level')
                            json_desc = workout_template.get('json_description', {})
                            
                            # Simple categorization
                            if effort_level is not None:
                                if effort_level >= 7:
                                    workout_type = 'sprint'
                                elif effort_level <= 4:
                                    workout_type = 'endurance'
                                elif effort_level in [5, 6]:
                                    # Check for technique focus
                                    if isinstance(json_desc, dict):
                                        activity_breakdown = json_desc.get('activity_breakdown', {})
                                        drill_pct = activity_breakdown.get('Drill', 0)
                                        if drill_pct > 30:
                                            workout_type = 'technique'
                                        else:
                                            workout_type = 'mixed'
                                    else:
                                        workout_type = 'mixed'
                                else:
                                    workout_type = 'mixed'
                            else:
                                workout_type = 'mixed'
                            
                            recent_workouts.append(WorkoutContext(
                                total_meters=workout_template.get('total_meters', 0),
                                effort_level=effort_level,
                                session_date=session['start_date'],
                                workout_type=workout_type
                            ))
            except Exception as workout_error:
                logger.warning(f"Failed to fetch workout context: {workout_error}")
                # Continue without workout data
            
            # Generate prediction
            prediction = PredictionService.predict_improvement(
                event=event_display,
                current_best=current_best,
                all_times=all_times,
                attempts_until_target=attempts_until_target,
                attendance_rate=attendance_rate,
                squad_improvement_rate=squad_rate,
                recent_workouts=recent_workouts if recent_workouts else None
            )
            
            predictions.append({
                'event_key': event_key,
                'event': prediction.event,
                'current_best': prediction.current_best,
                'predicted_time': prediction.predicted_time,
                'confidence_level': prediction.confidence_level,
                'improvement_expected': prediction.improvement_expected,
                'factors': prediction.factors
            })
        
        # Sort predictions by current best time (fastest first within each distance)
        predictions.sort(key=lambda x: (
            int(x['event_key'].split('_')[0]) if x['event_key'].split('_')[0].isdigit() else 999,
            x['current_best']
        ))
        
        return {
            'swimmer_id': swimmer_id,
            'swimmer_name': f"{swimmer['first_name']} {swimmer['last_name']}",
            'attempts_until_target': attempts_until_target,
            'predictions': predictions,
            'total_events_analyzed': len(predictions),
            'attendance_rate': attendance_rate,  # Include attendance in response
            'metadata': {
                'min_attempts_required': min_attempts,
                'total_events_with_data': len(events_data),
                'events_with_insufficient_data': len([e for e in events_data.values() if len(e) < min_attempts]),
                'attendance_days_analyzed': 30,
                'attendance_included': attendance_rate is not None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating predictions for swimmer {swimmer_id}: {str(e)}")
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
