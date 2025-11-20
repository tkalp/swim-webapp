"""Performance service for swim times, best splits, and FINA points."""
from typing import Dict, List, Optional, Any
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
