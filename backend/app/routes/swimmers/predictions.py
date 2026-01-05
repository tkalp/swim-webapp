"""Prediction routes for swimmers."""
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from collections import defaultdict

from app.services.performance_service import PerformanceService
from app.services.prediction import PredictionService, WorkoutContext, AchievementValidator, GapAnalyzer
from app.middleware.auth import get_current_user_id
from app.infrastructure.database import get_supabase_client
from app.domain.value_objects.time import interval_to_seconds
from app.utils import logger

from .error_handlers import handle_service_error

router = APIRouter()


@router.get("/{swimmer_id}/predictions")
async def get_swimmer_predictions(
    swimmer_id: str,
    attempts_until_target: int = Query(default=3),
    min_attempts: int = Query(default=3),
    user_id: str = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """Get improvement predictions for a swimmer's events."""
    try:
        performance_service = PerformanceService()
        supabase = get_supabase_client()
        
        # Verify swimmer and permissions
        swimmer = _verify_swimmer_access(supabase, swimmer_id, user_id)
        
        # Get attendance data
        attendance_rate = _get_attendance_rate(supabase, swimmer_id)
        
        # Get squad attendance average for comparison
        squad_avg_attendance = None
        if swimmer.get('squad_id'):
            squad_avg_attendance = _get_squad_avg_attendance(supabase, swimmer['squad_id'])
        
        # Get workout results
        results = performance_service.get_workout_results(
            swimmer_id=swimmer_id,
            user_id=user_id
        )
        
        # Group results by event
        events_data = _group_results_by_event(results)
        
        # Get squad comparison data
        squad_improvement_rates = {}
        if swimmer.get('squad_id'):
            squad_improvement_rates = _get_squad_improvement_rates(
                supabase, swimmer['squad_id'], swimmer_id
            )
        
        # Calculate swimmer age
        swimmer_age = _calculate_swimmer_age(swimmer.get('date_of_birth'))
        
        # Get recent workouts
        recent_workouts = _get_recent_workouts(supabase, swimmer_id)
        
        # Calculate training volume metrics
        recent_training_volume = _calculate_recent_volume(recent_workouts) if recent_workouts else None
        squad_avg_volume = None
        if swimmer.get('squad_id'):
            squad_avg_volume = _get_squad_avg_volume(supabase, swimmer['squad_id'])
        
        # Calculate average workout effort
        avg_workout_effort = _calculate_avg_effort(recent_workouts) if recent_workouts else None
        
        # Generate predictions
        predictions = []
        for event_key, event_results in events_data.items():
            if len(event_results) < min_attempts:
                continue
            
            sorted_results = sorted(event_results, key=lambda x: x['performed_on'])
            all_times = [r['time_seconds'] for r in sorted_results]
            all_dates = [r['performed_on'] for r in sorted_results]
            current_best = min(all_times)
            event_display = sorted_results[0]['event_display']
            
            # Find the result that has the current best time
            best_result = min(sorted_results, key=lambda x: x['time_seconds'])
            is_converted = best_result.get('converted_from') is not None
            converted_from_course = best_result.get('converted_from') if is_converted else None
            
            days_since_last = _calculate_days_since_last_result(sorted_results)
            squad_rate = squad_improvement_rates.get(event_key)
            
            # Calculate achievement rate for this event
            achievement_metrics = AchievementValidator.calculate_achievement_rate(
                all_times=all_times,
                all_dates=all_dates,
                prediction_window=5,
                attempts_horizon=10
            )
            
            # Perform gap analysis
            gap_analysis = GapAnalyzer.analyze_prediction_gap(
                achievement_rate=achievement_metrics['achievement_rate'],
                predictions_tested=achievement_metrics['total_predictions'],
                swimmer_attendance_rate=attendance_rate,
                squad_avg_attendance=squad_avg_attendance,
                recent_training_volume=recent_training_volume,
                squad_avg_volume=squad_avg_volume,
                recent_workouts=recent_workouts,
                days_since_last_result=days_since_last,
                avg_workout_effort=avg_workout_effort
            )
            
            prediction = PredictionService.predict_improvement(
                event=event_display,
                current_best=current_best,
                all_times=all_times,
                attempts_until_target=attempts_until_target,
                attendance_rate=attendance_rate,
                squad_improvement_rate=squad_rate,
                recent_workouts=recent_workouts if recent_workouts else None,
                days_since_last_result=days_since_last,
                swimmer_age=swimmer_age
            )
            
            predictions.append({
                'event_key': event_key,
                'event': prediction.event,
                'current_best': prediction.current_best,
                'current_best_is_converted': is_converted,
                'current_best_converted_from': converted_from_course,
                'predicted_time': prediction.predicted_time,
                'confidence_level': prediction.confidence_level,
                'improvement_expected': prediction.improvement_expected,
                'factors': prediction.factors,
                'achievement_rate': achievement_metrics['achievement_rate'],
                'achievement_confidence': achievement_metrics['confidence'],
                'avg_attempts_to_achieve': achievement_metrics['avg_attempts_to_achieve'],
                'predictions_tested': achievement_metrics['total_predictions'],
                'gap_analysis': gap_analysis
            })
        
        # Sort predictions
        predictions.sort(key=lambda x: (
            int(x['event_key'].split('_')[0]) 
            if x['event_key'].split('_')[0].isdigit() else 999,
            x['current_best']
        ))
        
        return {
            'swimmer_id': swimmer_id,
            'swimmer_name': f"{swimmer['first_name']} {swimmer['last_name']}",
            'attempts_until_target': attempts_until_target,
            'predictions': predictions,
            'total_events_analyzed': len(predictions),
            'attendance_rate': attendance_rate,
            'metadata': {
                'min_attempts_required': min_attempts,
                'total_events_with_data': len(events_data),
                'events_with_insufficient_data': len([
                    e for e in events_data.values() if len(e) < min_attempts
                ]),
                'attendance_days_analyzed': 30,
                'attendance_included': attendance_rate is not None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating predictions for swimmer {swimmer_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === Helper Functions ===

def _verify_swimmer_access(supabase, swimmer_id: str, user_id: str) -> Dict[str, Any]:
    """Verify swimmer exists and user has access."""
    swimmer_check = supabase.table('swimmers').select(
        'id, squad_id, first_name, last_name, date_of_birth'
    ).eq('id', swimmer_id).execute()
    
    if not swimmer_check.data:
        raise HTTPException(status_code=404, detail="Swimmer not found")
    
    swimmer = swimmer_check.data[0]
    squad_id = swimmer.get('squad_id')
    
    if squad_id:
        coach_check = supabase.table('coach_squads').select('id').eq(
            'squad_id', squad_id
        ).eq('coach_id', user_id).execute()
        
        if not coach_check.data:
            raise HTTPException(status_code=403, detail="Unauthorized")
    
    return swimmer


def _get_attendance_rate(supabase, swimmer_id: str) -> Optional[float]:
    """Get attendance rate for last 30 days."""
    thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).isoformat()
    
    attendance_result = supabase.table('training_attendance').select(
        'status'
    ).eq('swimmer_id', swimmer_id).gte('created_at', thirty_days_ago).execute()
    
    if not attendance_result.data:
        return None
    
    total_sessions = len(attendance_result.data)
    present_sessions = sum(
        1 for a in attendance_result.data 
        if a.get('status', '').lower() == 'present'
    )
    
    if total_sessions > 0:
        return round((present_sessions / total_sessions * 100), 1)
    
    return None


def _group_results_by_event(results: list) -> dict:
    """Group workout results by event key, keeping only fastest time per day.
    Also enriches events with cross-course conversions (LCM <-> SCM)."""
    events_data = defaultdict(lambda: defaultdict(list))
    
    for result in results:
        distance = str(result.get('distance', ''))
        stroke = result.get('stroke', '').lower()
        units = result.get('result_units', 'LCM')
        activity = result.get('activity', 'swim').lower()
        
        event_key = f"{distance}_{stroke}_{units}_{activity}"
        time_result = result.get('time_result')
        performed_on = result.get('performed_on')
        
        if time_result and performed_on:
            try:
                time_seconds = interval_to_seconds(time_result)
                event_display = f"{distance}m {stroke.title()} {activity.title()} {units}"
                
                # Extract date (without time component)
                date_only = performed_on.split('T')[0] if 'T' in performed_on else performed_on
                
                events_data[event_key][date_only].append({
                    'time_seconds': time_seconds,
                    'performed_on': performed_on,
                    'event_display': event_display,
                    'course': units
                })
            except Exception as e:
                logger.warning(f"Failed to convert time_result '{time_result}': {e}")
                continue
    
    # For each event and date, keep only the fastest time
    final_events_data = defaultdict(list)
    for event_key, dates in events_data.items():
        for date, times in dates.items():
            # Get the fastest time for this date
            fastest = min(times, key=lambda x: x['time_seconds'])
            final_events_data[event_key].append(fastest)
    
    # Add cross-course converted times
    final_events_data = _add_cross_course_conversions(final_events_data)
    
    return final_events_data


def _add_cross_course_conversions(events_data: dict) -> dict:
    """Add converted times from opposite course (LCM <-> SCM) to improve predictions."""
    enhanced_data = dict(events_data)
    
    # Get conversion factors based on distance
    def get_conversion_factor(distance: int) -> float:
        """Return SCM to LCM time factor (SCM times are faster)."""
        if distance <= 50:
            return 1.015  # SCM ~1.5% faster
        elif distance <= 100:
            return 1.025  # SCM ~2.5% faster
        elif distance <= 200:
            return 1.035  # SCM ~3.5% faster
        elif distance <= 400:
            return 1.045  # SCM ~4.5% faster
        else:
            return 1.050  # SCM ~5% faster for 800m+
    
    # Group by distance_stroke_activity (without course)
    course_groups = defaultdict(lambda: {'SCM': None, 'LCM': None})
    
    for event_key, results in events_data.items():
        parts = event_key.split('_')
        if len(parts) >= 4:
            distance, stroke, course, activity = parts[0], parts[1], parts[2], parts[3]
            base_key = f"{distance}_{stroke}_{activity}"
            course_groups[base_key][course] = (event_key, results)
    
    # For each event, add converted times from opposite course
    for base_key, courses in course_groups.items():
        scm_data = courses.get('SCM')
        lcm_data = courses.get('LCM')
        
        if not scm_data or not lcm_data:
            continue
        
        parts = base_key.split('_')
        distance = int(parts[0])
        stroke = parts[1]
        activity = parts[2]
        
        conversion_factor = get_conversion_factor(distance)
        
        scm_key, scm_results = scm_data
        lcm_key, lcm_results = lcm_data
        
        # Convert SCM to LCM (multiply by factor - makes it slower)
        scm_converted_to_lcm = []
        for result in scm_results:
            converted_time = result['time_seconds'] * conversion_factor
            scm_converted_to_lcm.append({
                'time_seconds': converted_time,
                'performed_on': result['performed_on'],
                'event_display': f"{distance}m {stroke.title()} {activity.title()} LCM",
                'course': 'LCM',
                'converted_from': 'SCM'
            })
        
        # Convert LCM to SCM (divide by factor - makes it faster)
        lcm_converted_to_scm = []
        for result in lcm_results:
            converted_time = result['time_seconds'] / conversion_factor
            lcm_converted_to_scm.append({
                'time_seconds': converted_time,
                'performed_on': result['performed_on'],
                'event_display': f"{distance}m {stroke.title()} {activity.title()} SCM",
                'course': 'SCM',
                'converted_from': 'LCM'
            })
        
        # Add converted times to the respective event keys
        if scm_converted_to_lcm:
            enhanced_data[lcm_key] = lcm_results + scm_converted_to_lcm
        if lcm_converted_to_scm:
            enhanced_data[scm_key] = scm_results + lcm_converted_to_scm
    
    return enhanced_data


def _get_squad_improvement_rates(
    supabase, 
    squad_id: str, 
    exclude_swimmer_id: str
) -> Dict[str, float]:
    """Calculate squad average improvement rates by event."""
    try:
        from app.services.prediction import ImprovementAnalyzer
        import statistics
        
        # Get squad members
        squad_swimmers_response = supabase.table('swimmers').select('id').eq(
            'squad_id', squad_id
        ).execute()
        
        if not squad_swimmers_response.data or len(squad_swimmers_response.data) <= 1:
            return {}
        
        squad_member_ids = [
            s['id'] for s in squad_swimmers_response.data 
            if s['id'] != exclude_swimmer_id
        ]
        
        # Get workout results
        thirty_days_ago = (datetime.utcnow() - timedelta(days=90)).isoformat()
        squad_results_response = supabase.table('workout_result').select(
            'swimmer_id, distance, stroke, activity, result_units, time_result, performed_on'
        ).in_('swimmer_id', squad_member_ids).gte(
            'performed_on', thirty_days_ago
        ).eq('activity', 'swim').order('performed_on', desc=False).execute()
        
        # Group by event and swimmer
        squad_events = defaultdict(lambda: defaultdict(list))
        for result in squad_results_response.data:
            event_key = (
                f"{result['distance']}_{result['stroke']}_"
                f"{result['activity']}_{result.get('result_units', 'SCM') or 'SCM'}"
            )
            time_seconds = interval_to_seconds(result['time_result'])
            squad_events[event_key][result['swimmer_id']].append(time_seconds)
        
        # Calculate average improvement rate per event
        squad_improvement_rates = {}
        for event_key, swimmers_times in squad_events.items():
            rates = []
            for swimmer_times in swimmers_times.values():
                if len(swimmer_times) >= 2:
                    rate = ImprovementAnalyzer.calculate_improvement_per_attempt(
                        swimmer_times
                    )
                    rates.append(rate)
            if rates:
                squad_improvement_rates[event_key] = statistics.mean(rates)
        
        return squad_improvement_rates
        
    except Exception as e:
        logger.warning(f"Failed to fetch squad comparison data: {e}")
        return {}


def _calculate_swimmer_age(date_of_birth: Optional[str]) -> Optional[int]:
    """Calculate swimmer age from date of birth."""
    if not date_of_birth:
        return None
    
    try:
        dob = datetime.fromisoformat(date_of_birth.replace('Z', '+00:00'))
        return (datetime.utcnow() - dob).days // 365
    except Exception as e:
        logger.warning(f"Failed to calculate swimmer age: {e}")
        return None


def _get_recent_workouts(supabase, swimmer_id: str) -> list:
    """Get recent workout context for predictions."""
    thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).isoformat()
    recent_workouts = []
    
    try:
        # Get sessions where swimmer attended
        attendance_response = supabase.table('training_attendance').select(
            'training_session_id, status'
        ).eq('swimmer_id', swimmer_id).execute()
        
        attended_session_ids = [
            a['training_session_id'] for a in attendance_response.data 
            if a.get('training_session_id') and a.get('status') == 'present'
        ] if attendance_response.data else []
        
        if not attended_session_ids:
            return []
        
        # Get training sessions with workouts
        workouts_response = supabase.table('training_sessions').select(
            'id, start_date, workout_id, '
            'workout_template(total_meters, effort_level, json_description)'
        ).in_('id', attended_session_ids).gte('start_date', thirty_days_ago).execute()
        
        if not workouts_response or not workouts_response.data:
            return []
        
        for session in workouts_response.data:
            workout_template = session.get('workout_template')
            if not workout_template:
                continue
            
            workout_type = _categorize_workout(
                workout_template.get('effort_level'),
                workout_template.get('json_description', {})
            )
            
            recent_workouts.append(WorkoutContext(
                total_meters=workout_template.get('total_meters', 0),
                effort_level=workout_template.get('effort_level'),
                session_date=session['start_date'],
                workout_type=workout_type
            ))
        
        return recent_workouts
        
    except Exception as e:
        logger.warning(f"Failed to fetch workout context: {e}")
        return []


def _categorize_workout(effort_level: int, json_desc: dict) -> str:
    """Categorize workout by type based on effort and description."""
    if effort_level is None:
        return 'mixed'
    
    if effort_level >= 7:
        return 'sprint'
    elif effort_level <= 4:
        return 'endurance'
    elif effort_level in [5, 6]:
        if isinstance(json_desc, dict):
            activity_breakdown = json_desc.get('activity_breakdown', {})
            drill_pct = activity_breakdown.get('Drill', 0)
            if drill_pct > 30:
                return 'technique'
        return 'mixed'
    
    return 'mixed'


def _calculate_days_since_last_result(sorted_results: list) -> Optional[int]:
    """Calculate days since last result."""
    if not sorted_results:
        return None
    
    try:
        last_result_date = datetime.fromisoformat(
            sorted_results[-1]['performed_on'].replace('Z', '+00:00')
        )
        return (datetime.utcnow() - last_result_date).days
    except Exception as e:
        logger.warning(f"Failed to calculate days since last result: {e}")
        return None


def _get_squad_avg_attendance(supabase, squad_id: str) -> Optional[float]:
    """Get squad average attendance rate for last 30 days."""
    try:
        thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).isoformat()
        
        # Get all swimmers in squad
        swimmers_result = supabase.table('swimmers').select('id').eq('squad_id', squad_id).execute()
        
        if not swimmers_result.data:
            return None
        
        swimmer_ids = [s['id'] for s in swimmers_result.data]
        
        # Get attendance for all squad swimmers
        attendance_result = supabase.table('training_attendance').select(
            'swimmer_id, status'
        ).in_('swimmer_id', swimmer_ids).gte('created_at', thirty_days_ago).execute()
        
        if not attendance_result.data:
            return None
        
        # Calculate squad average
        swimmer_rates = {}
        for record in attendance_result.data:
            swimmer_id = record['swimmer_id']
            if swimmer_id not in swimmer_rates:
                swimmer_rates[swimmer_id] = {'total': 0, 'present': 0}
            
            swimmer_rates[swimmer_id]['total'] += 1
            if record.get('status', '').lower() == 'present':
                swimmer_rates[swimmer_id]['present'] += 1
        
        if not swimmer_rates:
            return None
        
        rates = [
            (s['present'] / s['total'] * 100) 
            for s in swimmer_rates.values() if s['total'] > 0
        ]
        
        return round(sum(rates) / len(rates), 1) if rates else None
    
    except Exception as e:
        logger.warning(f"Failed to get squad average attendance: {e}")
        return None


def _calculate_recent_volume(workouts: List[WorkoutContext]) -> Optional[int]:
    """Calculate total training volume from recent workouts."""
    if not workouts:
        return None
    
    try:
        total_meters = sum(w.total_meters for w in workouts if w.total_meters)
        return int(total_meters) if total_meters > 0 else None
    except Exception as e:
        logger.warning(f"Failed to calculate recent volume: {e}")
        return None


def _get_squad_avg_volume(supabase, squad_id: str) -> Optional[int]:
    """Get squad average training volume for last 30 days."""
    try:
        thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).isoformat()
        
        # Get all swimmers in squad
        swimmers_result = supabase.table('swimmers').select('id').eq('squad_id', squad_id).execute()
        
        if not swimmers_result.data:
            return None
        
        swimmer_ids = [s['id'] for s in swimmers_result.data]
        
        # Get attendance records for squad swimmers (present or late)
        attendance_result = supabase.table('training_attendance').select(
            'swimmer_id, training_session_id, status'
        ).in_('swimmer_id', swimmer_ids).gte('created_at', thirty_days_ago).execute()
        
        if not attendance_result.data:
            return None
        
        # Get unique training session IDs where swimmers were present or late
        session_ids = list(set(
            a['training_session_id'] for a in attendance_result.data 
            if a.get('status', '').lower() in ['present', 'late']
        ))
        
        if not session_ids:
            return None
        
        # Get workout templates for these sessions
        sessions_result = supabase.table('training_sessions').select(
            'id, workout_template(total_meters)'
        ).in_('id', session_ids).execute()
        
        if not sessions_result.data:
            return None
        
        # Build session_id -> meters mapping
        session_meters = {}
        for session in sessions_result.data:
            workout_template = session.get('workout_template')
            if workout_template and workout_template.get('total_meters'):
                session_meters[session['id']] = workout_template['total_meters']
        
        # Calculate total volume per swimmer
        swimmer_volumes = {}
        for record in attendance_result.data:
            if record.get('status', '').lower() not in ['present', 'late']:
                continue
            
            swimmer_id = record['swimmer_id']
            session_id = record['training_session_id']
            
            if session_id in session_meters:
                if swimmer_id not in swimmer_volumes:
                    swimmer_volumes[swimmer_id] = 0
                swimmer_volumes[swimmer_id] += session_meters[session_id]
        
        if not swimmer_volumes:
            return None
        
        volumes = list(swimmer_volumes.values())
        return round(sum(volumes) / len(volumes)) if volumes else None
    
    except Exception as e:
        logger.warning(f"Failed to get squad average volume: {e}")
        return None


def _calculate_avg_effort(workouts: List[WorkoutContext]) -> Optional[float]:
    """Calculate average effort level from recent workouts."""
    if not workouts:
        return None
    
    try:
        efforts = [w.effort_level for w in workouts if w.effort_level is not None]
        
        if not efforts:
            return None
        
        return round(sum(efforts) / len(efforts), 1)
    except Exception as e:
        logger.warning(f"Failed to calculate average effort: {e}")
        return None

