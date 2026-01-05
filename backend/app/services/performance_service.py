"""Performance service for swim times, best splits, and FINA points."""
from typing import Dict, List, Optional, Any
import statistics
from datetime import datetime
from app.repositories.workout import WorkoutResultRepository, RaceSplitRepository
from app.services.authorization_service import AuthorizationService
from app.services.prediction.time_utils import PoolConverter
from app.domain.value_objects.time import interval_to_seconds


class PerformanceService:
    """Service for performance analysis and metrics."""
    
    def __init__(
        self,
        workout_repo: Optional[WorkoutResultRepository] = None,
        split_repo: Optional[RaceSplitRepository] = None,
        auth_service: Optional[AuthorizationService] = None
    ):
        """Initialize performance service.
        
        Args:
            workout_repo: Workout result repository
            split_repo: Race split repository
            auth_service: Authorization service for access control
        """
        self.workout_repo = workout_repo or WorkoutResultRepository()
        self.split_repo = split_repo or RaceSplitRepository()
        self.auth_service = auth_service or AuthorizationService()
    
    def _verify_swimmer_access(self, swimmer_id: str, coach_id: Optional[str]) -> None:
        """Verify coach has access to swimmer data through squad membership.
        
        Uses the authorization service to check access via coach_squads table.
        
        Args:
            swimmer_id: Swimmer identifier (UUID)
            coach_id: Coach identifier for authorization (UUID)
            
        Raises:
            NotFoundError: If swimmer not found
            UnauthorizedError: If coach not authorized
        """
        if not coach_id:
            return
        
        # Use authorization service to verify access
        self.auth_service.verify_swimmer_ownership(swimmer_id, coach_id)
    
    def get_best_times(
        self,
        swimmer_id: str,
        user_id: Optional[str] = None,
        interval: Optional[str] = None,
        stroke: Optional[str] = None,
        distance: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Get best times for a swimmer with filters, including converted times for missing courses.
        
        When a swimmer has a best time in one course (SCM or LCM) but not the other,
        this method automatically converts the time to provide an estimated time for
        the missing course. Converted times are marked with is_converted=True.
        
        Args:
            swimmer_id: Swimmer identifier (UUID)
            user_id: User ID for authorization
            interval: Time interval (week, month, 3months, 6months, year, all)
            stroke: Swimming stroke filter
            distance: Distance in meters
            
        Returns:
            List of best time records with FINA points and course conversions
        """
        self._verify_swimmer_access(swimmer_id, user_id)
        
        results = self.workout_repo.find_best_times(
            swimmer_id=swimmer_id,
            interval=interval,
            stroke=stroke,
            distance=distance
        )
        
        # Add converted times for missing courses
        results_with_conversions = self._add_course_conversions(results)
        
        return results_with_conversions
    
    def get_best_splits(
        self,
        swimmer_id: str,
        user_id: Optional[str] = None,
        interval: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get best splits for a swimmer.
        
        Args:
            swimmer_id: Swimmer identifier (UUID)
            user_id: User ID for authorization
            interval: Time interval filter
            
        Returns:
            List of best split records sorted by speed
        """
        self._verify_swimmer_access(swimmer_id, user_id)
        
        splits = self.workout_repo.find_best_splits(
            swimmer_id=swimmer_id,
            interval=interval
        )
        
        # Sort by speed (time in seconds)
        for split in splits:
            if "cumulative_time" in split:
                split["time_seconds"] = interval_to_seconds(split["cumulative_time"])
        
        # Sort by time_seconds (fastest first)
        splits.sort(key=lambda x: x.get("time_seconds", float("inf")))
        
        return splits
    
    def get_workout_results(
        self,
        swimmer_id: str,
        user_id: Optional[str] = None,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Get workout results for a swimmer.
        
        Args:
            swimmer_id: Swimmer identifier (UUID)
            user_id: User ID for authorization
            limit: Maximum number of results
            
        Returns:
            List of workout result records
        """
        self._verify_swimmer_access(swimmer_id, user_id)
        
        return self.workout_repo.find_by_swimmer_id(swimmer_id, limit=limit)
    
    def get_race_splits(
        self,
        result_id: str,
        swimmer_id: str,
        user_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get race splits for a specific result.
        
        Args:
            result_id: Workout result identifier (UUID)
            swimmer_id: Swimmer identifier for authorization (UUID)
            user_id: User ID for authorization
            
        Returns:
            List of race split records
        """
        self._verify_swimmer_access(swimmer_id, user_id)
        
        return self.split_repo.find_by_result_id(result_id)
    
    def add_workout_results(
        self,
        results: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Bulk add workout results (used by sync process).
        
        Args:
            results: List of workout result records
            
        Returns:
            List of created records
        """
        return self.workout_repo.bulk_insert(results)
    
    def add_race_splits(
        self,
        splits: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Bulk add race splits (used by sync process).
        
        Args:
            splits: List of race split records
            
        Returns:
            List of created records
        """
        return self.split_repo.bulk_insert(splits)
    
    def get_overall_rankings(
        self,
        squad_id: str,
        result_units: str,
        user_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get overall pentathlon rankings for a squad.
        
        Ranks swimmers by combined time across 5 events:
        50 Fly, 100 Back, 100 Breast, 200 Free, 200 IM
        
        Args:
            squad_id: Squad identifier (UUID)
            result_units: Course type (SCM or LCM)
            user_id: User ID for authorization
            
        Returns:
            List of rankings with swimmer info and event times
        """
        from app.infrastructure.database import get_supabase_client
        
        # Define the pentathlon events
        PENTATHLON_EVENTS = [
            {'distance': 50, 'stroke': 'fly'},
            {'distance': 100, 'stroke': 'back'},
            {'distance': 100, 'stroke': 'breast'},
            {'distance': 200, 'stroke': 'free'},
            {'distance': 200, 'stroke': 'im'}
        ]
        
        supabase = get_supabase_client()
        
        # Get all swimmers in the squad
        swimmers_response = supabase.table('swimmers').select(
            'id, first_name, last_name, date_of_birth, sex'
        ).eq('squad_id', squad_id).execute()
        
        if not swimmers_response.data:
            return []
        
        swimmers = {s['id']: s for s in swimmers_response.data}
        swimmer_ids = list(swimmers.keys())
        
        # Get best times for all pentathlon events
        results_response = supabase.table('workout_result').select(
            'swimmer_id, distance, stroke, time_result'
        ).in_('swimmer_id', swimmer_ids).eq(
            'activity', 'swim'
        ).eq('equipment', 'none').eq(
            'result_units', result_units
        ).not_.is_('time_result', 'null').execute()
        
        if not results_response.data:
            return []
        
        # Group results by swimmer and event
        swimmer_events: Dict[str, Dict[str, float]] = {}
        
        for result in results_response.data:
            swimmer_id = result['swimmer_id']
            distance = result['distance']
            stroke = result['stroke']
            
            # Check if this is a pentathlon event
            event_key = f"{distance}_{stroke}"
            is_pentathlon = any(
                e['distance'] == distance and e['stroke'] == stroke 
                for e in PENTATHLON_EVENTS
            )
            
            if not is_pentathlon:
                continue
            
            if swimmer_id not in swimmer_events:
                swimmer_events[swimmer_id] = {}
            
            # Parse time and keep best (lowest)
            time_seconds = interval_to_seconds(result['time_result'])
            if time_seconds and time_seconds > 0:
                if event_key not in swimmer_events[swimmer_id]:
                    swimmer_events[swimmer_id][event_key] = time_seconds
                else:
                    swimmer_events[swimmer_id][event_key] = min(
                        swimmer_events[swimmer_id][event_key],
                        time_seconds
                    )
        
        # Build rankings
        rankings = []
        for swimmer_id, events in swimmer_events.items():
            # Check if swimmer has all 5 events
            required_events = {f"{e['distance']}_{e['stroke']}" for e in PENTATHLON_EVENTS}
            has_all_events = required_events.issubset(events.keys())
            
            swimmer = swimmers[swimmer_id]
            swimmer_name = f"{swimmer.get('first_name', '')} {swimmer.get('last_name', '')}".strip()
            
            # Calculate total time
            total_time = sum(events.values()) if has_all_events else None
            
            rankings.append({
                'swimmer_id': swimmer_id,
                'swimmer_name': swimmer_name,
                'date_of_birth': swimmer.get('date_of_birth'),
                'sex': swimmer.get('sex'),
                'fifty_fly': events.get('50_fly'),
                'hundred_back': events.get('100_back'),
                'hundred_breast': events.get('100_breast'),
                'two_hundred_free': events.get('200_free'),
                'two_hundred_im': events.get('200_im'),
                'total_time': total_time,
                'events_completed': len(events),
                'has_all_events': has_all_events
            })
        
        # Sort by total time (fastest first), then by events completed
        rankings.sort(key=lambda x: (
            not x['has_all_events'],  # Complete pentathlons first
            x['total_time'] if x['total_time'] else float('inf')
        ))
        
        return rankings
    
    @staticmethod
    def calculate_consistency_score(improvements: List[float]) -> float:
        """Calculate consistency score from improvement percentages across events.
        
        Measures how consistently a swimmer improves across all events.
        Higher values indicate more consistent improvement (or regression).
        
        Args:
            improvements: List of improvement percentages (negative = faster/better)
            
        Returns:
            Consistency score from 0-100 (100 = perfectly consistent)
        """
        if len(improvements) < 2:
            return 100.0  # Perfect consistency with 0-1 events
        
        # Calculate standard deviation of absolute improvement values
        abs_improvements = [abs(x) for x in improvements]
        mean_abs = statistics.mean(abs_improvements)
        
        if mean_abs == 0:
            return 100.0  # No variation = perfect consistency
        
        std_dev = statistics.stdev(abs_improvements) if len(abs_improvements) > 1 else 0
        
        # Consistency = 1 - (std_dev / mean) clamped to 0-1, scaled to 0-100
        consistency = max(0, 1 - (std_dev / mean_abs))
        return round(consistency * 100, 2)
    
    @staticmethod
    def calculate_weighted_improvement(timeline: List[Dict], first_time: float) -> float:
        """Calculate weighted improvement prioritizing recent attempts.
        
        Uses exponential weighting where recent attempts have more influence.
        Shows change from baseline to weighted recent average.
        
        Args:
            timeline: List of dicts with 'time' key in chronological order
            first_time: First recorded time (baseline)
            
        Returns:
            Weighted improvement percentage (negative = faster, positive = slower)
        """
        if len(timeline) < 1 or first_time == 0:
            return 0.0
        
        if len(timeline) == 1:
            # Single attempt: compare to baseline
            improvement = ((timeline[0]['time'] - first_time) / first_time) * 100
            return round(improvement, 2)
        
        # Apply exponential weights emphasizing recent attempts (last 30% of timeline)
        # But weight all attempts to avoid skewing toward old data
        n = len(timeline)
        weighted_sum = 0.0
        weight_sum = 0.0
        
        # Use quadratic weighting (smoother than exponential, less extreme)
        # Weight increases from 1 to ~n, giving recent attempts 5-10x influence
        for i, entry in enumerate(timeline):
            # Quadratic: (i+1)^2 / (n^2) scaled so last item is about n times first
            weight = ((i + 1) / n) ** 2 * n
            weighted_sum += entry['time'] * weight
            weight_sum += weight
        
        weighted_time = weighted_sum / weight_sum if weight_sum > 0 else timeline[-1]['time']
        
        # Calculate improvement from baseline (negative = faster/better)
        improvement = ((weighted_time - first_time) / first_time) * 100
        return round(improvement, 2)
    
    @staticmethod
    def calculate_trend_velocity(timeline: List[Dict]) -> float:
        """Calculate trend velocity using linear regression.
        
        Returns slope of improvement over time (negative = improving, positive = regressing).
        
        Args:
            timeline: List of dicts with 'date' (YYYY-MM-DD string) and 'time' keys
            
        Returns:
            Slope value (change in time per day)
        """
        if len(timeline) < 2:
            return 0.0
        
        try:
            # Convert dates to days since first attempt
            first_date_str = timeline[0]['date']
            first_date = datetime.strptime(first_date_str, "%Y-%m-%d")
            
            # Calculate x (days since start) and y (time in seconds)
            x_vals = []
            y_vals = []
            
            for entry in timeline:
                try:
                    entry_date = datetime.strptime(entry['date'], "%Y-%m-%d")
                    days_elapsed = (entry_date - first_date).days
                    x_vals.append(days_elapsed)
                    y_vals.append(entry['time'])
                except (ValueError, TypeError):
                    continue
            
            if len(x_vals) < 2:
                return 0.0
            
            # Linear regression: y = a + bx (we want b = slope)
            n = len(x_vals)
            x_mean = statistics.mean(x_vals)
            y_mean = statistics.mean(y_vals)
            
            numerator = sum((x_vals[i] - x_mean) * (y_vals[i] - y_mean) for i in range(n))
            denominator = sum((x_vals[i] - x_mean) ** 2 for i in range(n))
            
            if denominator == 0:
                return 0.0
            
            slope = numerator / denominator
            return round(slope, 4)
        
        except (ValueError, TypeError, ZeroDivisionError):
            return 0.0
    
    @staticmethod
    def calculate_per_event_consistency(attempts: List[float]) -> float:
        """Calculate consistency score for a single event's attempts.
        
        Measures variance of times within an event (stable = consistent times).
        
        Args:
            attempts: List of time values in seconds
            
        Returns:
            Consistency score from 0-100 (100 = perfectly consistent/stable times)
        """
        if len(attempts) < 2:
            return 100.0
        
        mean_time = statistics.mean(attempts)
        if mean_time == 0:
            return 100.0
        
        std_dev = statistics.stdev(attempts)
        coefficient_of_variation = std_dev / mean_time  # Lower = more consistent
        
        # Convert to 0-100 scale (values typically 0-0.2 for swimming)
        consistency = max(0, 100 * (1 - min(coefficient_of_variation, 1.0)))
        return round(consistency, 2)
    
    def _add_course_conversions(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Add converted times for events missing in LCM or SCM.
        
        Groups results by event (distance, stroke, activity, equipment) and checks
        if both LCM and SCM times exist. If only one exists, converts it to the other
        course and adds a new result with is_converted=True.
        
        Args:
            results: List of best time records from database
            
        Returns:
            Original results plus converted times for missing courses
        """
        try:
            # Group by event (distance, stroke, activity, equipment)
            # Store both result and parsed time to avoid re-parsing
            events_map: Dict[str, Dict[str, Any]] = {}
            
            for result in results:
                distance = result.get('distance')
                stroke = result.get('stroke')
                activity = result.get('activity')
                equipment = result.get('equipment')
                result_units = result.get('result_units', 'SCM')
                
                # Skip if missing required fields
                if not all([distance, stroke, activity, equipment]):
                    continue
                
                # Create event key without result_units
                event_key = f"{distance}-{stroke}-{activity}-{equipment}"
                
                if event_key not in events_map:
                    events_map[event_key] = {
                        'distance': distance,
                        'stroke': stroke,
                        'activity': activity,
                        'equipment': equipment,
                        'SCM': None,
                        'SCM_seconds': None,
                        'LCM': None,
                        'LCM_seconds': None
                    }
                
                # Parse time to seconds for comparison (only once per result)
                try:
                    time_seconds = interval_to_seconds(result.get('time_result'))
                    if not time_seconds or time_seconds <= 0:
                        continue
                    
                    # Store the BEST (fastest) result for this course type
                    current_best_seconds = events_map[event_key][f'{result_units}_seconds']
                    if current_best_seconds is None or time_seconds < current_best_seconds:
                        events_map[event_key][result_units] = result
                        events_map[event_key][f'{result_units}_seconds'] = time_seconds
                except Exception:
                    continue
            
            # Build output list with conversions
            output_results = list(results)  # Start with all original results
            
            for event_key, event_data in events_map.items():
                scm_result = event_data['SCM']
                scm_seconds = event_data['SCM_seconds']
                lcm_result = event_data['LCM']
                lcm_seconds = event_data['LCM_seconds']
                distance = event_data['distance']
                
                # Convert SCM to LCM if LCM is missing
                if scm_result and not lcm_result and distance and scm_seconds:
                    try:
                        converted_seconds = PoolConverter.convert(
                            time_seconds=scm_seconds,
                            distance=distance,
                            from_pool='SCM',
                            to_pool='LCM'
                        )
                        
                        if converted_seconds:
                            # Create converted result
                            converted_result = {
                                **scm_result,
                                'result_units': 'LCM',
                                'time_result': self._seconds_to_interval_string(converted_seconds),
                                'is_converted': True,
                                'converted_from': 'SCM',
                                'original_time_seconds': scm_seconds,
                                'converted_time_seconds': converted_seconds
                            }
                            output_results.append(converted_result)
                    except Exception as e:
                        # Log but don't fail - just skip this conversion
                        print(f"Warning: Failed to convert SCM to LCM for event {event_key}: {e}")
                        continue
                
                # Convert LCM to SCM if SCM is missing
                elif lcm_result and not scm_result and distance and lcm_seconds:
                    try:
                        converted_seconds = PoolConverter.convert(
                            time_seconds=lcm_seconds,
                            distance=distance,
                            from_pool='LCM',
                            to_pool='SCM'
                        )
                        
                        if converted_seconds:
                            # Create converted result
                            converted_result = {
                                **lcm_result,
                                'result_units': 'SCM',
                                'time_result': self._seconds_to_interval_string(converted_seconds),
                                'is_converted': True,
                                'converted_from': 'LCM',
                                'original_time_seconds': lcm_seconds,
                                'converted_time_seconds': converted_seconds
                            }
                            output_results.append(converted_result)
                    except Exception as e:
                        # Log but don't fail - just skip this conversion
                        print(f"Warning: Failed to convert LCM to SCM for event {event_key}: {e}")
                        continue
            
            return output_results
            
        except Exception as e:
            # If conversion fails entirely, just return original results
            print(f"Warning: Course conversion failed, returning original results: {e}")
            return results
    
    @staticmethod
    def _seconds_to_interval_string(seconds: float) -> str:
        """Convert seconds to PostgreSQL interval string format.
        
        Args:
            seconds: Time in seconds
            
        Returns:
            Interval string like '00:01:23.45'
        """
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = seconds % 60
        
        return f"{hours:02d}:{minutes:02d}:{secs:06.3f}"
