# backend/app/routes/swimmers.py
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, Dict, Any, List
from supabase import create_client, Client
from app.utils import logger
from app.utils.fina_calculator import calculate_fina_points, get_supported_events
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

