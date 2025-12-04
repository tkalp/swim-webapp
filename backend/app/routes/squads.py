# backend/app/routes/squads.py
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List, Dict
from datetime import datetime, timedelta
from collections import defaultdict
import statistics

from app.infrastructure.database import get_supabase_client
from app.middleware.auth import get_current_user_id
from app.utils import logger, log_error
from app.services.performance_service import PerformanceService

router = APIRouter(prefix="/squads", tags=["squads"])


def get_sessions_with_workouts(supabase, squad_id: str, start_date: Optional[str], end_date: Optional[str]):
    """
    Helper function to fetch sessions with workout data in a single query.
    Returns sessions with embedded workout_template data.
    """
    query = supabase.table('training_sessions')\
        .select('id, start_date, workout_id, workout_template!left(id, total_meters, json_description)')\
        .eq('squad_id', squad_id)
    
    if start_date:
        query = query.gte('start_date', start_date)
    if end_date:
        query = query.lte('start_date', end_date)
    
    return query.execute()


def get_iso_week(date_obj: datetime) -> tuple[int, int]:
    """
    Get ISO week year and week number for a date.
    ISO weeks start on Monday, and week 1 contains the first Thursday.
    """
    # Ensure we're working with naive datetime (strip timezone if present)
    if date_obj.tzinfo is not None:
        date_obj = date_obj.replace(tzinfo=None)
    
    # Find the Thursday of the current week
    day_of_week = date_obj.weekday()  # Monday = 0
    thursday = date_obj + timedelta(days=(3 - day_of_week))
    
    # Week 1 is the week containing the first Thursday
    year = thursday.year
    jan4 = datetime(year, 1, 4)
    jan4_weekday = jan4.weekday()
    
    # Get Monday of week 1
    week1_monday = jan4 - timedelta(days=jan4_weekday)
    
    # Calculate week number
    days_diff = (date_obj - week1_monday).days
    week_num = (days_diff // 7) + 1
    
    return (year, week_num)


def format_week_label(year: int, week: int) -> str:
    """Convert ISO week to display label like 'Jan 6–12, 2025'"""
    # Find January 4th (always in week 1)
    jan4 = datetime(year, 1, 4)
    jan4_weekday = jan4.weekday()
    
    # Get Monday of week 1
    week1_monday = jan4 - timedelta(days=jan4_weekday)
    
    # Add weeks to get target week's Monday
    target_monday = week1_monday + timedelta(weeks=(week - 1))
    target_sunday = target_monday + timedelta(days=6)
    
    # Format as "Jan 6–12, 2025" or "Dec 30 – Jan 5, 2025"
    if target_monday.month == target_sunday.month:
        return f"{target_monday.strftime('%b')} {target_monday.day}–{target_sunday.day}, {target_monday.year}"
    else:
        return f"{target_monday.strftime('%b %d')} – {target_sunday.strftime('%b %d')}, {target_monday.year}"


@router.get("/{squad_id}/metrics/session-count")
async def get_squad_session_count(
    squad_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user_id: str = Depends(get_current_user_id)
):
    """Get total number of training sessions for a squad in a date range."""
    try:
        supabase = get_supabase_client()
        
        query = supabase.table('training_sessions')\
            .select('id', count='exact')\
            .eq('squad_id', squad_id)
        
        if start_date:
            query = query.gte('start_date', start_date)
        if end_date:
            query = query.lte('start_date', end_date)
        
        result = query.execute()
        return {"count": result.count or 0}
        
    except Exception as e:
        logger.error(f"Error fetching session count: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{squad_id}/metrics/total-meters")
async def get_squad_total_meters(
    squad_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user_id: str = Depends(get_current_user_id)
):
    """Get total meters swum across all sessions in a date range."""
    try:
        supabase = get_supabase_client()
        sessions = get_sessions_with_workouts(supabase, squad_id, start_date, end_date)
        
        if not sessions.data:
            return {"total_meters": 0}
        
        # Sum meters from joined workout data
        total = 0
        for session in sessions.data:
            workout = session.get('workout_template')
            if workout and isinstance(workout, dict):
                total += workout.get('total_meters', 0) or 0
        
        return {"total_meters": total}
        
    except Exception as e:
        logger.error(f"Error fetching total meters: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{squad_id}/metrics/attendance-stats")
async def get_squad_attendance_stats(
    squad_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user_id: str = Depends(get_current_user_id)
):
    """Get attendance breakdown (present/late/absent counts)."""
    try:
        supabase = get_supabase_client()
        
        # Get sessions in date range
        session_query = supabase.table('training_sessions')\
            .select('id')\
            .eq('squad_id', squad_id)
        
        if start_date:
            session_query = session_query.gte('start_date', start_date)
        if end_date:
            session_query = session_query.lte('start_date', end_date)
        
        sessions = session_query.execute()
        
        if not sessions.data:
            return {"present": 0, "late": 0, "absent": 0}
        
        session_ids = [s['id'] for s in sessions.data]
        
        # Get attendance records
        attendance = supabase.table('training_attendance')\
            .select('status')\
            .in_('training_session_id', session_ids)\
            .execute()
        
        counts = {"present": 0, "late": 0, "absent": 0}
        
        for record in attendance.data:
            status = (record.get('status') or '').lower()
            if status == 'present':
                counts['present'] += 1
            elif status == 'late':
                counts['late'] += 1
            elif status == 'absent':
                counts['absent'] += 1
        
        return counts
        
    except Exception as e:
        logger.error(f"Error fetching attendance stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{squad_id}/metrics/distance-per-week")
async def get_squad_distance_per_week(
    squad_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user_id: str = Depends(get_current_user_id)
):
    """Get weekly distance breakdown using ISO weeks (Monday-Sunday)."""
    try:
        supabase = get_supabase_client()
        sessions = get_sessions_with_workouts(supabase, squad_id, start_date, end_date)
        
        if not sessions.data:
            return {"weeks": []}
        
        # Parse date range boundaries for filtering
        # Handle both date strings with and without time components
        filter_start = None
        filter_end = None
        if start_date:
            # Parse and extract just the date part (ignore time/timezone)
            date_str = start_date.replace('Z', '').split('T')[0]
            filter_start = datetime.fromisoformat(date_str)
        if end_date:
            # Parse and extract just the date part (ignore time/timezone)
            date_str = end_date.replace('Z', '').split('T')[0]
            filter_end = datetime.fromisoformat(date_str)
        
        # Group by ISO week
        week_totals = defaultdict(int)
        
        for session in sessions.data:
            workout = session.get('workout_template')
            if not workout or not isinstance(workout, dict):
                continue
            
            meters = workout.get('total_meters', 0) or 0
            # Parse date and strip timezone for ISO week calculation
            session_date_str = session['start_date'].replace('Z', '').replace('+00:00', '')
            session_date = datetime.fromisoformat(session_date_str.split('+')[0].split('T')[0])
            
            # Skip sessions outside the date range (exclusive end date)
            if filter_start and session_date < filter_start:
                continue
            if filter_end and session_date > filter_end:
                continue
            
            year, week = get_iso_week(session_date)
            week_key = f"{year}-W{week:02d}"
            week_totals[week_key] += meters
        
        # Convert to list with formatted labels
        # For small date ranges (≤ 8 days), only show the week with the most days in the range
        result = []
        
        # Calculate if this is a small date range
        date_range_days = 0
        if filter_start and filter_end:
            date_range_days = (filter_end - filter_start).days + 1
        
        # For ranges of 8 days or less, find which week has the most overlap
        if date_range_days > 0 and date_range_days <= 8:
            # Calculate overlap for each week
            week_overlaps = {}
            for week_key in week_totals.keys():
                year, week = int(week_key.split('-W')[0]), int(week_key.split('-W')[1])
                jan4 = datetime(year, 1, 4)
                jan4_weekday = jan4.weekday()
                week1_monday = jan4 - timedelta(days=jan4_weekday)
                week_monday = week1_monday + timedelta(weeks=(week - 1))
                week_sunday = week_monday + timedelta(days=6)
                
                # Calculate how many days of this week are in the filter range
                overlap_start = max(week_monday, filter_start)
                overlap_end = min(week_sunday, filter_end)
                overlap_days = (overlap_end - overlap_start).days + 1 if overlap_end >= overlap_start else 0
                week_overlaps[week_key] = overlap_days
            
            # Only include the week with maximum overlap
            if week_overlaps:
                best_week = max(week_overlaps.items(), key=lambda x: x[1])[0]
                year, week = int(best_week.split('-W')[0]), int(best_week.split('-W')[1])
                label = format_week_label(year, week)
                result.append({
                    "week": label,
                    "meters": week_totals[best_week]
                })
        else:
            # For longer ranges, include all weeks that overlap
            for week_key in sorted(week_totals.keys()):
                year, week = int(week_key.split('-W')[0]), int(week_key.split('-W')[1])
                jan4 = datetime(year, 1, 4)
                jan4_weekday = jan4.weekday()
                week1_monday = jan4 - timedelta(days=jan4_weekday)
                week_monday = week1_monday + timedelta(weeks=(week - 1))
                week_sunday = week_monday + timedelta(days=6)
                
                # Include weeks that overlap with the date range
                if filter_end and week_monday > filter_end:
                    continue
                if filter_start and week_sunday < filter_start:
                    continue
                
                label = format_week_label(year, week)
                result.append({
                    "week": label,
                    "meters": week_totals[week_key]
                })
        
        return {"weeks": result}
        
    except Exception as e:
        logger.error(f"Error fetching distance per week: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{squad_id}/metrics/distance-per-day")
async def get_squad_distance_per_day(
    squad_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    timezone_offset: Optional[int] = None,  # offset in minutes from UTC
    user_id: str = Depends(get_current_user_id)
):
    """
    Get daily distance breakdown.
    
    Args:
        timezone_offset: Browser timezone offset in minutes (e.g., -300 for EST/UTC-5)
                        Used to group sessions by local date instead of UTC date
    """
    try:
        supabase = get_supabase_client()
        sessions = get_sessions_with_workouts(supabase, squad_id, start_date, end_date)
        
        if not sessions.data:
            return {"days": []}
        
        # Parse date range boundaries for filtering (keep full timestamp for accurate comparison)
        filter_start = None
        filter_end = None
        if start_date:
            filter_start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        if end_date:
            filter_end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        
        # Calculate timezone adjustment (default to UTC if not provided)
        tz_delta = timedelta(minutes=-(timezone_offset or 0))
        
        # Group by day
        day_totals = defaultdict(int)
        
        for session in sessions.data:
            workout = session.get('workout_template')
            if not workout or not isinstance(workout, dict):
                continue
            
            meters = workout.get('total_meters', 0) or 0
            # Parse the full timestamp (UTC)
            session_datetime_utc = datetime.fromisoformat(session['start_date'].replace('Z', '+00:00'))
            
            # Skip sessions outside the date range (compare full timestamps)
            if filter_start and session_datetime_utc < filter_start:
                continue
            if filter_end and session_datetime_utc > filter_end:
                continue
            
            # Convert to local time for grouping by day
            session_datetime_local = session_datetime_utc + tz_delta
            
            # Extract local date for grouping
            day_key = session_datetime_local.strftime('%Y-%m-%d')
            day_totals[day_key] += meters
        
        # Convert to list with formatted labels
        result = []
        for day_key in sorted(day_totals.keys()):
            day_date = datetime.fromisoformat(day_key)
            # Format as "Mon 12/4" or "Mon, Dec 4"
            label = day_date.strftime('%a %m/%d')
            result.append({
                "day": label,
                "meters": day_totals[day_key]
            })
        
        return {"days": result}
        
    except Exception as e:
        logger.error(f"Error fetching distance per day: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{squad_id}/metrics/stroke-breakdown")
async def get_squad_stroke_breakdown(
    squad_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user_id: str = Depends(get_current_user_id)
):
    """Get breakdown of meters by stroke type."""
    try:
        supabase = get_supabase_client()
        sessions = get_sessions_with_workouts(supabase, squad_id, start_date, end_date)
        
        if not sessions.data:
            return {"strokes": []}
        
        stroke_totals = defaultdict(int)
        
        # Parse JSON descriptions to get stroke breakdown
        for session in sessions.data:
            workout = session.get('workout_template')
            if not workout or not isinstance(workout, dict):
                continue
                
            json_desc = workout.get('json_description')
            if not json_desc:
                continue
            
            try:
                # Check if it's the new versioned format
                if 'version' in json_desc and 'analysis' in json_desc:
                    breakdown = json_desc['analysis'].get('stroke_breakdown', {})
                # Check if it's the old estimate format
                elif 'estimate' in json_desc:
                    breakdown = json_desc['estimate'].get('strokeBreakdown', {})
                else:
                    continue
                
                # Aggregate stroke totals
                for stroke, meters in breakdown.items():
                    # Skip total key
                    if stroke.lower() == 'total':
                        continue
                    if isinstance(meters, (int, float)) and meters > 0:
                        # Normalize stroke names
                        stroke_key = stroke.lower().replace('_', ' ')
                        if stroke_key in ['im', 'individual medley', 'individualmedley']:
                            stroke_key = 'individual medley'
                        stroke_totals[stroke_key] += meters
            except Exception as e:
                logger.warning(f"Error parsing workout JSON: {e}")
                continue
        
        # Color mapping
        stroke_colors = {
            'freestyle': '#06B6D4',  # Vibrant cyan
            'backstroke': '#8B5CF6',  # Vibrant purple
            'breaststroke': '#10B981',  # Vibrant emerald
            'butterfly': '#F59E0B',  # Vibrant amber
            'individual medley': '#EC4899',  # Vibrant pink
            'choice': '#A78BFA'  # Light purple
        }
        
        result = [
            {
                "stroke": stroke.title().replace('Individual medley', 'Individual Medley'),
                "meters": meters,
                "color": stroke_colors.get(stroke, '#A78BFA')
            }
            for stroke, meters in sorted(stroke_totals.items(), key=lambda x: -x[1])
        ]
        
        return {"strokes": result}
        
    except Exception as e:
        logger.error(f"Error fetching stroke breakdown: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{squad_id}/metrics/activity-breakdown")
async def get_squad_activity_breakdown(
    squad_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user_id: str = Depends(get_current_user_id)
):
    """Get breakdown of meters by activity type (swim/kick/pull/drill)."""
    try:
        supabase = get_supabase_client()
        sessions = get_sessions_with_workouts(supabase, squad_id, start_date, end_date)
        
        if not sessions.data:
            return {"activities": []}
        
        activity_totals = defaultdict(int)
        
        # Parse JSON descriptions to get activity breakdown
        for session in sessions.data:
            workout = session.get('workout_template')
            if not workout or not isinstance(workout, dict):
                continue
                
            json_desc = workout.get('json_description')
            if not json_desc:
                continue
            
            try:
                # Check if it's the new versioned format
                if 'version' in json_desc and 'analysis' in json_desc:
                    breakdown = json_desc['analysis'].get('activity_breakdown', {})
                # Check if it's the old estimate format
                elif 'estimate' in json_desc:
                    breakdown = json_desc['estimate'].get('activityBreakdown', {})
                else:
                    continue
                
                # Aggregate activity totals
                for activity, meters in breakdown.items():
                    # Skip total key
                    if activity.lower() == 'total':
                        continue
                    if isinstance(meters, (int, float)) and meters > 0:
                        activity_totals[activity.lower()] += meters
            except Exception as e:
                logger.warning(f"Error parsing workout JSON: {e}")
                continue
        
        # Color mapping
        activity_colors = {
            'swim': '#22D3EE',
            'kick': '#EF4444',
            'pull': '#10B981',
            'drill': '#F59E0B'
        }
        
        result = [
            {
                "activity": activity.title(),
                "meters": meters,
                "color": activity_colors.get(activity, '#6B7280')
            }
            for activity, meters in sorted(activity_totals.items(), key=lambda x: -x[1])
        ]
        
        return {"activities": result}
        
    except Exception as e:
        logger.error(f"Error fetching activity breakdown: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{squad_id}/performance")
async def get_squad_performance(
    squad_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user_id: str = Depends(get_current_user_id)
):
    """
    Get performance analytics for all swimmers in a squad over a date range.
    
    Returns improvement metrics, best times trends, and performance statistics
    for each swimmer in the squad.
    """
    try:
        supabase = get_supabase_client()
        logger.info(f"User {user_id} fetching squad performance | squad_id={squad_id} | date_range={start_date} to {end_date}")
        
        # Parse and validate dates
        if not start_date:
            # Default to 90 days ago
            start_dt = datetime.now() - timedelta(days=90)
            start_date = start_dt.strftime("%Y-%m-%d")
        else:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            
        if not end_date:
            end_date = datetime.now().strftime("%Y-%m-%d")
        else:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        
        logger.debug(f"Date range parsed | start={start_date} | end={end_date}")
        
        # Verify squad exists and get squad info
        squad_response = supabase.table('squads').select('id, name').eq('id', squad_id).execute()
        
        if not squad_response.data:
            raise HTTPException(status_code=404, detail="Squad not found")
        
        squad_info = squad_response.data[0]
        
        # Get all swimmers in the squad
        swimmers_response = supabase.table('swimmers')\
            .select('id, first_name, last_name')\
            .eq('squad_id', squad_id)\
            .execute()
        
        if not swimmers_response.data:
            logger.warning(f"No swimmers found in squad {squad_id}")
            return {
                "squad": squad_info,
                "date_range": {"start": start_date, "end": end_date},
                "swimmers": [],
                "summary": {
                    "total_swimmers": 0,
                    "avg_improvement": 0,
                    "total_prs": 0,
                    "most_improved": None
                }
            }
        
        swimmer_ids = [s['id'] for s in swimmers_response.data]
        logger.debug(f"Found {len(swimmer_ids)} swimmers in squad")
        
        # Get all workout results for these swimmers within date range
        results_response = supabase.table('workout_result')\
            .select('id, swimmer_id, performed_on, time_result, distance, stroke, activity, units, equipment, result_units')\
            .in_('swimmer_id', swimmer_ids)\
            .gte('performed_on', start_date)\
            .lte('performed_on', end_date)\
            .eq("activity", "swim")\
            .order('performed_on', desc=False)\
            .execute()
        
        logger.debug(f"Found {len(results_response.data)} workout results in date range")
        
        # Group results by swimmer and event
        swimmer_data = defaultdict(lambda: {
            'swimmer_id': None,
            'swimmer_name': None,
            'events': defaultdict(list),
            'total_workouts': 0,
            'personal_records': 0,
            'improvement_percentage': 0
        })
        
        # Build swimmer lookup
        swimmer_lookup = {}
        for s in swimmers_response.data:
            swimmer_lookup[s['id']] = f"{s['first_name']} {s['last_name']}"
        
        logger.debug("Processing results...")
        # Process results
        for result in results_response.data:
            swimmer_id = result['swimmer_id']
            
            # Skip results with missing critical data
            if not result.get('stroke') or not result.get('activity') or not result.get('distance'):
                logger.debug(f"Skipping result with missing data: {result.get('id')}")
                continue
            
            # Build event key - include result_units (SCM/LCM) to separate short course from long course
            result_units = result.get('result_units', 'SCM') or 'SCM'
            event_key = f"{result['distance']}M_{result['stroke']}_{result['activity']}_{result_units}"
            if result['equipment'] and result['equipment'] != 'none':
                event_key += f"_{result['equipment']}"
            
            # Parse time to seconds
            time_seconds = _time_to_seconds(result['time_result'])
            
            swimmer_data[swimmer_id]['swimmer_id'] = swimmer_id
            swimmer_data[swimmer_id]['swimmer_name'] = swimmer_lookup.get(swimmer_id, 'Unknown')
            swimmer_data[swimmer_id]['total_workouts'] += 1
            swimmer_data[swimmer_id]['events'][event_key].append({
                'date': result['performed_on'],
                'time_seconds': time_seconds,
                'time_display': result['time_result'],
                'distance': result['distance'],
                'stroke': result['stroke'],
                'activity': result['activity'],
                'units': result['units'],
                'result_units': result_units
            })
        
        # Calculate metrics for each swimmer
        swimmers_performance = []
        total_improvement = 0
        improvement_count = 0
        total_prs = 0
        
        for swimmer_id, data in swimmer_data.items():
            events_summary = []
            swimmer_prs = 0
            swimmer_improvements = []
            
            for event_key, attempts in data['events'].items():
                if len(attempts) < 2:
                    continue  # Need at least 2 attempts to calculate improvement
                
                # Sort by date
                sorted_attempts = sorted(attempts, key=lambda x: x['date'])
                
                # Get first and best times
                first_time = sorted_attempts[0]['time_seconds']
                best_time = min(a['time_seconds'] for a in sorted_attempts)
                latest_time = sorted_attempts[-1]['time_seconds']
                
                # Skip if invalid times
                if first_time == 0 or latest_time == 0 or best_time == 0:
                    continue
                
                # Calculate improvement (negative = faster = better)
                # Compare first time to best time (not latest)
                improvement = ((best_time - first_time) / first_time) * 100
                
                # Count PRs (personal records) - number of times swimmer beat their previous best
                best_so_far = float('inf')
                prs_in_event = 0
                for attempt in sorted_attempts:
                    if attempt['time_seconds'] < best_so_far:
                        # Only count as PR if this isn't the first attempt
                        if best_so_far != float('inf'):
                            prs_in_event += 1
                        best_so_far = attempt['time_seconds']
                
                swimmer_prs += prs_in_event
                
                # Track all improvements (positive or negative)
                swimmer_improvements.append(improvement)
                
                # Get activity and stroke from first attempt (they're all the same for this event)
                first_attempt = sorted_attempts[0]
                
                # Calculate per-event consistency (how stable are the times in this event)
                attempt_times = [a['time_seconds'] for a in sorted_attempts]
                event_consistency = PerformanceService.calculate_per_event_consistency(attempt_times)
                
                # Calculate weighted improvement for this event
                event_weighted_improvement = PerformanceService.calculate_weighted_improvement(
                    [{'date': a['date'], 'time': a['time_seconds']} for a in sorted_attempts],
                    first_time
                )
                
                # Calculate trend velocity for this event
                event_trend_velocity = PerformanceService.calculate_trend_velocity(
                    [{'date': a['date'], 'time': a['time_seconds']} for a in sorted_attempts]
                )
                
                events_summary.append({
                    'event': event_key,
                    'attempts': len(sorted_attempts),
                    'first_time': first_time,
                    'best_time': best_time,
                    'latest_time': latest_time,
                    'improvement_pct': improvement,
                    'personal_records': prs_in_event,
                    'activity': first_attempt['activity'],
                    'stroke': first_attempt['stroke'],
                    'result_units': first_attempt['result_units'],
                    'consistency_score': event_consistency,
                    'weighted_improvement_pct': event_weighted_improvement,
                    'trend_velocity_per_day': event_trend_velocity,
                    'timeline': [{'date': a['date'], 'time': a['time_seconds']} for a in sorted_attempts]
                })
            
            # Calculate average improvement for swimmer (negative = faster)
            avg_improvement = sum(swimmer_improvements) / len(swimmer_improvements) if swimmer_improvements else 0
            # Find best improvement (most negative value = biggest improvement)
            best_improvement = min(swimmer_improvements) if swimmer_improvements else 0
            
            # Calculate swimmer-level consistency as average of event-level consistency scores
            event_consistency_scores = [e.get('consistency_score', 0) for e in events_summary if e.get('consistency_score') is not None]
            swimmer_consistency = sum(event_consistency_scores) / len(event_consistency_scores) if event_consistency_scores else 0
            
            # Calculate swimmer-level weighted improvement as median of event-level weighted improvements
            event_weighted_improvements = [e.get('weighted_improvement_pct', 0) for e in events_summary if e.get('weighted_improvement_pct') is not None]
            overall_weighted_improvement = statistics.median(event_weighted_improvements) if event_weighted_improvements else 0
            
            # Calculate swimmer-level trend velocity as median of event-level trend velocities
            event_trend_velocities = [e.get('trend_velocity_per_day', 0) for e in events_summary if e.get('trend_velocity_per_day') is not None]
            overall_trend_velocity = statistics.median(event_trend_velocities) if event_trend_velocities else 0
            
            swimmers_performance.append({
                'swimmer_id': swimmer_id,
                'swimmer_name': data['swimmer_name'],
                'total_workouts': data['total_workouts'],
                'events_analyzed': len(events_summary),
                'personal_records': swimmer_prs,
                'avg_improvement_pct': avg_improvement,
                'best_improvement_pct': best_improvement,
                'consistency_score': swimmer_consistency,
                'weighted_improvement_pct': overall_weighted_improvement,
                'trend_velocity_per_day': overall_trend_velocity,
                'events': events_summary
            })
            
            # Only count improvements (negative values) for squad average
            if avg_improvement < 0:
                total_improvement += abs(avg_improvement)
                improvement_count += 1
            
            total_prs += swimmer_prs
        
        # Sort by improvement (most negative = most improved)
        swimmers_performance.sort(key=lambda x: x['avg_improvement_pct'], reverse=False)
        
        # Calculate squad summary metrics
        squad_avg_improvement = -total_improvement / improvement_count if improvement_count > 0 else 0
        most_improved = swimmers_performance[0] if swimmers_performance else None
        
        # Calculate squad-level consistency and trend
        squad_consistencies = [s['consistency_score'] for s in swimmers_performance if s.get('consistency_score', 0) > 0]
        squad_avg_consistency = sum(squad_consistencies) / len(squad_consistencies) if squad_consistencies else 0
        
        # NEW: Improved weighted improvement aggregation with outlier protection
        # Cap individual values at ±100% before aggregation to prevent extreme outliers
        def cap_improvement(value: float, cap: float = 100.0) -> float:
            if value is None:
                return 0.0
            return max(-cap, min(cap, value))
        
        capped_weighted_improvements = [cap_improvement(s['weighted_improvement_pct']) for s in swimmers_performance]
        
        # Use median instead of mean (more robust to outliers)
        squad_median_weighted_improvement = statistics.median(capped_weighted_improvements) if capped_weighted_improvements else 0
        
        # Calculate improvement distribution for actionable insights
        swimmers_improving = sum(1 for w in capped_weighted_improvements if w < -1)  # Improving by >1%
        swimmers_stable = sum(1 for w in capped_weighted_improvements if -1 <= w <= 1)  # Stable ±1%
        swimmers_regressing = sum(1 for w in capped_weighted_improvements if w > 1)  # Regressing by >1%
        
        # Calculate percentage improving
        total_analyzed = len(capped_weighted_improvements)
        percent_improving = (swimmers_improving / total_analyzed * 100) if total_analyzed > 0 else 0
        
        squad_trend_velocities = [s['trend_velocity_per_day'] for s in swimmers_performance if s.get('trend_velocity_per_day') is not None]
        squad_avg_trend_velocity = sum(squad_trend_velocities) / len(squad_trend_velocities) if squad_trend_velocities else 0
        
        logger.info(f"Squad performance calculated | swimmers={len(swimmers_performance)} | avg_improvement={squad_avg_improvement:.2f}% | consistency={squad_avg_consistency:.1f} | improving={swimmers_improving}/{total_analyzed}")
        
        return {
            "squad": squad_info,
            "date_range": {
                "start": start_date,
                "end": end_date
            },
            "swimmers": swimmers_performance,
            "summary": {
                "total_swimmers": len(swimmers_performance),
                "avg_improvement": squad_avg_improvement,
                "avg_consistency_score": round(squad_avg_consistency, 2),
                # NEW: Robust weighted improvement metric (median with ±100% caps)
                "median_weighted_improvement": round(squad_median_weighted_improvement, 2),
                # NEW: Distribution metrics for actionable insights
                "swimmers_improving_count": swimmers_improving,
                "swimmers_stable_count": swimmers_stable,
                "swimmers_regressing_count": swimmers_regressing,
                "percent_improving": round(percent_improving, 1),
                "avg_trend_velocity_per_day": round(squad_avg_trend_velocity, 4),
                "total_prs": total_prs,
                "most_improved": {
                    "swimmer_id": most_improved['swimmer_id'],
                    "swimmer_name": most_improved['swimmer_name'],
                    "improvement_pct": most_improved['avg_improvement_pct'],
                    "consistency_score": most_improved.get('consistency_score', 0)
                } if most_improved else None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching squad performance: {str(e)}")
        log_error(e, context="get_squad_performance", squad_id=squad_id)
        raise HTTPException(status_code=500, detail=f"Failed to fetch squad performance: {str(e)}")


def _time_to_seconds(time_str: str) -> float:
    """Convert time string (MM:SS.MS or SS.MS or interval format) to seconds"""
    if not time_str:
        return 0.0
    
    try:
        # Handle PostgreSQL interval format (e.g., "0:01:23.45" or "00:01:23.45")
        time_str = str(time_str).strip()
        
        # Remove any "days" prefix if present (e.g., "1 day, 0:01:23")
        if 'day' in time_str:
            parts = time_str.split(',')
            time_str = parts[-1].strip() if len(parts) > 1 else time_str
        
        # Split by colon
        parts = time_str.split(':')
        
        if len(parts) == 3:
            # HH:MM:SS.MS format (PostgreSQL interval)
            hours = int(parts[0])
            minutes = int(parts[1])
            seconds = float(parts[2])
            return hours * 3600 + minutes * 60 + seconds
        elif len(parts) == 2:
            # MM:SS.MS format
            minutes = int(parts[0])
            seconds = float(parts[1])
            return minutes * 60 + seconds
        else:
            # SS.MS format
            return float(parts[0])
    except Exception as e:
        logger.warning(f"Failed to parse time string '{time_str}': {e}")
        return 0.0


@router.get("/{squad_id}/attendance")
async def get_squad_attendance(
    squad_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user_id: str = Depends(get_current_user_id)
):
    """
    Get attendance analytics for all swimmers in a squad over a date range.
    
    Returns attendance rates (present, late, absent percentages) for each swimmer
    and squad-wide statistics.
    """
    try:
        supabase = get_supabase_client()
        logger.info(f"User {user_id} fetching squad attendance | squad_id={squad_id} | date_range={start_date} to {end_date}")
        
        # Parse and validate dates
        if not start_date:
            # Default to 90 days ago
            start_dt = datetime.now() - timedelta(days=90)
            start_date = start_dt.strftime("%Y-%m-%d")
        else:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            
        if not end_date:
            end_date = datetime.now().strftime("%Y-%m-%d")
        else:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        
        logger.debug(f"Date range parsed | start={start_date} | end={end_date}")
        
        # Verify squad exists and get squad info
        squad_response = supabase.table('squads').select('id, name').eq('id', squad_id).execute()
        
        if not squad_response.data:
            raise HTTPException(status_code=404, detail="Squad not found")
        
        squad_info = squad_response.data[0]
        
        # Get all sessions in date range for this squad
        sessions_response = supabase.table('training_sessions')\
            .select('id, start_date')\
            .eq('squad_id', squad_id)\
            .gte('start_date', start_date)\
            .lte('start_date', end_date)\
            .execute()
        
        if not sessions_response.data:
            logger.warning(f"No training sessions found for squad {squad_id} in date range")
            return {
                "squad": squad_info,
                "date_range": {"start": start_date, "end": end_date},
                "swimmers": [],
                "stats": {
                    "total_sessions": 0,
                    "avg_present_percentage": 0,
                    "avg_late_percentage": 0,
                    "avg_absent_percentage": 0,
                    "total_swimmers": 0
                }
            }
        
        session_ids = [s['id'] for s in sessions_response.data]
        total_sessions = len(session_ids)
        logger.debug(f"Found {total_sessions} training sessions in date range")
        
        # Get all swimmers in the squad
        swimmers_response = supabase.table('swimmers')\
            .select('id, first_name, last_name')\
            .eq('squad_id', squad_id)\
            .execute()
        
        if not swimmers_response.data:
            logger.warning(f"No swimmers found in squad {squad_id}")
            return {
                "squad": squad_info,
                "date_range": {"start": start_date, "end": end_date},
                "swimmers": [],
                "stats": {
                    "total_sessions": total_sessions,
                    "avg_present_percentage": 0,
                    "avg_late_percentage": 0,
                    "avg_absent_percentage": 0,
                    "total_swimmers": 0
                }
            }
        
        # Get all attendance records for these sessions
        attendance_response = supabase.table('training_attendance')\
            .select('swimmer_id, training_session_id, status')\
            .in_('training_session_id', session_ids)\
            .execute()
        
        logger.debug(f"Found {len(attendance_response.data)} attendance records")
        
        # Build swimmer attendance data
        swimmer_attendance = {}
        for swimmer in swimmers_response.data:
            swimmer_id = swimmer['id']
            swimmer_name = f"{swimmer['first_name']} {swimmer['last_name']}"
            
            # Filter attendance for this swimmer
            swimmer_records = [r for r in attendance_response.data if r['swimmer_id'] == swimmer_id]
            
            # Count by status
            present = sum(1 for r in swimmer_records if r['status'] and r['status'].lower() == 'present')
            late = sum(1 for r in swimmer_records if r['status'] and r['status'].lower() == 'late')
            absent = sum(1 for r in swimmer_records if r['status'] and r['status'].lower() == 'absent')
            
            total_recorded = present + late + absent
            
            # Only include swimmers with at least one attendance record
            if total_recorded > 0:
                swimmer_attendance[swimmer_id] = {
                    'swimmer_id': swimmer_id,
                    'swimmer_name': swimmer_name,
                    'total_sessions': total_recorded,
                    'present': present,
                    'late': late,
                    'absent': absent,
                    'present_percentage': (present / total_recorded * 100) if total_recorded > 0 else 0,
                    'late_percentage': (late / total_recorded * 100) if total_recorded > 0 else 0,
                    'absent_percentage': (absent / total_recorded * 100) if total_recorded > 0 else 0
                }
        
        swimmers_list = list(swimmer_attendance.values())
        
        # Calculate squad-wide statistics
        if swimmers_list:
            avg_present = sum(s['present_percentage'] for s in swimmers_list) / len(swimmers_list)
            avg_late = sum(s['late_percentage'] for s in swimmers_list) / len(swimmers_list)
            avg_absent = sum(s['absent_percentage'] for s in swimmers_list) / len(swimmers_list)
        else:
            avg_present = avg_late = avg_absent = 0
        
        logger.info(f"Squad attendance calculated | swimmers={len(swimmers_list)} | avg_present={avg_present:.1f}%")
        
        return {
            "squad": squad_info,
            "date_range": {
                "start": start_date,
                "end": end_date
            },
            "swimmers": swimmers_list,
            "stats": {
                "total_sessions": total_sessions,
                "avg_present_percentage": avg_present,
                "avg_late_percentage": avg_late,
                "avg_absent_percentage": avg_absent,
                "total_swimmers": len(swimmers_list)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching squad attendance: {str(e)}")
        log_error(e, context="get_squad_attendance", squad_id=squad_id)
        raise HTTPException(status_code=500, detail=f"Failed to fetch squad attendance: {str(e)}")

