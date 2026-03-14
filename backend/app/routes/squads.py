# backend/app/routes/squads.py
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List, Dict
from datetime import date, datetime, timedelta
from collections import defaultdict
import statistics
import re

from sqlalchemy import select, func, update, delete, text, and_, or_, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.infrastructure.db import get_db
from app.infrastructure.models import (
    Squad, CoachSquad, Swimmer, SwimmerExternalLink, WorkoutResult, RaceSplit,
    TrainingSession, TrainingSchedule, TrainingAttendance, WorkoutTemplate,
    CalendarEvent, TimeStandardsSet, TimeStandard, WorkoutSessionFeedback,
    TrainingSessionPrePracticeNote, TrainingSessionPostPracticeNote, Coach,
    BulkSyncJob,
)
from app.middleware.auth import get_current_user_id
from app.middleware.authorization import get_coach_membership
from app.domain.exceptions import UnauthorizedError
from app.utils import logger, log_error
from app.services.performance_service import PerformanceService
from app.services.comparison_service import SwimmerComparisonService

router = APIRouter(prefix="/squads", tags=["squads"])


async def get_sessions_with_workouts(db: AsyncSession, squad_id: str, start_date: Optional[str], end_date: Optional[str]):
    """
    Helper function to fetch sessions with workout data in a single query.
    Returns sessions with embedded workout_template data.
    """
    query = (
        select(TrainingSession)
        .outerjoin(WorkoutTemplate, WorkoutTemplate.id == TrainingSession.workout_id)
        .options(selectinload(TrainingSession.workout_template))
        .where(TrainingSession.squad_id == squad_id)
    )

    if start_date:
        query = query.where(TrainingSession.start_date >= datetime.fromisoformat(start_date.replace("Z", "+00:00")))
    if end_date:
        query = query.where(TrainingSession.start_date <= datetime.fromisoformat(end_date.replace("Z", "+00:00")))

    result = await db.execute(query)
    sessions = result.scalars().all()

    # Convert to dict format matching the old Supabase response
    sessions_data = []
    for s in sessions:
        session_dict = {
            'id': str(s.id),
            'start_date': s.start_date.isoformat() if s.start_date else None,
            'workout_id': str(s.workout_id) if s.workout_id else None,
        }
        if s.workout_template:
            session_dict['workout_template'] = {
                'id': str(s.workout_template.id),
                'total_meters': s.workout_template.total_meters,
                'json_description': s.workout_template.json_description,
            }
        else:
            session_dict['workout_template'] = None
        sessions_data.append(session_dict)

    return sessions_data


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
    """Convert ISO week to display label like 'Jan 6-12, 2025'"""
    # Find January 4th (always in week 1)
    jan4 = datetime(year, 1, 4)
    jan4_weekday = jan4.weekday()

    # Get Monday of week 1
    week1_monday = jan4 - timedelta(days=jan4_weekday)

    # Add weeks to get target week's Monday
    target_monday = week1_monday + timedelta(weeks=(week - 1))
    target_sunday = target_monday + timedelta(days=6)

    # Format as "Jan 6-12, 2025" or "Dec 30 - Jan 5, 2025"
    if target_monday.month == target_sunday.month:
        return f"{target_monday.strftime('%b')} {target_monday.day}\u2013{target_sunday.day}, {target_monday.year}"
    else:
        return f"{target_monday.strftime('%b %d')} \u2013 {target_sunday.strftime('%b %d')}, {target_monday.year}"


@router.get("/{squad_id}/metrics/session-count")
async def get_squad_session_count(
    squad_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Get total number of training sessions for a squad in a date range."""
    membership = await get_coach_membership(db, user_id, squad_id)
    if not membership.can_view_analytics:
        raise UnauthorizedError("Missing permission: can_view_analytics")
    try:
        query = (
            select(func.count(TrainingSession.id))
            .where(TrainingSession.squad_id == squad_id)
        )

        if start_date:
            query = query.where(TrainingSession.start_date >= datetime.fromisoformat(start_date.replace("Z", "+00:00")))
        if end_date:
            query = query.where(TrainingSession.start_date <= datetime.fromisoformat(end_date.replace("Z", "+00:00")))

        result = await db.execute(query)
        count = result.scalar() or 0
        return {"count": count}

    except Exception as e:
        logger.error(f"Error fetching session count: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{squad_id}/metrics/total-meters")
async def get_squad_total_meters(
    squad_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Get total meters swum across all sessions in a date range."""
    membership = await get_coach_membership(db, user_id, squad_id)
    if not membership.can_view_analytics:
        raise UnauthorizedError("Missing permission: can_view_analytics")
    try:
        sessions_data = await get_sessions_with_workouts(db, squad_id, start_date, end_date)

        if not sessions_data:
            return {"total_meters": 0}

        # Sum meters from joined workout data
        total = 0
        for session in sessions_data:
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
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Get attendance breakdown (present/late/absent counts)."""
    membership = await get_coach_membership(db, user_id, squad_id)
    if not membership.can_view_analytics:
        raise UnauthorizedError("Missing permission: can_view_analytics")
    try:
        # Get sessions in date range
        session_query = (
            select(TrainingSession.id)
            .where(TrainingSession.squad_id == squad_id)
        )

        if start_date:
            session_query = session_query.where(TrainingSession.start_date >= datetime.fromisoformat(start_date.replace("Z", "+00:00")))
        if end_date:
            session_query = session_query.where(TrainingSession.start_date <= datetime.fromisoformat(end_date.replace("Z", "+00:00")))

        sessions_result = await db.execute(session_query)
        session_ids = [str(row) for row in sessions_result.scalars().all()]

        if not session_ids:
            return {"present": 0, "late": 0, "absent": 0}

        # Get attendance records
        attendance_query = (
            select(TrainingAttendance.status)
            .where(TrainingAttendance.training_session_id.in_(session_ids))
        )
        attendance_result = await db.execute(attendance_query)
        attendance_rows = attendance_result.scalars().all()

        counts = {"present": 0, "late": 0, "absent": 0}

        for status in attendance_rows:
            status_lower = (status or '').lower()
            if status_lower == 'present':
                counts['present'] += 1
            elif status_lower == 'late':
                counts['late'] += 1
            elif status_lower == 'absent':
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
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Get weekly distance breakdown using ISO weeks (Monday-Sunday)."""
    membership = await get_coach_membership(db, user_id, squad_id)
    if not membership.can_view_analytics:
        raise UnauthorizedError("Missing permission: can_view_analytics")
    try:
        sessions_data = await get_sessions_with_workouts(db, squad_id, start_date, end_date)

        if not sessions_data:
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

        for session in sessions_data:
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
        # For small date ranges (<= 8 days), only show the week with the most days in the range
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
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get daily distance breakdown.

    Args:
        timezone_offset: Browser timezone offset in minutes (e.g., -300 for EST/UTC-5)
                        Used to group sessions by local date instead of UTC date
    """
    membership = await get_coach_membership(db, user_id, squad_id)
    if not membership.can_view_analytics:
        raise UnauthorizedError("Missing permission: can_view_analytics")
    try:
        sessions_data = await get_sessions_with_workouts(db, squad_id, start_date, end_date)

        if not sessions_data:
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

        for session in sessions_data:
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
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Get breakdown of meters by stroke type."""
    membership = await get_coach_membership(db, user_id, squad_id)
    if not membership.can_view_analytics:
        raise UnauthorizedError("Missing permission: can_view_analytics")
    try:
        sessions_data = await get_sessions_with_workouts(db, squad_id, start_date, end_date)

        if not sessions_data:
            return {"strokes": []}

        stroke_totals = defaultdict(int)

        # Parse JSON descriptions to get stroke breakdown
        for session in sessions_data:
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
            'freestyle': '#3B82F6',  # Brilliant blue
            'backstroke': '#A855F7',  # Vivid purple
            'breaststroke': '#10B981',  # Emerald green
            'butterfly': '#F97316',  # Bright orange
            'individual medley': '#EC4899',  # Hot pink
            'choice': '#FBBF24',  # Golden yellow
            'mixed': '#8B5CF6'  # Purple-violet
        }

        result = [
            {
                "stroke": stroke.title().replace('Individual medley', 'Individual Medley'),
                "meters": meters,
                "color": stroke_colors.get(stroke, '#FBBF24')  # Golden yellow fallback
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
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Get breakdown of meters by activity type (swim/kick/pull/drill)."""
    membership = await get_coach_membership(db, user_id, squad_id)
    if not membership.can_view_analytics:
        raise UnauthorizedError("Missing permission: can_view_analytics")
    try:
        sessions_data = await get_sessions_with_workouts(db, squad_id, start_date, end_date)

        if not sessions_data:
            return {"activities": []}

        activity_totals = defaultdict(int)

        # Parse JSON descriptions to get activity breakdown
        for session in sessions_data:
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
            'swim': '#3B82F6',  # Brilliant blue
            'kick': '#F97316',  # Bright orange
            'pull': '#10B981',  # Emerald green
            'drill': '#FBBF24',  # Golden yellow
            'mixed': '#8B5CF6'  # Purple-violet
        }

        result = [
            {
                "activity": activity.title(),
                "meters": meters,
                "color": activity_colors.get(activity, '#FBBF24')  # Golden yellow fallback
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
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get performance analytics for all swimmers in a squad over a date range.

    Returns improvement metrics, best times trends, and performance statistics
    for each swimmer in the squad.
    """
    membership = await get_coach_membership(db, user_id, squad_id)
    if not membership.can_view_analytics:
        raise UnauthorizedError("Missing permission: can_view_analytics")
    try:
        logger.info(f"User {user_id} fetching squad performance | squad_id={squad_id} | date_range={start_date} to {end_date}")

        # Parse and validate dates — keep as date objects for SQLAlchemy
        if not start_date:
            start_date = (datetime.now() - timedelta(days=90)).date()
        else:
            start_date = date.fromisoformat(start_date)

        if not end_date:
            end_date = datetime.now().date()
        else:
            end_date = date.fromisoformat(end_date)

        logger.debug(f"Date range parsed | start={start_date} | end={end_date}")

        # Verify squad exists and get squad info
        squad_result = await db.execute(
            select(Squad.id, Squad.name).where(Squad.id == squad_id)
        )
        squad_row = squad_result.first()

        if not squad_row:
            raise HTTPException(status_code=404, detail="Squad not found")

        squad_info = {"id": str(squad_row.id), "name": squad_row.name}

        # Get all swimmers in the squad
        swimmers_result = await db.execute(
            select(Swimmer.id, Swimmer.first_name, Swimmer.last_name)
            .where(Swimmer.squad_id == squad_id)
        )
        swimmers_rows = swimmers_result.all()

        if not swimmers_rows:
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

        swimmer_ids = [str(row.id) for row in swimmers_rows]
        logger.debug(f"Found {len(swimmer_ids)} swimmers in squad")

        # Get all workout results for these swimmers within date range
        results_query = (
            select(
                WorkoutResult.id, WorkoutResult.swimmer_id, WorkoutResult.performed_on,
                WorkoutResult.time_result, WorkoutResult.distance, WorkoutResult.stroke,
                WorkoutResult.activity, WorkoutResult.equipment, WorkoutResult.result_units
            )
            .where(WorkoutResult.swimmer_id.in_(swimmer_ids))
            .where(WorkoutResult.performed_on >= start_date)
            .where(WorkoutResult.performed_on <= end_date)
            .where(WorkoutResult.activity == "swim")
            .order_by(WorkoutResult.performed_on.asc())
        )
        results_result = await db.execute(results_query)
        results_rows = results_result.all()

        logger.debug(f"Found {len(results_rows)} workout results in date range")

        # Get best times BEFORE start_date for baseline comparison
        baseline_query = (
            select(
                WorkoutResult.swimmer_id, WorkoutResult.performed_on,
                WorkoutResult.time_result, WorkoutResult.distance, WorkoutResult.stroke,
                WorkoutResult.activity, WorkoutResult.equipment, WorkoutResult.result_units
            )
            .where(WorkoutResult.swimmer_id.in_(swimmer_ids))
            .where(WorkoutResult.performed_on < start_date)
            .where(WorkoutResult.activity == "swim")
        )
        baseline_result = await db.execute(baseline_query)
        baseline_rows = baseline_result.all()

        logger.debug(f"Found {len(baseline_rows)} baseline results before start date")

        # Group baseline results by swimmer and event, keeping only the best time
        baseline_by_swimmer_event = {}
        for row in baseline_rows:
            swimmer_id = str(row.swimmer_id)

            if not row.stroke or not row.activity or not row.distance:
                continue

            result_units = row.result_units or 'SCM'
            event_key = f"{row.distance}M_{row.stroke}_{row.activity}_{result_units}"
            if row.equipment and row.equipment != 'none':
                event_key += f"_{row.equipment}"

            time_seconds = _time_to_seconds(str(row.time_result) if row.time_result else None)
            if time_seconds == 0:
                continue

            key = (swimmer_id, event_key)

            # Keep only the best (fastest) baseline time for each swimmer/event
            if key not in baseline_by_swimmer_event or time_seconds < baseline_by_swimmer_event[key]['time_seconds']:
                baseline_by_swimmer_event[key] = {
                    'date': str(row.performed_on) if row.performed_on else None,
                    'time_seconds': time_seconds,
                    'time_display': str(row.time_result) if row.time_result else None,
                    'distance': row.distance,
                    'stroke': row.stroke,
                    'activity': row.activity,
                    'units': None,
                    'result_units': result_units,
                    'is_baseline': True
                }

        logger.debug(f"Processed {len(baseline_by_swimmer_event)} unique baseline times")

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
        for s in swimmers_rows:
            swimmer_lookup[str(s.id)] = f"{s.first_name} {s.last_name}"

        logger.debug("Processing results...")
        # Process results
        for row in results_rows:
            swimmer_id = str(row.swimmer_id)

            # Skip results with missing critical data
            if not row.stroke or not row.activity or not row.distance:
                logger.debug(f"Skipping result with missing data: {row.id}")
                continue

            # Build event key - include result_units (SCM/LCM) to separate short course from long course
            result_units = row.result_units or 'SCM'
            event_key = f"{row.distance}M_{row.stroke}_{row.activity}_{result_units}"
            if row.equipment and row.equipment != 'none':
                event_key += f"_{row.equipment}"

            # Parse time to seconds
            time_seconds = _time_to_seconds(str(row.time_result) if row.time_result else None)

            swimmer_data[swimmer_id]['swimmer_id'] = swimmer_id
            swimmer_data[swimmer_id]['swimmer_name'] = swimmer_lookup.get(swimmer_id, 'Unknown')
            swimmer_data[swimmer_id]['total_workouts'] += 1
            swimmer_data[swimmer_id]['events'][event_key].append({
                'date': str(row.performed_on) if row.performed_on else None,
                'time_seconds': time_seconds,
                'time_display': str(row.time_result) if row.time_result else None,
                'distance': row.distance,
                'stroke': row.stroke,
                'activity': row.activity,
                'units': None,
                'result_units': result_units,
                'is_baseline': False
            })

        # Add baseline results to swimmer data
        for (swimmer_id, event_key), baseline in baseline_by_swimmer_event.items():
            if swimmer_id in swimmer_data:
                # Only add baseline if we have results in the period for this event
                if event_key in swimmer_data[swimmer_id]['events']:
                    swimmer_data[swimmer_id]['events'][event_key].append(baseline)
                    logger.debug(f"Added baseline for {swimmer_id} {event_key}: {baseline['time_seconds']}s on {baseline['date']}")

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

                # Build timeline - for each date, keep only the fastest attempt
                timeline_by_date = {}
                for a in sorted_attempts:
                    date_key = a['date']
                    if date_key not in timeline_by_date or a['time_seconds'] < timeline_by_date[date_key]['time']:
                        timeline_by_date[date_key] = {
                            'date': a['date'],
                            'time': a['time_seconds'],
                            'is_baseline': a.get('is_baseline', False)
                        }

                # Convert back to sorted list
                deduplicated_timeline = sorted(timeline_by_date.values(), key=lambda x: x['date'])

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
                    'timeline': deduplicated_timeline
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

        # Improved weighted improvement aggregation with outlier protection
        # Cap individual values at +/-100% before aggregation to prevent extreme outliers
        def cap_improvement(value: float, cap: float = 100.0) -> float:
            if value is None:
                return 0.0
            return max(-cap, min(cap, value))

        capped_weighted_improvements = [cap_improvement(s['weighted_improvement_pct']) for s in swimmers_performance]

        # Use median instead of mean (more robust to outliers)
        squad_median_weighted_improvement = statistics.median(capped_weighted_improvements) if capped_weighted_improvements else 0

        # Calculate improvement distribution for actionable insights
        swimmers_improving = sum(1 for w in capped_weighted_improvements if w < -1)  # Improving by >1%
        swimmers_stable = sum(1 for w in capped_weighted_improvements if -1 <= w <= 1)  # Stable +/-1%
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
                # Robust weighted improvement metric (median with +/-100% caps)
                "median_weighted_improvement": round(squad_median_weighted_improvement, 2),
                # Distribution metrics for actionable insights
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


@router.get("/{squad_id}/event-statistics")
async def get_squad_event_statistics(
    squad_id: str,
    distance: Optional[int] = None,
    stroke: Optional[str] = None,
    activity: Optional[str] = None,
    result_units: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get aggregated statistics for a specific event.

    Returns average, median, top quartile (25%), and bottom quartile (75%) times
    for a specific event across all squad swimmers.

    Query params:
    - distance: Required - event distance in meters
    - stroke: Required - stroke type (free, back, breast, fly, im)
    - activity: Optional - activity type (swim, kick, pull), defaults to 'swim'
    - result_units: Optional - pool type (SCM, LCM, SCY), defaults to 'SCM'
    """
    membership = await get_coach_membership(db, user_id, squad_id)
    if not membership.can_view_analytics:
        raise UnauthorizedError("Missing permission: can_view_analytics")
    try:
        logger.info(f"User {user_id} fetching event statistics | squad_id={squad_id} | distance={distance} | stroke={stroke} | activity={activity} | units={result_units}")

        # Validate required parameters
        if not distance or not stroke:
            raise HTTPException(status_code=400, detail="distance and stroke are required")

        # Set defaults
        activity = activity or 'swim'
        result_units = result_units or 'SCM'

        # Verify squad exists
        squad_result = await db.execute(
            select(Squad.id, Squad.name).where(Squad.id == squad_id)
        )
        squad_row = squad_result.first()
        if not squad_row:
            raise HTTPException(status_code=404, detail="Squad not found")

        squad_info = {"id": str(squad_row.id), "name": squad_row.name}

        # Get all swimmers in the squad
        swimmers_result = await db.execute(
            select(Swimmer.id).where(Swimmer.squad_id == squad_id)
        )
        swimmer_id_rows = swimmers_result.scalars().all()

        if not swimmer_id_rows:
            return {
                "squad": squad_info,
                "event": f"{distance}m {stroke.title()} {result_units}",
                "distance": distance,
                "stroke": stroke,
                "result_units": result_units,
                "activity": activity,
                "sample_size": 0,
                "avg_time": None,
                "median_time": None,
                "top_quartile_time": None,
                "bottom_quartile_time": None
            }

        swimmer_ids = [str(sid) for sid in swimmer_id_rows]

        # Get all workout results for this specific event
        wr_query = (
            select(WorkoutResult.time_result, WorkoutResult.swimmer_id)
            .where(WorkoutResult.swimmer_id.in_(swimmer_ids))
            .where(WorkoutResult.distance == distance)
            .where(WorkoutResult.stroke == stroke)
            .where(WorkoutResult.result_units == result_units)
            .where(WorkoutResult.time_result.isnot(None))
        )

        # Filter by activity
        if activity:
            wr_query = wr_query.where(WorkoutResult.activity == activity)

        wr_result = await db.execute(wr_query)
        wr_rows = wr_result.all()

        if not wr_rows:
            return {
                "squad": squad_info,
                "event": f"{distance}m {stroke.title()} {result_units}",
                "distance": distance,
                "stroke": stroke,
                "result_units": result_units,
                "activity": activity,
                "sample_size": 0,
                "avg_time": None,
                "median_time": None,
                "top_quartile_time": None,
                "bottom_quartile_time": None
            }

        # Group by swimmer and get their best (fastest) time only
        swimmer_best_times = {}

        for row in wr_rows:
            swimmer_id = str(row.swimmer_id)
            time_result = str(row.time_result) if row.time_result else None

            if isinstance(time_result, str):
                try:
                    match = re.match(r'(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)', time_result)
                    if match:
                        hours = int(match.group(1)) if match.group(1) else 0
                        minutes = int(match.group(2))
                        seconds = float(match.group(3))
                        total_seconds = hours * 3600 + minutes * 60 + seconds

                        # Keep only the best (fastest/lowest) time for each swimmer
                        if swimmer_id not in swimmer_best_times or total_seconds < swimmer_best_times[swimmer_id]:
                            swimmer_best_times[swimmer_id] = total_seconds
                except:
                    continue

        # Convert to list of best times
        times = list(swimmer_best_times.values())

        if len(times) < 3:
            return {
                "squad": squad_info,
                "event": f"{distance}m {stroke.title()} {result_units}",
                "distance": distance,
                "stroke": stroke,
                "result_units": result_units,
                "activity": activity,
                "sample_size": len(times),
                "avg_time": None,
                "median_time": None,
                "top_quartile_time": None,
                "bottom_quartile_time": None
            }

        # Sort times
        times_sorted = sorted(times)
        n = len(times_sorted)

        # Calculate percentiles
        def percentile(data, p):
            """Calculate percentile using linear interpolation"""
            k = (n - 1) * p
            f = int(k)
            c = k - f
            if f + 1 < n:
                return data[f] + c * (data[f + 1] - data[f])
            return data[f]

        avg_time = sum(times_sorted) / n
        median_time = percentile(times_sorted, 0.5)
        top_quartile = percentile(times_sorted, 0.25)
        bottom_quartile = percentile(times_sorted, 0.75)

        logger.info(f"Event statistics calculated | sample_size={n} | avg={avg_time:.2f}s | median={median_time:.2f}s")

        return {
            "squad": squad_info,
            "event": f"{distance}m {stroke.title()} {result_units}",
            "distance": distance,
            "stroke": stroke,
            "result_units": result_units,
            "activity": activity,
            "sample_size": n,
            "avg_time": avg_time,
            "median_time": median_time,
            "top_quartile_time": top_quartile,
            "bottom_quartile_time": bottom_quartile
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching event statistics: {str(e)}")
        log_error(e, context="get_squad_event_statistics", squad_id=squad_id)
        raise HTTPException(status_code=500, detail=f"Failed to fetch event statistics: {str(e)}")


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
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get attendance analytics for all swimmers in a squad over a date range.

    Returns attendance rates (present, late, absent percentages) for each swimmer
    and squad-wide statistics.
    """
    membership = await get_coach_membership(db, user_id, squad_id)
    if not membership.can_view_analytics:
        raise UnauthorizedError("Missing permission: can_view_analytics")
    try:
        logger.info(f"User {user_id} fetching squad attendance | squad_id={squad_id} | date_range={start_date} to {end_date}")

        # Parse and validate dates — keep as date objects for SQLAlchemy
        if not start_date:
            start_date = (datetime.now() - timedelta(days=90)).date()
        else:
            start_date = date.fromisoformat(start_date)

        if not end_date:
            end_date = datetime.now().date()
        else:
            end_date = date.fromisoformat(end_date)

        logger.debug(f"Date range parsed | start={start_date} | end={end_date}")

        # Verify squad exists and get squad info
        squad_result = await db.execute(
            select(Squad.id, Squad.name).where(Squad.id == squad_id)
        )
        squad_row = squad_result.first()

        if not squad_row:
            raise HTTPException(status_code=404, detail="Squad not found")

        squad_info = {"id": str(squad_row.id), "name": squad_row.name}

        # Get all sessions in date range for this squad
        sessions_query = (
            select(TrainingSession.id, TrainingSession.start_date)
            .where(TrainingSession.squad_id == squad_id)
            .where(TrainingSession.start_date >= start_date)
            .where(TrainingSession.start_date <= end_date)
        )
        sessions_result = await db.execute(sessions_query)
        sessions_rows = sessions_result.all()

        if not sessions_rows:
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

        session_ids = [str(row.id) for row in sessions_rows]
        total_sessions = len(session_ids)
        logger.debug(f"Found {total_sessions} training sessions in date range")

        # Get all swimmers in the squad
        swimmers_result = await db.execute(
            select(Swimmer.id, Swimmer.first_name, Swimmer.last_name)
            .where(Swimmer.squad_id == squad_id)
        )
        swimmers_rows = swimmers_result.all()

        if not swimmers_rows:
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
        attendance_query = (
            select(TrainingAttendance.swimmer_id, TrainingAttendance.training_session_id, TrainingAttendance.status)
            .where(TrainingAttendance.training_session_id.in_(session_ids))
        )
        attendance_result = await db.execute(attendance_query)
        attendance_rows = attendance_result.all()

        logger.debug(f"Found {len(attendance_rows)} attendance records")

        # Build swimmer attendance data
        swimmer_attendance = {}
        for swimmer in swimmers_rows:
            swimmer_id = str(swimmer.id)
            swimmer_name = f"{swimmer.first_name} {swimmer.last_name}"

            # Filter attendance for this swimmer
            swimmer_records = [r for r in attendance_rows if str(r.swimmer_id) == swimmer_id]

            # Count by status
            present = sum(1 for r in swimmer_records if r.status and r.status.lower() == 'present')
            late = sum(1 for r in swimmer_records if r.status and r.status.lower() == 'late')
            absent = sum(1 for r in swimmer_records if r.status and r.status.lower() == 'absent')

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


@router.get("/{squad_id}/compare-swimmers")
async def compare_swimmers(
    squad_id: str,
    swimmer_a_id: str,
    swimmer_b_id: str,
    normalize_by_age: bool = False,
    target_age: Optional[int] = None,
    events: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Compare two swimmers with comprehensive head-to-head analysis and trend projections.

    Returns performance comparison including:
    - Head-to-head event results
    - Personal bests comparison
    - Historical trend analysis (improvement velocity, consistency)
    - Predictive projections

    Query params:
    - swimmer_a_id: Required - First swimmer UUID
    - swimmer_b_id: Required - Second swimmer UUID
    - normalize_by_age: If True, only compare results from matching ages
    - target_age: Specific age to compare (requires normalize_by_age=True)
    - events: Comma-separated event keys to filter (e.g., "100_free,200_im")
    - date_from: Optional - Filter results from this date (YYYY-MM-DD)
    - date_to: Optional - Filter results until this date (YYYY-MM-DD)
    """
    membership = await get_coach_membership(db, user_id, squad_id)
    if not membership.can_view_analytics:
        raise UnauthorizedError("Missing permission: can_view_analytics")
    try:
        logger.info(
            f"User {user_id} comparing swimmers | squad_id={squad_id} | "
            f"swimmer_a={swimmer_a_id} | swimmer_b={swimmer_b_id} | "
            f"normalize_by_age={normalize_by_age} | target_age={target_age}"
        )

        # Verify squad exists and user has access
        squad_result = await db.execute(
            select(Squad.id, Squad.name).where(Squad.id == squad_id)
        )
        squad_row = squad_result.first()
        if not squad_row:
            raise HTTPException(status_code=404, detail="Squad not found")

        # Verify coach has access to squad
        coach_squad_result = await db.execute(
            select(CoachSquad.squad_id)
            .where(CoachSquad.coach_id == user_id)
            .where(CoachSquad.squad_id == squad_id)
        )
        if not coach_squad_result.first():
            raise HTTPException(status_code=403, detail="Not authorized to access this squad")

        # Fetch swimmer A data with squad info
        swimmer_a_result = await db.execute(
            select(Swimmer)
            .options(selectinload(Swimmer.squad))
            .where(Swimmer.id == swimmer_a_id)
        )
        swimmer_a_obj = swimmer_a_result.scalar_one_or_none()

        if not swimmer_a_obj:
            raise HTTPException(status_code=404, detail=f"Swimmer A ({swimmer_a_id}) not found")

        swimmer_a_data = {
            'id': str(swimmer_a_obj.id),
            'first_name': swimmer_a_obj.first_name,
            'last_name': swimmer_a_obj.last_name,
            'date_of_birth': str(swimmer_a_obj.date_of_birth) if swimmer_a_obj.date_of_birth else None,
            'squad_id': str(swimmer_a_obj.squad_id) if swimmer_a_obj.squad_id else None,
        }

        # Verify swimmer A belongs to accessible squad
        swimmer_a_squad_id = swimmer_a_data['squad_id']
        coach_access_a_result = await db.execute(
            select(CoachSquad.squad_id)
            .where(CoachSquad.coach_id == user_id)
            .where(CoachSquad.squad_id == swimmer_a_squad_id)
        )
        if not coach_access_a_result.first():
            raise HTTPException(status_code=403, detail="Not authorized to access swimmer A's squad")

        swimmer_a_data['squad_name'] = swimmer_a_obj.squad.name if swimmer_a_obj.squad else None

        # Fetch swimmer B data with squad info
        swimmer_b_result = await db.execute(
            select(Swimmer)
            .options(selectinload(Swimmer.squad))
            .where(Swimmer.id == swimmer_b_id)
        )
        swimmer_b_obj = swimmer_b_result.scalar_one_or_none()

        if not swimmer_b_obj:
            raise HTTPException(status_code=404, detail=f"Swimmer B ({swimmer_b_id}) not found")

        swimmer_b_data = {
            'id': str(swimmer_b_obj.id),
            'first_name': swimmer_b_obj.first_name,
            'last_name': swimmer_b_obj.last_name,
            'date_of_birth': str(swimmer_b_obj.date_of_birth) if swimmer_b_obj.date_of_birth else None,
            'squad_id': str(swimmer_b_obj.squad_id) if swimmer_b_obj.squad_id else None,
        }

        # Verify swimmer B belongs to accessible squad
        swimmer_b_squad_id = swimmer_b_data['squad_id']
        coach_access_b_result = await db.execute(
            select(CoachSquad.squad_id)
            .where(CoachSquad.coach_id == user_id)
            .where(CoachSquad.squad_id == swimmer_b_squad_id)
        )
        if not coach_access_b_result.first():
            raise HTTPException(status_code=403, detail="Not authorized to access swimmer B's squad")

        swimmer_b_data['squad_name'] = swimmer_b_obj.squad.name if swimmer_b_obj.squad else None

        # Validate both swimmers have date_of_birth
        if not swimmer_a_data.get('date_of_birth'):
            raise HTTPException(status_code=400, detail="Swimmer A missing date of birth")
        if not swimmer_b_data.get('date_of_birth'):
            raise HTTPException(status_code=400, detail="Swimmer B missing date of birth")

        # Fetch all workout results for swimmer A
        query_a = (
            select(WorkoutResult)
            .where(WorkoutResult.swimmer_id == swimmer_a_id)
            .where(WorkoutResult.activity == 'swim')
            .where(WorkoutResult.time_result.isnot(None))
        )

        if date_from:
            query_a = query_a.where(WorkoutResult.performed_on >= date.fromisoformat(date_from))
        if date_to:
            query_a = query_a.where(WorkoutResult.performed_on <= date.fromisoformat(date_to))

        results_a_result = await db.execute(query_a)
        results_a_objs = results_a_result.scalars().all()
        results_a = [_workout_result_to_dict(r) for r in results_a_objs]

        # Fetch all workout results for swimmer B
        query_b = (
            select(WorkoutResult)
            .where(WorkoutResult.swimmer_id == swimmer_b_id)
            .where(WorkoutResult.activity == 'swim')
            .where(WorkoutResult.time_result.isnot(None))
        )

        if date_from:
            query_b = query_b.where(WorkoutResult.performed_on >= date.fromisoformat(date_from))
        if date_to:
            query_b = query_b.where(WorkoutResult.performed_on <= date.fromisoformat(date_to))

        results_b_result = await db.execute(query_b)
        results_b_objs = results_b_result.scalars().all()
        results_b = [_workout_result_to_dict(r) for r in results_b_objs]

        # Parse events filter
        events_filter = None
        if events:
            events_filter = [e.strip() for e in events.split(',')]

        # Perform comparison using service
        comparison_result = SwimmerComparisonService.compare_swimmers(
            swimmer_a_data=swimmer_a_data,
            swimmer_b_data=swimmer_b_data,
            results_a=results_a,
            results_b=results_b,
            normalize_by_age=normalize_by_age,
            target_age=target_age,
            events_filter=events_filter
        )

        logger.info(
            f"Comparison complete | events_compared={comparison_result['summary']['total_events_compared']} | "
            f"trend_events_analyzed={comparison_result['trend_analysis']['events_analyzed']}"
        )

        return comparison_result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error comparing swimmers: {str(e)}")
        log_error(e, context="compare_swimmers", squad_id=squad_id)
        raise HTTPException(status_code=500, detail=f"Failed to compare swimmers: {str(e)}")


def _workout_result_to_dict(wr: WorkoutResult) -> dict:
    """Convert a WorkoutResult ORM instance to a dict matching the old Supabase response format."""
    return {
        'id': str(wr.id),
        'swimmer_id': str(wr.swimmer_id),
        'time_result': str(wr.time_result) if wr.time_result else None,
        'stroke': wr.stroke,
        'distance': wr.distance,
        'activity': wr.activity,
        'equipment': wr.equipment,
        'meet_name': wr.meet_name,
        'meet_city': wr.meet_city,
        'meet_nation': wr.meet_nation,
        'meet_points': wr.meet_points,
        'result_units': wr.result_units,
        'performed_on': str(wr.performed_on) if wr.performed_on else None,
        'source': wr.source,
        'reaction_time': float(wr.reaction_time) if wr.reaction_time else None,
        'swimrankings_result_id': wr.swimrankings_result_id,
        'has_splits_available': wr.has_splits_available,
        'created_at': wr.created_at.isoformat() if wr.created_at else None,
    }


@router.get("/{squad_id}/benchmarks")
async def get_squad_benchmarks(
    squad_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get best times for all squad members grouped by event.
    Returns benchmarks in format: { "eventKey": [{ swimmer_id, time_seconds, performed_on }, ...] }
    """
    membership = await get_coach_membership(db, user_id, squad_id)
    if not membership.can_view_analytics:
        raise UnauthorizedError("Missing permission: can_view_analytics")
    try:
        logger.info(f"Fetching benchmarks for squad {squad_id}")

        # Get squad members (squad_id is on swimmers table)
        swimmers_result = await db.execute(
            select(Swimmer.id, Swimmer.first_name, Swimmer.last_name)
            .where(Swimmer.squad_id == squad_id)
        )
        swimmers_rows = swimmers_result.all()

        if not swimmers_rows:
            logger.info(f"No swimmers found for squad {squad_id}")
            return {}

        swimmer_ids = [str(s.id) for s in swimmers_rows]

        logger.info(f"Found {len(swimmer_ids)} swimmers in squad {squad_id}")

        # Call PostgreSQL function to get benchmarks efficiently
        # This does all the aggregation on the database server
        rpc_result = await db.execute(
            text("SELECT * FROM get_squad_benchmarks(:p_squad_id)"),
            {"p_squad_id": squad_id}
        )
        rpc_rows = rpc_result.mappings().all()

        if not rpc_rows:
            logger.info(f"No benchmarks found for squad {squad_id}")
            return {}

        logger.info(f"Retrieved {len(rpc_rows)} benchmark entries from database")

        # Group results by event key
        final_benchmarks: Dict[str, List[Dict]] = defaultdict(list)

        for row in rpc_rows:
            event_key = row['event_key']
            final_benchmarks[event_key].append({
                'swimmer_id': str(row['swimmer_id']),
                'time_seconds': row['time_seconds'],
                'performed_on': str(row['performed_on']) if row['performed_on'] else None
            })

        logger.info(f"Generated benchmarks for {len(final_benchmarks)} unique events")

        return dict(final_benchmarks)

    except Exception as e:
        logger.error(f"Error fetching squad benchmarks: {str(e)}")
        log_error(e, context="get_squad_benchmarks", squad_id=squad_id)
        raise HTTPException(status_code=500, detail=f"Failed to fetch squad benchmarks: {str(e)}")


@router.get("/{squad_id}/overall-rankings")
async def get_squad_overall_rankings(
    squad_id: str,
    result_units: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Get overall pentathlon rankings for a squad.
    Ranks swimmers by combined time across 5 events:
    50 Fly, 100 Back, 100 Breast, 200 Free, 200 IM

    Args:
        squad_id: Squad identifier
        result_units: Course type (SCM or LCM)
        user_id: Current user ID for authorization

    Returns:
        List of rankings with swimmer info and individual event times
    """
    membership = await get_coach_membership(db, user_id, squad_id)
    if not membership.can_view_analytics:
        raise UnauthorizedError("Missing permission: can_view_analytics")
    try:
        performance_service = PerformanceService(db=db)
        rankings = await performance_service.get_overall_rankings(
            squad_id=squad_id,
            result_units=result_units,
            user_id=user_id,
            db=db,
        )
        return rankings
    except Exception as e:
        logger.error(f"Error fetching overall rankings: {str(e)}")
        log_error(e, context="get_overall_rankings", squad_id=squad_id, result_units=result_units)
        raise HTTPException(status_code=500, detail=f"Failed to fetch overall rankings: {str(e)}")


@router.get("/{squad_id}/qualifiers")
async def get_squad_qualifiers(
    squad_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all swimmers in squad with their best times for qualifiers tab.

    Eliminates N+1 query problem by fetching all swimmers and their best times
    in 2 efficient queries instead of 1 + N individual queries.

    Performance improvement: 19 requests -> 2 queries, ~1900-3800ms -> ~150-300ms
    """
    membership = await get_coach_membership(db, user_id, squad_id)
    if not membership.can_view_analytics:
        raise UnauthorizedError("Missing permission: can_view_analytics")
    try:
        logger.info(f"Fetching qualifiers data for squad {squad_id}")

        # 1. Get all swimmers in squad
        swimmers_result = await db.execute(
            select(Swimmer.id, Swimmer.first_name, Swimmer.last_name, Swimmer.date_of_birth, Swimmer.sex)
            .where(Swimmer.squad_id == squad_id)
        )
        swimmers_rows = swimmers_result.all()

        if not swimmers_rows:
            return {'swimmers': []}

        swimmer_ids = [str(s.id) for s in swimmers_rows]

        # 2. Get all best times for these swimmers in one query
        # Fetch only swim activities with no equipment for qualifiers
        best_times_query = (
            select(
                WorkoutResult.swimmer_id, WorkoutResult.distance, WorkoutResult.stroke,
                WorkoutResult.time_result, WorkoutResult.performed_on, WorkoutResult.activity,
                WorkoutResult.equipment, WorkoutResult.result_units
            )
            .where(WorkoutResult.swimmer_id.in_(swimmer_ids))
            .where(WorkoutResult.activity == 'swim')
            .where(WorkoutResult.equipment == 'none')
            .order_by(WorkoutResult.time_result.asc())
        )
        best_times_result = await db.execute(best_times_query)
        best_times_rows = best_times_result.all()

        best_times_data = []
        for row in best_times_rows:
            record = {
                'swimmer_id': str(row.swimmer_id),
                'distance': row.distance,
                'stroke': row.stroke,
                'time_result': str(row.time_result) if row.time_result else None,
                'performed_on': str(row.performed_on) if row.performed_on else None,
                'activity': row.activity,
                'equipment': row.equipment,
                'result_units': row.result_units,
            }
            record['time_seconds'] = _time_to_seconds(record['time_result'])
            best_times_data.append(record)

        # Aggregate best times by swimmer and event
        swimmer_best_times = defaultdict(dict)
        for result in best_times_data:
            swimmer_id = result['swimmer_id']
            result_units = result.get('result_units', 'SCM')
            event_key = f"{result['distance']}_{result['stroke']}_{result_units}"

            # Keep only the fastest time for each event
            if event_key not in swimmer_best_times[swimmer_id]:
                swimmer_best_times[swimmer_id][event_key] = {
                    'distance': result['distance'],
                    'stroke': result['stroke'],
                    'activity': result['activity'],
                    'equipment': result['equipment'],
                    'result_units': result_units,
                    'time_result': result['time_result'],
                    'time_seconds': result['time_seconds'],
                    'performed_on': result['performed_on']
                }
            else:
                # Update if this time is faster
                existing = swimmer_best_times[swimmer_id][event_key]
                if result['time_seconds'] < existing['time_seconds']:
                    swimmer_best_times[swimmer_id][event_key] = {
                        'distance': result['distance'],
                        'stroke': result['stroke'],
                        'activity': result['activity'],
                        'equipment': result['equipment'],
                        'result_units': result_units,
                        'time_result': result['time_result'],
                        'time_seconds': result['time_seconds'],
                        'performed_on': result['performed_on']
                    }

        # Combine swimmers with their best times
        result_swimmers = []
        for swimmer in swimmers_rows:
            swimmer_id = str(swimmer.id)
            best_times = list(swimmer_best_times.get(swimmer_id, {}).values())

            result_swimmers.append({
                'swimmer_id': swimmer_id,
                'first_name': swimmer.first_name,
                'last_name': swimmer.last_name,
                'date_of_birth': str(swimmer.date_of_birth) if swimmer.date_of_birth else None,
                'sex': 'M' if swimmer.sex == 'Male' else 'F',
                'best_times': best_times
            })

        logger.info(f"Successfully fetched {len(result_swimmers)} swimmers with best times")

        return {'swimmers': result_swimmers}

    except Exception as e:
        logger.error(f"Error fetching squad qualifiers: {str(e)}")
        log_error(e, context="get_squad_qualifiers", squad_id=squad_id)
        raise HTTPException(status_code=500, detail=f"Failed to fetch squad qualifiers: {str(e)}")


@router.get("/{squad_id}/metrics/summary")
async def get_squad_metrics_summary(
    squad_id: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get comprehensive squad metrics in a single optimized backend aggregation.

    Replaces 6 separate API calls with 1 endpoint that efficiently fetches and aggregates:
    - Attendance stats (present/late/absent)
    - Session count
    - Total meters
    - Distance per week (for charts)
    - Stroke breakdown
    - Activity breakdown

    Strategy: Fetch training sessions with workout templates in one query,
    then aggregate in Python for better performance and maintainability.
    """
    membership = await get_coach_membership(db, user_id, squad_id)
    if not membership.can_view_analytics:
        raise UnauthorizedError("Missing permission: can_view_analytics")
    try:
        logger.info(f"Fetching metrics summary for squad {squad_id}, from={from_date}, to={to_date}")

        # Build query for training sessions with workout templates
        sessions_query = (
            select(TrainingSession)
            .options(selectinload(TrainingSession.workout_template))
            .where(TrainingSession.squad_id == squad_id)
            .order_by(TrainingSession.start_date.asc())
        )

        if from_date:
            sessions_query = sessions_query.where(TrainingSession.start_date >= datetime.fromisoformat(from_date.replace("Z", "+00:00")))
        if to_date:
            sessions_query = sessions_query.where(TrainingSession.start_date <= datetime.fromisoformat(to_date.replace("Z", "+00:00")))

        sessions_result = await db.execute(sessions_query)
        sessions = sessions_result.scalars().all()

        # Fetch attendance data for all sessions in one query
        session_ids = [str(s.id) for s in sessions]
        attendance_data = []
        if session_ids:
            attendance_query = (
                select(TrainingAttendance.status, TrainingAttendance.training_session_id)
                .where(TrainingAttendance.training_session_id.in_(session_ids))
            )
            attendance_result = await db.execute(attendance_query)
            attendance_data = attendance_result.all()

        # Aggregate metrics in Python

        # 1. Attendance stats
        attendance_counts = {'present': 0, 'late': 0, 'absent': 0}
        for record in attendance_data:
            status = record.status or ''
            if status in attendance_counts:
                attendance_counts[status] += 1

        # 2. Session count
        session_count = len(sessions)

        # 3. Total meters and weekly breakdown
        total_meters = 0
        weekly_meters = defaultdict(int)
        stroke_breakdown = defaultdict(int)
        activity_breakdown = defaultdict(int)

        for session in sessions:
            workout = session.workout_template
            if not workout:
                continue

            # Add to total meters
            meters = workout.total_meters or 0
            total_meters += meters

            # Weekly breakdown
            session_start_date = session.start_date
            if session_start_date:
                try:
                    if isinstance(session_start_date, datetime):
                        dt = session_start_date
                    else:
                        dt = datetime.fromisoformat(str(session_start_date).replace('Z', '+00:00'))
                    # ISO week format: YYYY-Wnn
                    week_key = dt.strftime('%Y-W%V')
                    weekly_meters[week_key] += meters
                except:
                    pass

            # Stroke and activity breakdown from json_description
            json_desc = workout.json_description or {}
            if json_desc:
                # Try versioned format first
                analysis = json_desc.get('analysis', {})
                if not analysis:
                    # Fallback to old estimate format
                    analysis = json_desc.get('estimate', {})

                # Aggregate stroke breakdown
                strokes = analysis.get('stroke_breakdown') or analysis.get('strokeBreakdown', {})
                for stroke, stroke_meters in strokes.items():
                    if stroke != 'total' and stroke_meters:
                        # Normalize stroke names (IM variations)
                        normalized_stroke = 'im' if stroke.lower() in ['im', 'individualmedley'] else stroke.lower()
                        stroke_breakdown[normalized_stroke] += stroke_meters

                # Aggregate activity breakdown
                activities = analysis.get('activity_breakdown') or analysis.get('activityBreakdown', {})
                for activity_name, activity_meters in activities.items():
                    if activity_name != 'total' and activity_meters:
                        activity_breakdown[activity_name.lower()] += activity_meters

        # Format response
        result = {
            'attendance': attendance_counts,
            'session_count': session_count,
            'total_meters': total_meters,
            'distance_per_week': [
                {'week': week, 'meters': meters}
                for week, meters in sorted(weekly_meters.items())
            ],
            'stroke_breakdown': [
                {'stroke': stroke, 'meters': meters}
                for stroke, meters in sorted(stroke_breakdown.items(), key=lambda x: x[1], reverse=True)
            ],
            'activity_breakdown': [
                {'activity': activity, 'meters': meters}
                for activity, meters in sorted(activity_breakdown.items(), key=lambda x: x[1], reverse=True)
            ]
        }

        logger.info(f"Successfully aggregated metrics: {session_count} sessions, {total_meters} meters")

        return result

    except Exception as e:
        logger.error(f"Error fetching squad metrics summary: {str(e)}")
        log_error(e, context="get_squad_metrics_summary", squad_id=squad_id)
        raise HTTPException(status_code=500, detail=f"Failed to fetch squad metrics summary: {str(e)}")


@router.get("/{squad_id}/predictions")
async def get_squad_predictions(
    squad_id: str,
    attempts_until_target: int = 5,
    min_attempts: int = 5,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Get improvement predictions for all swimmers in a squad.

    Returns predicted future times based on historical performance trends for each swimmer.
    Only events with sufficient data (min_attempts) will have predictions.
    """
    membership = await get_coach_membership(db, user_id, squad_id)
    if not membership.can_view_analytics:
        raise UnauthorizedError("Missing permission: can_view_analytics")
    try:
        from app.services.prediction import PredictionService, WorkoutContext, ImprovementAnalyzer, AchievementValidator, GapAnalyzer
        from app.services.performance_service import PerformanceService
        from app.domain.value_objects.time import interval_to_seconds

        # Get all swimmers in the squad
        swimmers_result = await db.execute(
            select(Swimmer.id, Swimmer.first_name, Swimmer.last_name, Swimmer.date_of_birth)
            .where(Swimmer.squad_id == squad_id)
        )
        swimmers_rows = swimmers_result.all()

        if not swimmers_rows:
            return {
                'squad_id': squad_id,
                'predictions': {},
                'total_swimmers': 0,
                'total_predictions': 0
            }

        swimmers = [
            {
                'id': str(s.id),
                'first_name': s.first_name,
                'last_name': s.last_name,
                'date_of_birth': str(s.date_of_birth) if s.date_of_birth else None
            }
            for s in swimmers_rows
        ]
        swimmer_ids = [s['id'] for s in swimmers]

        # Fetch attendance data for last 30 days for all swimmers
        thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).isoformat()

        attendance_query = (
            select(TrainingAttendance.swimmer_id, TrainingAttendance.status, TrainingAttendance.training_session_id)
            .where(TrainingAttendance.swimmer_id.in_(swimmer_ids))
            .where(TrainingAttendance.created_at >= thirty_days_ago)
        )
        attendance_result = await db.execute(attendance_query)
        attendance_rows = attendance_result.all()

        # Group attendance by swimmer
        swimmer_attendance = defaultdict(list)
        swimmer_session_ids = defaultdict(set)
        for att in attendance_rows:
            swimmer_id = str(att.swimmer_id) if att.swimmer_id else None
            if swimmer_id:
                swimmer_attendance[swimmer_id].append(att.status or '')
                if att.status == 'present' and att.training_session_id:
                    swimmer_session_ids[swimmer_id].add(str(att.training_session_id))

        # Calculate attendance rates
        swimmer_attendance_rates = {}
        for swimmer_id, statuses in swimmer_attendance.items():
            total = len(statuses)
            present = sum(1 for s in statuses if s.lower() == 'present')
            if total > 0:
                swimmer_attendance_rates[swimmer_id] = round((present / total * 100), 1)

        # Calculate squad average attendance
        squad_avg_attendance = None
        if swimmer_attendance_rates:
            rates = list(swimmer_attendance_rates.values())
            squad_avg_attendance = round(sum(rates) / len(rates), 1)

        # Fetch all workout results for all swimmers in one query
        performance_service = PerformanceService(db=db)

        wr_query = (
            select(
                WorkoutResult.swimmer_id, WorkoutResult.distance, WorkoutResult.stroke,
                WorkoutResult.activity, WorkoutResult.result_units, WorkoutResult.time_result,
                WorkoutResult.performed_on
            )
            .where(WorkoutResult.swimmer_id.in_(swimmer_ids))
            .order_by(WorkoutResult.performed_on.asc())
        )
        wr_result = await db.execute(wr_query)
        wr_rows = wr_result.all()

        # Group results by swimmer and event
        swimmer_events_data = defaultdict(lambda: defaultdict(list))

        for row in wr_rows:
            swimmer_id = str(row.swimmer_id) if row.swimmer_id else None
            distance_val = str(row.distance) if row.distance else ''
            stroke = (row.stroke or '').lower()
            units = row.result_units or 'LCM'
            activity = (row.activity or 'swim').lower()

            event_key = f"{distance_val}_{stroke}_{units}_{activity}"

            time_result = str(row.time_result) if row.time_result else None
            performed_on = str(row.performed_on) if row.performed_on else None

            if time_result and performed_on and swimmer_id:
                try:
                    # Convert interval to seconds
                    time_seconds = interval_to_seconds(time_result)

                    event_display = f"{distance_val}m {stroke.title()} {activity.title()} {units}"

                    swimmer_events_data[swimmer_id][event_key].append({
                        'time_seconds': time_seconds,
                        'performed_on': performed_on,
                        'event_display': event_display
                    })
                except Exception as e:
                    logger.warning(f"Failed to convert time_result '{time_result}': {e}")
                    continue

        # Calculate squad improvement rates for comparison
        squad_improvement_rates = {}
        start_date_pred = (datetime.utcnow() - timedelta(days=90)).isoformat()

        for swimmer_id, events_map in swimmer_events_data.items():
            for event_key, event_results in events_map.items():
                if event_key not in squad_improvement_rates:
                    squad_improvement_rates[event_key] = []

                if len(event_results) >= 2:
                    times = [r['time_seconds'] for r in sorted(event_results, key=lambda x: x['performed_on'])]
                    rate = ImprovementAnalyzer.calculate_improvement_per_attempt(times)
                    squad_improvement_rates[event_key].append(rate)

        # Average squad rates
        for event_key in squad_improvement_rates:
            if squad_improvement_rates[event_key]:
                squad_improvement_rates[event_key] = statistics.mean(squad_improvement_rates[event_key])
            else:
                squad_improvement_rates[event_key] = None

        # Fetch workout context for attended sessions
        all_session_ids = set()
        for session_ids_set in swimmer_session_ids.values():
            all_session_ids.update(session_ids_set)

        session_workouts = {}
        if all_session_ids:
            workouts_query = (
                select(TrainingSession)
                .options(selectinload(TrainingSession.workout_template))
                .where(TrainingSession.id.in_(list(all_session_ids)))
                .where(TrainingSession.start_date >= thirty_days_ago)
            )
            workouts_result = await db.execute(workouts_query)
            workouts_sessions = workouts_result.scalars().all()

            for session in workouts_sessions:
                workout_template = session.workout_template
                if workout_template:
                    effort_level = workout_template.effort_level
                    json_desc = workout_template.json_description or {}

                    # Categorize workout type
                    if effort_level is not None:
                        if effort_level >= 7:
                            workout_type = 'sprint'
                        elif effort_level <= 4:
                            workout_type = 'endurance'
                        elif effort_level in [5, 6]:
                            if isinstance(json_desc, dict):
                                activity_breakdown_val = json_desc.get('activity_breakdown', {})
                                drill_pct = activity_breakdown_val.get('Drill', 0)
                                workout_type = 'technique' if drill_pct > 30 else 'mixed'
                            else:
                                workout_type = 'mixed'
                        else:
                            workout_type = 'mixed'
                    else:
                        workout_type = 'mixed'

                    session_workouts[str(session.id)] = WorkoutContext(
                        total_meters=workout_template.total_meters or 0,
                        effort_level=effort_level,
                        session_date=session.start_date.isoformat() if session.start_date else None,
                        workout_type=workout_type
                    )

        # Calculate squad average training volume
        swimmer_volumes = {}
        for swimmer_id, s_session_ids in swimmer_session_ids.items():
            total_volume = sum(
                session_workouts[sid].total_meters
                for sid in s_session_ids
                if sid in session_workouts and session_workouts[sid].total_meters
            )
            if total_volume > 0:
                swimmer_volumes[swimmer_id] = total_volume

        squad_avg_volume = None
        if swimmer_volumes:
            volumes = list(swimmer_volumes.values())
            squad_avg_volume = round(sum(volumes) / len(volumes))

        # Generate predictions for each swimmer
        all_predictions = {}
        total_predictions_count = 0

        for swimmer in swimmers:
            swimmer_id = swimmer['id']
            swimmer_name = f"{swimmer['first_name']} {swimmer['last_name']}"

            # Calculate swimmer age
            swimmer_age = None
            if swimmer.get('date_of_birth'):
                try:
                    dob = datetime.fromisoformat(swimmer['date_of_birth'].replace('Z', '+00:00'))
                    swimmer_age = (datetime.utcnow() - dob).days // 365
                except Exception as age_error:
                    logger.warning(f"Failed to calculate swimmer age: {age_error}")

            # Get recent workouts for this swimmer
            recent_workouts = []
            if swimmer_id in swimmer_session_ids:
                for session_id in swimmer_session_ids[swimmer_id]:
                    if session_id in session_workouts:
                        recent_workouts.append(session_workouts[session_id])

            # Get attendance rate
            attendance_rate = swimmer_attendance_rates.get(swimmer_id)

            # Calculate training volume and effort for this swimmer
            recent_training_volume = swimmer_volumes.get(swimmer_id)
            avg_workout_effort = None
            if recent_workouts:
                efforts = [w.effort_level for w in recent_workouts if w.effort_level is not None]
                if efforts:
                    avg_workout_effort = round(sum(efforts) / len(efforts), 1)

            # Generate predictions for each event
            predictions = []
            events_map = swimmer_events_data.get(swimmer_id, {})

            for event_key, event_results in events_map.items():
                if len(event_results) < min_attempts:
                    continue

                # Sort by date to get chronological order
                sorted_results = sorted(event_results, key=lambda x: x['performed_on'])

                # Extract times in chronological order
                all_times = [r['time_seconds'] for r in sorted_results]
                all_dates = [r['performed_on'] for r in sorted_results]
                current_best = min(all_times)
                event_display = sorted_results[0]['event_display']

                # Calculate achievement rate for this event
                achievement_metrics = AchievementValidator.calculate_achievement_rate(
                    all_times=all_times,
                    all_dates=all_dates,
                    prediction_window=5,
                    attempts_horizon=10
                )

                # Calculate days since last result
                days_since_last_result = None
                if sorted_results:
                    try:
                        last_result_date = datetime.fromisoformat(sorted_results[-1]['performed_on'].replace('Z', '+00:00'))
                        days_since_last_result = (datetime.utcnow() - last_result_date).days
                    except Exception as date_error:
                        logger.warning(f"Failed to calculate days since last result: {date_error}")

                # Get squad improvement rate for this event
                squad_rate = squad_improvement_rates.get(event_key)

                # Perform gap analysis
                gap_analysis = GapAnalyzer.analyze_prediction_gap(
                    achievement_rate=achievement_metrics['achievement_rate'],
                    predictions_tested=achievement_metrics['total_predictions'],
                    swimmer_attendance_rate=attendance_rate,
                    squad_avg_attendance=squad_avg_attendance,
                    recent_training_volume=recent_training_volume,
                    squad_avg_volume=squad_avg_volume,
                    recent_workouts=recent_workouts,
                    days_since_last_result=days_since_last_result,
                    avg_workout_effort=avg_workout_effort
                )

                # Generate prediction
                prediction = PredictionService.predict_improvement(
                    event=event_display,
                    current_best=current_best,
                    all_times=all_times,
                    attempts_until_target=attempts_until_target,
                    attendance_rate=attendance_rate,
                    squad_improvement_rate=squad_rate,
                    recent_workouts=recent_workouts if recent_workouts else None,
                    days_since_last_result=days_since_last_result,
                    swimmer_age=swimmer_age
                )

                predictions.append({
                    'event_key': event_key,
                    'event': prediction.event,
                    'current_best': prediction.current_best,
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

            # Sort predictions by distance and time
            predictions.sort(key=lambda x: (
                int(x['event_key'].split('_')[0]) if x['event_key'].split('_')[0].isdigit() else 999,
                x['current_best']
            ))

            if predictions:
                all_predictions[swimmer_id] = {
                    'swimmer_id': swimmer_id,
                    'swimmer_name': swimmer_name,
                    'predictions': predictions,
                    'total_events': len(predictions),
                    'attendance_rate': attendance_rate
                }
                total_predictions_count += len(predictions)

        return {
            'squad_id': squad_id,
            'predictions': all_predictions,
            'total_swimmers': len(swimmers),
            'swimmers_with_predictions': len(all_predictions),
            'total_predictions': total_predictions_count,
            'attempts_until_target': attempts_until_target
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching squad predictions: {str(e)}")
        log_error(e, context="get_squad_predictions", squad_id=squad_id)
        raise HTTPException(status_code=500, detail=f"Failed to fetch squad predictions: {str(e)}")


# ============================================
# SQUAD SYNC
# ============================================

@router.post("/{squad_id}/sync")
async def trigger_squad_sync(
    squad_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Trigger a SwimRankings sync for all linked swimmers in a squad.
    Requires the user to be a coach of the squad with can_manage_squad_settings.
    """
    membership = await get_coach_membership(db, user_id, squad_id)
    if not membership.can_manage_squad_settings:
        raise UnauthorizedError("Missing permission: can_manage_squad_settings")
    try:
        # Count swimmers with SwimRankings links
        link_count_result = await db.execute(
            select(func.count(SwimmerExternalLink.id))
            .join(Swimmer, SwimmerExternalLink.swimmer_id == Swimmer.id)
            .where(
                Swimmer.squad_id == squad_id,
                SwimmerExternalLink.external_source == 'swimrankings',
            )
        )
        linked_count = link_count_result.scalar() or 0

        if linked_count == 0:
            raise HTTPException(
                status_code=400,
                detail="No swimmers in this squad have SwimRankings profiles linked"
            )

        # Create job record now so we can return the job_id for polling
        job = BulkSyncJob(
            triggered_by=user_id,
            status='pending',
            total_swimmers=linked_count,
            swimmers_processed=0,
            swimmers_succeeded=0,
            swimmers_failed=0,
            started_at=datetime.utcnow(),
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)
        job_id = str(job.id)

        # Enqueue squad sync task via Celery, passing the pre-created job_id
        from app.celery_app import celery_app
        celery_app.send_task(
            'worker.sync_tasks.sync_squad_swimmers_task',
            kwargs={
                'squad_id': squad_id,
                'triggered_by_user_id': user_id,
                'job_id': job_id,
            }
        )

        return {
            'success': True,
            'job_id': job_id,
            'total_swimmers': linked_count,
            'message': f'Squad sync started for {linked_count} swimmers'
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error triggering squad sync: {str(e)}")
        log_error(e, context="trigger_squad_sync", squad_id=squad_id)
        raise HTTPException(status_code=500, detail=f"Failed to start squad sync: {str(e)}")


@router.get("/{squad_id}/sync/status/{job_id}")
async def get_squad_sync_status(
    squad_id: str,
    job_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Get status of a squad sync job.
    Requires the user to be a member of the squad.
    """
    await get_coach_membership(db, user_id, squad_id)
    try:
        # Get job status
        result = await db.execute(
            select(BulkSyncJob).where(BulkSyncJob.id == job_id)
        )
        job = result.scalar_one_or_none()

        if not job:
            raise HTTPException(status_code=404, detail=f"Sync job {job_id} not found")

        return {
            'id': str(job.id),
            'status': job.status,
            'total_swimmers': job.total_swimmers,
            'swimmers_processed': job.swimmers_processed,
            'swimmers_succeeded': job.swimmers_succeeded,
            'swimmers_failed': job.swimmers_failed,
            'started_at': job.started_at.isoformat() if job.started_at else None,
            'completed_at': job.completed_at.isoformat() if job.completed_at else None,
            'error_message': job.error_message,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting squad sync status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get sync status: {str(e)}")
