"""Prediction routes for swimmers."""
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta, timezone
from collections import defaultdict
import statistics

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.services.performance_service import PerformanceService
from app.services.prediction import (
    PredictionService, WorkoutContext, AchievementValidator, GapAnalyzer,
    ImprovementAnalyzer,
)
from app.services.prediction.time_utils import PoolConverter
from app.middleware.auth import get_current_user_id
from app.infrastructure.db import get_db
from app.infrastructure.models import (
    Swimmer, CoachSquad, TrainingAttendance, TrainingSession,
    WorkoutResult,
)
from app.domain.value_objects.time import interval_to_seconds
from app.utils import logger

router = APIRouter()


@router.get("/{swimmer_id}/predictions")
async def get_swimmer_predictions(
    swimmer_id: str,
    attempts_until_target: int = Query(default=3),
    min_attempts: int = Query(default=3),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get improvement predictions for a swimmer's events."""
    try:
        performance_service = PerformanceService(db=db)

        # Verify swimmer and permissions
        swimmer = await _verify_swimmer_access(db, swimmer_id, user_id)

        # Get attendance data
        attendance_rate = await _get_attendance_rate(db, swimmer_id)

        # Get squad attendance average for comparison
        squad_avg_attendance = None
        if swimmer.get('squad_id'):
            squad_avg_attendance = await _get_squad_avg_attendance(
                db, swimmer['squad_id']
            )

        # Get workout results
        results = await performance_service.get_workout_results(
            swimmer_id=swimmer_id,
            user_id=user_id
        )

        # Group results by event
        events_data = _group_results_by_event(results)

        # Get squad comparison data
        squad_improvement_rates = {}
        if swimmer.get('squad_id'):
            squad_improvement_rates = await _get_squad_improvement_rates(
                db, swimmer['squad_id'], swimmer_id
            )

        # Calculate swimmer age
        swimmer_age = _calculate_swimmer_age(swimmer.get('date_of_birth'))

        # Get recent workouts
        recent_workouts = await _get_recent_workouts(db, swimmer_id)

        # Calculate training volume metrics
        recent_training_volume = (
            _calculate_recent_volume(recent_workouts) if recent_workouts else None
        )
        squad_avg_volume = None
        if swimmer.get('squad_id'):
            squad_avg_volume = await _get_squad_avg_volume(
                db, swimmer['squad_id']
            )

        # Calculate average workout effort
        avg_workout_effort = (
            _calculate_avg_effort(recent_workouts) if recent_workouts else None
        )

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
            converted_from_course = (
                best_result.get('converted_from') if is_converted else None
            )

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

async def _verify_swimmer_access(
    db: AsyncSession, swimmer_id: str, user_id: str
) -> Dict[str, Any]:
    """Verify swimmer exists and user has access."""
    result = await db.execute(
        select(Swimmer).where(Swimmer.id == swimmer_id)
    )
    swimmer_row = result.scalar_one_or_none()

    if not swimmer_row:
        raise HTTPException(status_code=404, detail="Swimmer not found")

    swimmer = {
        'id': str(swimmer_row.id),
        'squad_id': str(swimmer_row.squad_id) if swimmer_row.squad_id else None,
        'first_name': swimmer_row.first_name,
        'last_name': swimmer_row.last_name,
        'date_of_birth': (
            swimmer_row.date_of_birth.isoformat()
            if swimmer_row.date_of_birth else None
        ),
    }

    squad_id = swimmer.get('squad_id')

    if squad_id:
        coach_check = await db.execute(
            select(CoachSquad.id).where(
                and_(
                    CoachSquad.squad_id == squad_id,
                    CoachSquad.coach_id == user_id
                )
            )
        )

        if not coach_check.first():
            raise HTTPException(status_code=403, detail="Unauthorized")

    return swimmer


async def _get_attendance_rate(
    db: AsyncSession, swimmer_id: str
) -> Optional[float]:
    """Get attendance rate for last 30 days."""
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)

    attendance_result = await db.execute(
        select(TrainingAttendance.status)
        .where(
            and_(
                TrainingAttendance.swimmer_id == swimmer_id,
                TrainingAttendance.created_at >= thirty_days_ago
            )
        )
    )
    attendance_rows = attendance_result.all()

    if not attendance_rows:
        return None

    total_sessions = len(attendance_rows)
    present_sessions = sum(
        1 for a in attendance_rows
        if (a.status or '').lower() == 'present'
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
                date_only = (
                    performed_on.split('T')[0]
                    if 'T' in performed_on else performed_on
                )

                events_data[event_key][date_only].append({
                    'time_seconds': time_seconds,
                    'performed_on': performed_on,
                    'event_display': event_display,
                    'course': units
                })
            except Exception as e:
                logger.warning(
                    f"Failed to convert time_result '{time_result}': {e}"
                )
                continue

    # For each event and date, keep only the fastest time
    final_events_data = defaultdict(list)
    for event_key, dates in events_data.items():
        for date_val, times in dates.items():
            # Get the fastest time for this date
            fastest = min(times, key=lambda x: x['time_seconds'])
            final_events_data[event_key].append(fastest)

    # Add cross-course converted times
    final_events_data = _add_cross_course_conversions(final_events_data)

    return final_events_data


def _add_cross_course_conversions(events_data: dict) -> dict:
    """Add converted times from opposite course (LCM <-> SCM) to improve predictions."""
    enhanced_data = dict(events_data)

    # Group by distance_stroke_activity (without course)
    course_groups: Dict[str, Dict[str, Any]] = defaultdict(
        lambda: {'SCM': None, 'LCM': None}
    )

    for event_key, results in events_data.items():
        parts = event_key.split('_')
        if len(parts) >= 4:
            dist, stroke_val, course, activity_val = (
                parts[0], parts[1], parts[2], parts[3]
            )
            base_key = f"{dist}_{stroke_val}_{activity_val}"
            course_groups[base_key][course] = (event_key, results)

    # For each event, add converted times from opposite course
    for base_key, courses in course_groups.items():
        scm_data = courses.get('SCM')
        lcm_data = courses.get('LCM')

        if not scm_data or not lcm_data:
            continue

        parts = base_key.split('_')
        dist = int(parts[0])
        stroke_val = parts[1]
        activity_val = parts[2]

        scm_key, scm_results = scm_data
        lcm_key, lcm_results = lcm_data

        # Convert SCM to LCM using PoolConverter
        scm_converted_to_lcm = []
        for result in scm_results:
            converted_time = PoolConverter.convert(
                result['time_seconds'], dist, 'SCM', 'LCM'
            )
            if converted_time is not None:
                scm_converted_to_lcm.append({
                    'time_seconds': converted_time,
                    'performed_on': result['performed_on'],
                    'event_display': (
                        f"{dist}m {stroke_val.title()} {activity_val.title()} LCM"
                    ),
                    'course': 'LCM',
                    'converted_from': 'SCM'
                })

        # Convert LCM to SCM using PoolConverter
        lcm_converted_to_scm = []
        for result in lcm_results:
            converted_time = PoolConverter.convert(
                result['time_seconds'], dist, 'LCM', 'SCM'
            )
            if converted_time is not None:
                lcm_converted_to_scm.append({
                    'time_seconds': converted_time,
                    'performed_on': result['performed_on'],
                    'event_display': (
                        f"{dist}m {stroke_val.title()} {activity_val.title()} SCM"
                    ),
                    'course': 'SCM',
                    'converted_from': 'LCM'
                })

        # Add converted times to the respective event keys
        if scm_converted_to_lcm:
            enhanced_data[lcm_key] = lcm_results + scm_converted_to_lcm
        if lcm_converted_to_scm:
            enhanced_data[scm_key] = scm_results + lcm_converted_to_scm

    return enhanced_data


async def _get_squad_improvement_rates(
    db: AsyncSession,
    squad_id: str,
    exclude_swimmer_id: str
) -> Dict[str, float]:
    """Calculate squad average improvement rates by event."""
    try:
        # Get squad members
        squad_swimmers_result = await db.execute(
            select(Swimmer.id).where(Swimmer.squad_id == squad_id)
        )
        squad_swimmer_rows = squad_swimmers_result.all()

        if not squad_swimmer_rows or len(squad_swimmer_rows) <= 1:
            return {}

        squad_member_ids = [
            str(s.id) for s in squad_swimmer_rows
            if str(s.id) != exclude_swimmer_id
        ]

        if not squad_member_ids:
            return {}

        # Get workout results (last 90 days)
        ninety_days_ago = datetime.now(timezone.utc) - timedelta(days=90)
        squad_results_result = await db.execute(
            select(
                WorkoutResult.swimmer_id,
                WorkoutResult.distance,
                WorkoutResult.stroke,
                WorkoutResult.activity,
                WorkoutResult.result_units,
                WorkoutResult.time_result,
                WorkoutResult.performed_on,
            )
            .where(
                and_(
                    WorkoutResult.swimmer_id.in_(squad_member_ids),
                    WorkoutResult.performed_on >= ninety_days_ago,
                    WorkoutResult.activity == 'swim',
                )
            )
            .order_by(WorkoutResult.performed_on.asc())
        )
        squad_results_rows = squad_results_result.all()

        # Group by event and swimmer
        squad_events = defaultdict(lambda: defaultdict(list))
        for r in squad_results_rows:
            event_key = (
                f"{r.distance}_{r.stroke}_"
                f"{r.activity}_{r.result_units or 'SCM'}"
            )
            time_seconds = interval_to_seconds(r.time_result)
            squad_events[event_key][str(r.swimmer_id)].append(time_seconds)

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
        return (datetime.now(timezone.utc) - dob).days // 365
    except Exception as e:
        logger.warning(f"Failed to calculate swimmer age: {e}")
        return None


async def _get_recent_workouts(
    db: AsyncSession, swimmer_id: str
) -> list:
    """Get recent workout context for predictions."""
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    recent_workouts = []

    try:
        # Get sessions where swimmer attended
        attendance_result = await db.execute(
            select(
                TrainingAttendance.training_session_id,
                TrainingAttendance.status,
            )
            .where(TrainingAttendance.swimmer_id == swimmer_id)
        )
        attendance_rows = attendance_result.all()

        attended_session_ids = [
            str(a.training_session_id) for a in attendance_rows
            if a.training_session_id and a.status == 'present'
        ]

        if not attended_session_ids:
            return []

        # Get training sessions with workouts
        sessions_result = await db.execute(
            select(TrainingSession)
            .options(selectinload(TrainingSession.workout_template))
            .where(
                and_(
                    TrainingSession.id.in_(attended_session_ids),
                    TrainingSession.start_date >= thirty_days_ago
                )
            )
        )
        sessions = sessions_result.scalars().all()

        for session in sessions:
            wt = session.workout_template
            if not wt:
                continue

            workout_type = _categorize_workout(
                wt.effort_level,
                wt.json_description or {}
            )

            recent_workouts.append(WorkoutContext(
                total_meters=wt.total_meters or 0,
                effort_level=wt.effort_level,
                session_date=(
                    session.start_date.isoformat()
                    if session.start_date else ''
                ),
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
        return (datetime.now(timezone.utc) - last_result_date).days
    except Exception as e:
        logger.warning(f"Failed to calculate days since last result: {e}")
        return None


async def _get_squad_avg_attendance(
    db: AsyncSession, squad_id: str
) -> Optional[float]:
    """Get squad average attendance rate for last 30 days."""
    try:
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)

        # Get all swimmers in squad
        swimmers_result = await db.execute(
            select(Swimmer.id).where(Swimmer.squad_id == squad_id)
        )
        swimmer_rows = swimmers_result.all()

        if not swimmer_rows:
            return None

        swimmer_ids = [str(s.id) for s in swimmer_rows]

        # Get attendance for all squad swimmers
        attendance_result = await db.execute(
            select(TrainingAttendance.swimmer_id, TrainingAttendance.status)
            .where(
                and_(
                    TrainingAttendance.swimmer_id.in_(swimmer_ids),
                    TrainingAttendance.created_at >= thirty_days_ago
                )
            )
        )
        attendance_rows = attendance_result.all()

        if not attendance_rows:
            return None

        # Calculate squad average
        swimmer_rates: Dict[str, Dict[str, int]] = {}
        for record in attendance_rows:
            sid = str(record.swimmer_id)
            if sid not in swimmer_rates:
                swimmer_rates[sid] = {'total': 0, 'present': 0}

            swimmer_rates[sid]['total'] += 1
            if (record.status or '').lower() == 'present':
                swimmer_rates[sid]['present'] += 1

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


async def _get_squad_avg_volume(
    db: AsyncSession, squad_id: str
) -> Optional[int]:
    """Get squad average training volume for last 30 days."""
    try:
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)

        # Get all swimmers in squad
        swimmers_result = await db.execute(
            select(Swimmer.id).where(Swimmer.squad_id == squad_id)
        )
        swimmer_rows = swimmers_result.all()

        if not swimmer_rows:
            return None

        swimmer_ids = [str(s.id) for s in swimmer_rows]

        # Get attendance records for squad swimmers (present or late)
        attendance_result = await db.execute(
            select(
                TrainingAttendance.swimmer_id,
                TrainingAttendance.training_session_id,
                TrainingAttendance.status,
            )
            .where(
                and_(
                    TrainingAttendance.swimmer_id.in_(swimmer_ids),
                    TrainingAttendance.created_at >= thirty_days_ago
                )
            )
        )
        attendance_rows = attendance_result.all()

        if not attendance_rows:
            return None

        # Get unique training session IDs where swimmers were present or late
        session_ids = list(set(
            str(a.training_session_id) for a in attendance_rows
            if (a.status or '').lower() in ['present', 'late']
        ))

        if not session_ids:
            return None

        # Get workout templates for these sessions
        sessions_result = await db.execute(
            select(TrainingSession)
            .options(selectinload(TrainingSession.workout_template))
            .where(TrainingSession.id.in_(session_ids))
        )
        sessions = sessions_result.scalars().all()

        # Build session_id -> meters mapping
        session_meters: Dict[str, int] = {}
        for session in sessions:
            wt = session.workout_template
            if wt and wt.total_meters:
                session_meters[str(session.id)] = wt.total_meters

        # Calculate total volume per swimmer
        swimmer_volumes: Dict[str, int] = {}
        for record in attendance_rows:
            if (record.status or '').lower() not in ['present', 'late']:
                continue

            sid = str(record.swimmer_id)
            sess_id = str(record.training_session_id)

            if sess_id in session_meters:
                if sid not in swimmer_volumes:
                    swimmer_volumes[sid] = 0
                swimmer_volumes[sid] += session_meters[sess_id]

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
