"""Performance service for swim times, best splits, and FINA points."""
from typing import Dict, List, Optional, Any
import statistics
from datetime import datetime
from app.repositories.workout import WorkoutResultRepository, RaceSplitRepository
from app.services.authorization_service import AuthorizationService
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
        """Get best times for a swimmer with filters.
        
        Args:
            swimmer_id: Swimmer identifier (UUID)
            user_id: User ID for authorization
            interval: Time interval (week, month, 3months, 6months, year, all)
            stroke: Swimming stroke filter
            distance: Distance in meters
            
        Returns:
            List of best time records with FINA points
        """
        self._verify_swimmer_access(swimmer_id, user_id)
        
        results = self.workout_repo.find_best_times(
            swimmer_id=swimmer_id,
            interval=interval,
            stroke=stroke,
            distance=distance
        )
        
        return results
    
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
