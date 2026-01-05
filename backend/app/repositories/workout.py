"""Workout result repository for managing swim performance data."""
from typing import Dict, List, Optional, Any, cast
from datetime import datetime, timedelta
from supabase import Client
from app.repositories.base import BaseRepository
from app.infrastructure.constants import Tables, TimeInterval
from app.domain.exceptions import DatabaseError


class WorkoutResultRepository(BaseRepository):
    """Repository for workout result operations."""
    
    def __init__(self, db: Optional[Client] = None):
        super().__init__(Tables.WORKOUT_RESULTS, db)
    
    def find_by_swimmer_id(
        self,
        swimmer_id: str,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Find workout results for a swimmer.
        
        Args:
            swimmer_id: Swimmer identifier (UUID)
            limit: Maximum number of results
            
        Returns:
            List of workout result records
        """
        return self.find_all(
            filters={"swimmer_id": swimmer_id},
            order_by="performed_on.desc",
            limit=limit
        )
    
    def find_best_times(
        self,
        swimmer_id: str,
        interval: Optional[str] = None,
        stroke: Optional[str] = None,
        distance: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Find best times for a swimmer with optional filters.
        
        Args:
            swimmer_id: Swimmer identifier (UUID)
            interval: Time interval filter (week, month, etc.)
            stroke: Swimming stroke filter
            distance: Distance filter in meters
            
        Returns:
            List of best time records
        """
        try:
            # Build query
            query = self.db.table(self.table_name).select("*").eq("swimmer_id", swimmer_id)
            
            # Apply time interval filter
            if interval:
                cutoff_date = self._get_interval_cutoff(interval)
                if cutoff_date:
                    query = query.gte("performed_on", cutoff_date.isoformat())
            
            # Apply stroke filter
            if stroke:
                query = query.eq("stroke", stroke)
            
            # Apply distance filter
            if distance:
                query = query.eq("distance", distance)
            
            # Only get results with actual times
            query = query.not_.is_("time_result", "null")
            
            # Order by performed_on descending
            query = query.order("performed_on", desc=True)
            
            response = query.execute()
            return cast(List[Dict[str, Any]], response.data or [])
        except Exception as e:
            raise DatabaseError(f"Failed to fetch best times for swimmer {swimmer_id}") from e
    
    def _get_interval_cutoff(self, interval: str) -> Optional[datetime]:
        """Get cutoff date for time interval filter.
        
        Args:
            interval: Time interval (week, month, 3months, 6months, year, all)
            
        Returns:
            Cutoff datetime or None for 'all'
        """
        now = datetime.now()
        
        if interval == "week":
            return now - timedelta(days=7)
        elif interval == "month":
            return now - timedelta(days=30)
        elif interval == "3months":
            return now - timedelta(days=90)
        elif interval == "6months":
            return now - timedelta(days=180)
        elif interval == "year":
            return now - timedelta(days=365)
        else:  # "all" or invalid
            return None
    
    def find_best_splits(
        self,
        swimmer_id: str,
        interval: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Find best splits for a swimmer.
        
        Args:
            swimmer_id: Swimmer identifier (UUID)
            interval: Time interval filter
            
        Returns:
            List of best split records
        """
        try:
            query = self.db.rpc(
                "get_best_splits",
                {
                    "p_swimmer_id": swimmer_id,
                    "p_interval": interval
                }
            )
            response = query.execute()
            return cast(List[Dict[str, Any]], response.data or [])
        except Exception as e:
            raise DatabaseError(f"Failed to fetch best splits for swimmer {swimmer_id}") from e
    
    def find_by_external_result_id(
        self,
        external_result_id: str
    ) -> Optional[Dict[str, Any]]:
        """Find workout result by external result ID.
        
        Args:
            external_result_id: External result identifier from SwimRankings
            
        Returns:
            Workout result record or None
        """
        results = self.find_all(
            filters={"external_result_id": external_result_id},
            limit=1
        )
        return results[0] if results else None
    
    def bulk_insert(
        self,
        results: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Insert multiple workout results efficiently.
        
        Args:
            results: List of workout result records to insert
            
        Returns:
            List of created records
            
        Raises:
            DatabaseError: If bulk insert fails
        """
        try:
            response = self.db.table(self.table_name).insert(results).execute()
            return cast(List[Dict[str, Any]], response.data or [])
        except Exception as e:
            raise DatabaseError(f"Failed to bulk insert {len(results)} workout results") from e


class RaceSplitRepository(BaseRepository):
    """Repository for race split operations."""
    
    def __init__(self, db: Optional[Client] = None):
        super().__init__(Tables.RACE_SPLITS, db)
    
    def find_by_result_id(
        self,
        result_id: str
    ) -> List[Dict[str, Any]]:
        """Find race splits for a workout result.
        
        Args:
            result_id: Workout result identifier (UUID)
            
        Returns:
            List of race split records ordered by distance
        """
        return self.find_all(
            filters={"result_id": result_id},
            order_by="distance"
        )
    
    def bulk_insert(
        self,
        splits: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Insert multiple race splits efficiently.
        
        Args:
            splits: List of race split records to insert
            
        Returns:
            List of created records
            
        Raises:
            DatabaseError: If bulk insert fails
        """
        try:
            response = self.db.table(self.table_name).insert(splits).execute()
            return cast(List[Dict[str, Any]], response.data or [])
        except Exception as e:
            raise DatabaseError(f"Failed to bulk insert {len(splits)} race splits") from e
