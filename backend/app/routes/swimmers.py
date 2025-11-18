# backend/app/routes/swimmers.py
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, Dict, Any, List
from supabase import create_client, Client
from app.utils import logger
import os

router = APIRouter(prefix="/api/swimmers", tags=["swimmers"])


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
