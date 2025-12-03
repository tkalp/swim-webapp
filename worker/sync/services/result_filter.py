"""
Result filtering service - single responsibility: filtering logic only
"""

import logging
from typing import List, Set, Dict, Optional, Any
from worker.services.database_service import DatabaseService

logger = logging.getLogger('result_filter')


class ResultFilter:
    """
    Filters results based on various criteria
    Single responsibility: filtering logic, no side effects
    """
    
    def __init__(self, db_service: DatabaseService):
        """
        Initialize filter
        
        Args:
            db_service: Database service for existence checks
        """
        self.db = db_service
    
    def filter_by_stale(
        self,
        result_ids: List[str],
        stale_ids: Set[str]
    ) -> List[str]:
        """
        Filter out stale results
        
        Args:
            result_ids: List of result IDs
            stale_ids: Set of stale result IDs to exclude
            
        Returns:
            Filtered list (only non-stale IDs)
        """
        filtered = [rid for rid in result_ids if rid not in stale_ids]
        logger.debug(f"Filtered by stale: {len(result_ids)} → {len(filtered)}")
        return filtered
    
    def filter_by_existing(
        self,
        result_ids: List[str],
        existing_ids: Set[str]
    ) -> List[str]:
        """
        Filter out results that already exist in database
        
        Args:
            result_ids: List of result IDs
            existing_ids: Set of IDs already in database
            
        Returns:
            Filtered list (only new IDs)
        """
        filtered = [rid for rid in result_ids if rid not in existing_ids]
        logger.debug(f"Filtered by existing: {len(result_ids)} → {len(filtered)}")
        return filtered
    
    async def filter_by_existence_bulk(
        self,
        result_ids: List[str],
        swimmer_id: str
    ) -> List[str]:
        """
        Filter out results that already exist in database (bulk check)
        
        Args:
            result_ids: List of result IDs
            swimmer_id: Swimmer ID
            
        Returns:
            Filtered list (only new IDs)
        """
        if not result_ids:
            return []
        
        existing_map = self.db.check_existing_results(result_ids, swimmer_id)
        existing_ids = set(existing_map.keys())
        
        return self.filter_by_existing(result_ids, existing_ids)
    
    def filter_events_by_distance(
        self,
        events: Dict[str, Any],
        min_distance: int = 0,
        max_distance: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Filter events by distance range
        
        Args:
            events: Dictionary of event data
            min_distance: Minimum distance
            max_distance: Maximum distance (None = no limit)
            
        Returns:
            Filtered events
        """
        filtered = {}
        for event_key, event_data in events.items():
            distance = event_data.get('distance', 0)
            
            if distance < min_distance:
                continue
            
            if max_distance is not None and distance > max_distance:
                continue
            
            filtered[event_key] = event_data
        
        logger.debug(f"Filtered by distance ({min_distance}-{max_distance}): {len(events)} → {len(filtered)}")
        return filtered
