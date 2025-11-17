# backend/app/routes/squads.py
from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from datetime import datetime, timedelta
from collections import defaultdict
import os
from supabase import create_client, Client

from app.utils import logger, log_error

router = APIRouter(prefix="/squads", tags=["squads"])


def get_supabase_client() -> Client:
    """Get Supabase client instance"""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables")
    
    return create_client(supabase_url, supabase_key)


@router.get("/{squad_id}/performance")
async def get_squad_performance(
    squad_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    authorization: str = Header(None)
):
    """
    Get performance analytics for all swimmers in a squad over a date range.
    
    Returns improvement metrics, best times trends, and performance statistics
    for each swimmer in the squad.
    """
    try:
        supabase = get_supabase_client()
        logger.info(f"Fetching squad performance | squad_id={squad_id} | date_range={start_date} to {end_date}")
        
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
        
        # Process results
        for result in results_response.data:
            swimmer_id = result['swimmer_id']
            
            # Build event key - include result_units (SCM/LCM) to separate short course from long course
            result_units = result.get('result_units', 'SCM') or 'SCM'
            event_key = f"{result['distance']}{result['units'][0].upper()}_{result['stroke']}_{result['activity']}_{result_units}"
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
                improvement = ((latest_time - first_time) / first_time) * 100
                
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
                    'timeline': [{'date': a['date'], 'time': a['time_seconds']} for a in sorted_attempts]
                })
            
            # Calculate average improvement for swimmer (negative = faster)
            avg_improvement = sum(swimmer_improvements) / len(swimmer_improvements) if swimmer_improvements else 0
            # Find best improvement (most negative value = biggest improvement)
            best_improvement = min(swimmer_improvements) if swimmer_improvements else 0
            
            swimmers_performance.append({
                'swimmer_id': swimmer_id,
                'swimmer_name': data['swimmer_name'],
                'total_workouts': data['total_workouts'],
                'events_analyzed': len(events_summary),
                'personal_records': swimmer_prs,
                'avg_improvement_pct': avg_improvement,
                'best_improvement_pct': best_improvement,
                'events': events_summary
            })
            
            # Only count improvements (negative values) for squad average
            if avg_improvement < 0:
                total_improvement += abs(avg_improvement)
                improvement_count += 1
            
            total_prs += swimmer_prs
        
        # Sort by improvement (most negative = most improved)
        swimmers_performance.sort(key=lambda x: x['avg_improvement_pct'], reverse=False)
        
        # Calculate squad summary
        squad_avg_improvement = -total_improvement / improvement_count if improvement_count > 0 else 0
        most_improved = swimmers_performance[0] if swimmers_performance else None
        
        logger.info(f"Squad performance calculated | swimmers={len(swimmers_performance)} | avg_improvement={squad_avg_improvement:.2f}%")
        
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
                "total_prs": total_prs,
                "most_improved": {
                    "swimmer_id": most_improved['swimmer_id'],
                    "swimmer_name": most_improved['swimmer_name'],
                    "improvement_pct": most_improved['avg_improvement_pct']
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
