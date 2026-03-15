"""Performance-related routes - best times, splits, FINA points."""
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional, Dict, Any, List

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.services.performance_service import PerformanceService
from app.middleware.auth import get_current_user_id
from app.infrastructure.db import get_db
from app.infrastructure.models import WorkoutResult
from app.utils import logger
from app.utils.fina_calculator import calculate_fina_points, get_supported_events
from app.domain.value_objects.time import interval_to_seconds

from .error_handlers import handle_service_error

router = APIRouter()


@router.get("/{swimmer_id}/best-times")
async def get_best_times(
    swimmer_id: str,
    interval: Optional[str] = Query(None),
    stroke: Optional[str] = Query(None),
    distance: Optional[int] = Query(None),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
) -> List[Dict[str, Any]]:
    """Get best times for a swimmer with optional filters."""
    try:
        performance_service = PerformanceService(db=db)
        best_times = await performance_service.get_best_times(
            swimmer_id=swimmer_id,
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
    result_units: str = Query(default="SCM"),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get best cumulative times at each split distance for an event."""
    try:
        # Get all workout results for this event with their race_splits
        stmt = (
            select(WorkoutResult)
            .options(selectinload(WorkoutResult.race_splits))
            .where(
                and_(
                    WorkoutResult.swimmer_id == swimmer_id,
                    WorkoutResult.distance == distance,
                    WorkoutResult.stroke == stroke,
                    WorkoutResult.activity == activity,
                    WorkoutResult.equipment == equipment,
                    WorkoutResult.result_units == result_units,
                )
            )
        )
        result = await db.execute(stmt)
        workout_results = result.scalars().all()

        if not workout_results:
            return {
                "distance": distance,
                "stroke": stroke,
                "best_splits": [],
                "total_attempts_analyzed": 0
            }

        valid_attempts = [r for r in workout_results if r.time_result]

        if not valid_attempts:
            return {
                "distance": distance,
                "stroke": stroke,
                "best_splits": [],
                "total_attempts_analyzed": 0
            }

        # Build best splits map
        best_splits_map: Dict[int, Dict[str, Any]] = {}

        for attempt in valid_attempts:
            if not attempt.race_splits:
                continue

            for split in attempt.race_splits:
                split_distance = split.split_distance
                cumulative_time = split.cumulative_time

                if not cumulative_time:
                    continue

                time_seconds = interval_to_seconds(cumulative_time)

                if split_distance not in best_splits_map:
                    best_splits_map[split_distance] = {
                        'best_cumulative_time': cumulative_time,
                        'best_seconds': time_seconds,
                        'from_attempt_id': str(attempt.id),
                        'from_attempt_date': attempt.performed_on.isoformat() if attempt.performed_on else None
                    }
                else:
                    if time_seconds < best_splits_map[split_distance]['best_seconds']:
                        best_splits_map[split_distance] = {
                            'best_cumulative_time': cumulative_time,
                            'best_seconds': time_seconds,
                            'from_attempt_id': str(attempt.id),
                            'from_attempt_date': attempt.performed_on.isoformat() if attempt.performed_on else None
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
    swimmer_id: str,
    interval: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
) -> List[Dict[str, Any]]:
    """Get best splits for a swimmer (general query)."""
    try:
        performance_service = PerformanceService(db=db)
        splits = await performance_service.get_best_splits(
            swimmer_id=swimmer_id,
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
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Calculate FINA points for all of a swimmer's results."""
    try:
        performance_service = PerformanceService(db=db)

        results = await performance_service.get_workout_results(
            swimmer_id=swimmer_id,
            user_id=user_id
        )

        filtered_results = [r for r in results if r.get("result_units") == course]

        if not filtered_results:
            return _empty_fina_response(swimmer_id, gender, course)

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
            return _empty_fina_response(swimmer_id, gender, course)

        # Group by stroke
        by_stroke = _group_fina_by_stroke(results_with_points)

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
            "results_with_points": sorted(
                results_with_points,
                key=lambda x: x["fina_points"],
                reverse=True
            )
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


# === Helper Functions ===

def _empty_fina_response(swimmer_id: str, gender: str, course: str) -> Dict[str, Any]:
    """Return empty FINA response structure."""
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


def _group_fina_by_stroke(results_with_points: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Group FINA results by stroke."""
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

    return by_stroke
