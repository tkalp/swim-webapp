# backend/app/routes/training_sessions.py
from fastapi import APIRouter, HTTPException, Query, Body
from typing import Optional, List
from datetime import datetime, timedelta
from collections import defaultdict
import pytz
from pydantic import BaseModel

from app.infrastructure.database import get_supabase_client
from app.services.session_service import materialize_session, cleanup_virtual_sessions
from app.utils import logger

router = APIRouter(prefix="/training-sessions", tags=["training-sessions"])


class MaterializeSessionRequest(BaseModel):
    squad_id: str
    start_date: str
    end_date: str
    training_type: str
    workout_id: Optional[str] = None


class CleanupRequest(BaseModel):
    squad_id: str
    schedule_id: Optional[str] = None


@router.get("/virtual")
async def get_virtual_sessions(
    squad_id: str = Query(..., description="Squad ID to fetch sessions for"),
    from_date: Optional[str] = Query(None, description="Start date (ISO format, default: -30 days)"),
    to_date: Optional[str] = Query(None, description="End date (ISO format, default: +90 days)")
):
    """
    Get both materialized and virtual training sessions for a squad.
    
    Virtual sessions are calculated from training_schedules on-the-fly.
    Materialized sessions are fetched from training_sessions table.
    
    Returns unified array with is_virtual flag to distinguish between the two.
    """
    try:
        supabase = get_supabase_client()
        
        # Parse date range
        if not from_date:
            start_dt = datetime.utcnow() - timedelta(days=30)
        else:
            # Handle various ISO formats including .000Z
            from_date_clean = from_date.replace('Z', '+00:00').split('.')[0] + '+00:00' if '.' in from_date else from_date.replace('Z', '+00:00')
            start_dt = datetime.fromisoformat(from_date_clean)
            
        if not to_date:
            end_dt = datetime.utcnow() + timedelta(days=90)
        else:
            # Handle various ISO formats including .000Z
            to_date_clean = to_date.replace('Z', '+00:00').split('.')[0] + '+00:00' if '.' in to_date else to_date.replace('Z', '+00:00')
            end_dt = datetime.fromisoformat(to_date_clean)
        
        logger.info(f"Fetching virtual sessions for squad {squad_id} from {start_dt.date().isoformat()} to {end_dt.date().isoformat()}")
        
        # Fetch materialized sessions from database
        materialized_response = supabase.table('training_sessions')\
            .select('*')\
            .eq('squad_id', squad_id)\
            .gte('start_date', f"{from_date}T00:00:00Z")\
            .lte('start_date', f"{to_date}T23:59:59Z")\
            .execute()
        
        materialized_sessions = materialized_response.data or []
        
        # Create lookup for materialized sessions
        # We need to match based on the LOCAL date + time since schedules are in local time
        # Key format: "squad_id_YYYY-MM-DD_HH:MM" in local time
        materialized_lookup = {}
        for session in materialized_sessions:
            session_start = datetime.fromisoformat(session['start_date'].replace('Z', '+00:00'))
            
            session_date = session_start.date().isoformat()
            key = f"{session['squad_id']}_{session_date}"
            
            if key not in materialized_lookup:
                materialized_lookup[key] = []
            materialized_lookup[key].append(session)
        
        # Fetch active schedules for squad
        schedules_response = supabase.table('training_schedules')\
            .select('*')\
            .eq('squad_id', squad_id)\
            .eq('active', True)\
            .execute()
        
        schedules = schedules_response.data or []
        
        if not schedules:
            # No schedules, return only materialized sessions
            for session in materialized_sessions:
                session['is_virtual'] = False
            return {
                'success': True,
                'sessions': materialized_sessions,
                'count': len(materialized_sessions)
            }
        
        # Calculate virtual sessions from schedules
        virtual_sessions = []
        current_date = start_dt.date()
        end_date_obj = end_dt.date()
        
        while current_date <= end_date_obj:
            day_of_week = current_date.strftime('%A')
            
            # Find schedules for this day
            for schedule in schedules:
                if schedule['day_of_week'] == day_of_week:
                    # Get timezone from schedule
                    tz_name = schedule.get('created_timezone', 'America/Denver')
                    local_tz = pytz.timezone(tz_name)
                    
                    # Create naive local datetime for this day + local start time
                    local_start_parts = schedule['start_time'].split(':')
                    local_end_parts = schedule['end_time'].split(':')
                    
                    naive_local_start = datetime(
                        current_date.year,
                        current_date.month,
                        current_date.day,
                        int(local_start_parts[0]),
                        int(local_start_parts[1]),
                        0
                    )
                    
                    naive_local_end = datetime(
                        current_date.year,
                        current_date.month,
                        current_date.day,
                        int(local_end_parts[0]),
                        int(local_end_parts[1]),
                        0
                    )
                    
                    # Localize to the timezone and convert to UTC
                    session_start = local_tz.localize(naive_local_start).astimezone(pytz.UTC)
                    session_end = local_tz.localize(naive_local_end).astimezone(pytz.UTC)
                    
                    # Handle cases where end time is past midnight (next day in local time)
                    if session_end <= session_start:
                        session_end += timedelta(days=1)
                    
                    # Check if this session time already exists in materialized sessions
                    # Use the UTC date for lookup
                    utc_date = session_start.date().isoformat()
                    lookup_key = f"{squad_id}_{utc_date}"
                    
                    # Check if already materialized by comparing times
                    already_materialized = False
                    if lookup_key in materialized_lookup:
                        for mat_session in materialized_lookup[lookup_key]:
                            mat_start = datetime.fromisoformat(mat_session['start_date'].replace('Z', '+00:00'))
                            # If start times match within 1 minute, consider it the same session
                            if abs((mat_start - session_start).total_seconds()) < 60:
                                already_materialized = True
                                break
                    
                    if not already_materialized:
                        virtual_session = {
                            'id': f"virtual_{squad_id}_{session_start.isoformat()}",  # Temporary ID
                            'squad_id': squad_id,
                            'start_date': session_start.isoformat(),
                            'end_date': session_end.isoformat(),
                            'workout_id': None,
                            'training_type': schedule['training_type'],
                            'created_at': None,
                            'is_virtual': True,
                            'schedule_id': schedule['id']  # Reference to source schedule
                        }
                        
                        virtual_sessions.append(virtual_session)
            
            current_date += timedelta(days=1)
        
        # Mark materialized sessions
        for session in materialized_sessions:
            session['is_virtual'] = False
        
        # Merge and sort all sessions
        all_sessions = materialized_sessions + virtual_sessions
        all_sessions.sort(key=lambda x: x['start_date'])
        
        logger.info(f"Returning {len(materialized_sessions)} materialized + {len(virtual_sessions)} virtual = {len(all_sessions)} total sessions")
        
        return {
            'success': True,
            'sessions': all_sessions,
            'count': len(all_sessions),
            'materialized_count': len(materialized_sessions),
            'virtual_count': len(virtual_sessions)
        }
        
    except Exception as e:
        logger.error(f"Error fetching virtual sessions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/materialize")
async def materialize_virtual_session(request: MaterializeSessionRequest):
    """
    Materialize a virtual session into a real database record.
    
    Called when:
    - Coach assigns a workout to virtual session
    - Coach takes attendance for virtual session
    - Any action that requires a real session ID
    """
    try:
        session = materialize_session(
            squad_id=request.squad_id,
            start_date=request.start_date,
            end_date=request.end_date,
            training_type=request.training_type,
            workout_id=request.workout_id
        )
        
        return {
            'success': True,
            'session': session
        }
        
    except Exception as e:
        logger.error(f"Error materializing session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/virtual-cleanup")
async def cleanup_virtual(request: CleanupRequest):
    """
    Clean up future non-materialized sessions.
    
    Called when a schedule is updated to force recalculation of future sessions.
    Deletes sessions that have no workout and no attendance.
    """
    try:
        deleted_count = cleanup_virtual_sessions(
            squad_id=request.squad_id,
            schedule_id=request.schedule_id
        )
        
        return {
            'success': True,
            'deleted_count': deleted_count
        }
        
    except Exception as e:
        logger.error(f"Error cleaning up virtual sessions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
