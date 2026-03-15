"""
Squad analytics endpoints — metrics, distance tracking, attendance stats.

Provides GET endpoints under /squads/{squad_id}/metrics/* for
training volume, stroke breakdown, and attendance analytics.
All endpoints require squad membership with can_view_analytics permission.
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List, Dict
from datetime import date, datetime, timedelta
from collections import defaultdict

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.infrastructure.db import get_db
from app.infrastructure.models import (
    Squad, Swimmer, WorkoutTemplate,
    TrainingSession, TrainingAttendance,
)
from app.middleware.auth import get_current_user_id
from app.middleware.authorization import get_coach_membership
from app.domain.exceptions import UnauthorizedError
from app.utils import logger, log_error

router = APIRouter(prefix="/squads", tags=["squad-analytics"])


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


@router.get("/{squad_id}/attendance")
async def get_squad_attendance(
    squad_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Get attendance analytics for all swimmers in a squad over a date range."""
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


@router.get("/{squad_id}/metrics/summary")
async def get_squad_metrics_summary(
    squad_id: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Get comprehensive squad metrics in a single optimized backend aggregation."""
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
