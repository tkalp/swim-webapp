"""
Result persister service - single responsibility: database writes only
"""

import logging
from typing import List, Dict, Optional
from worker.models import WorkoutResult, RaceSplit
from worker.services.database_service import DatabaseService

logger = logging.getLogger('result_persister')


class ResultPersister:
    """
    Persists results to database
    Single responsibility: database writes, no filtering or logic
    """
    
    def __init__(self, db_service: DatabaseService):
        """
        Initialize persister
        
        Args:
            db_service: Database service
        """
        self.db = db_service
    
    async def insert_results_with_splits(
        self,
        results: List[WorkoutResult],
        splits_map: Optional[Dict[str, List[RaceSplit]]] = None
    ) -> List[Dict]:
        """
        Insert results and their splits
        Gracefully handles results without splits (common in SwimRankings data)
        
        Args:
            results: List of WorkoutResult to insert
            splits_map: Optional dict mapping swimrankings_result_id to splits
                       Can be empty or missing keys for results without splits
            
        Returns:
            List of inserted records with IDs
        """
        if not results:
            logger.debug("No results to insert")
            return []
        
        logger.info(f"Inserting {len(results)} results with splits...")
        
        try:
            # Prepare splits map with graceful handling
            safe_splits_map = splits_map or {}
            
            # Count results with/without splits
            results_with_splits = sum(
                1 for r in results 
                if r.swimrankings_result_id and safe_splits_map.get(r.swimrankings_result_id)
            )
            results_without_splits = len(results) - results_with_splits
            
            if results_without_splits > 0:
                logger.debug(
                    f"  {results_with_splits} results with splits, "
                    f"{results_without_splits} without splits"
                )
            
            inserted = self.db.bulk_insert_workout_results_with_splits(
                results,
                safe_splits_map
            )
            
            logger.info(f"  Inserted {len(inserted)} records")
            return inserted
            
        except Exception as e:
            logger.error(f"Error inserting results: {e}")
            raise
    
    async def insert_results_only(
        self,
        results: List[WorkoutResult]
    ) -> List[Dict]:
        """
        Insert results without splits
        
        Args:
            results: List of WorkoutResult to insert
            
        Returns:
            List of inserted records with IDs
        """
        if not results:
            logger.debug("No results to insert")
            return []
        
        logger.info(f"Inserting {len(results)} results (no splits)...")
        
        try:
            inserted = self.db.bulk_insert_workout_results(results)
            logger.info(f"  Inserted {len(inserted)} records")
            return inserted
            
        except Exception as e:
            logger.error(f"Error inserting results: {e}")
            raise
    
    async def insert_splits_only(
        self,
        splits_map: Dict[str, List[RaceSplit]]
    ) -> None:
        """
        Insert splits for existing results
        
        Args:
            splits_map: Dictionary mapping workout_result_id to splits
        """
        if not splits_map:
            logger.debug("No splits to insert")
            return
        
        total_splits = sum(len(splits) for splits in splits_map.values())
        logger.info(f"Inserting {total_splits} splits for {len(splits_map)} results...")
        
        try:
            self.db.bulk_insert_splits_for_multiple_results(splits_map)
            logger.info(f"  Inserted {total_splits} splits")
            
        except Exception as e:
            logger.error(f"Error inserting splits: {e}")
            raise
    
    async def update_stale_timestamps(
        self,
        workout_result_ids: List[str]
    ) -> None:
        """
        Update timestamp for stale results (mark as fresh)
        
        Args:
            workout_result_ids: List of result IDs to update
        """
        if not workout_result_ids:
            logger.debug("No timestamps to update")
            return
        
        logger.debug(f"Updating timestamps for {len(workout_result_ids)} results...")
        
        try:
            self.db.update_stale_results_timestamp(workout_result_ids)
            logger.debug(f"  Updated {len(workout_result_ids)} timestamps")
            
        except Exception as e:
            logger.warning(f"Error updating timestamps: {e}")
            # Non-critical, don't raise
    
    async def mark_no_splits(
        self,
        workout_result_ids: List[str]
    ) -> None:
        """
        Mark results as having no splits available
        
        Args:
            workout_result_ids: List of result IDs
        """
        if not workout_result_ids:
            logger.debug("No results to mark")
            return
        
        logger.debug(f"Marking {len(workout_result_ids)} results as no-splits...")
        
        try:
            self.db.mark_results_without_splits(workout_result_ids)
            logger.debug(f"  Marked {len(workout_result_ids)} results")
            
        except Exception as e:
            logger.warning(f"Error marking results: {e}")
            # Non-critical
    
    async def deduplicate(self, swimmer_id: str) -> int:
        """
        Remove duplicate results for swimmer
        
        Args:
            swimmer_id: Swimmer ID
            
        Returns:
            Number of duplicates removed
        """
        logger.info(f"Deduplicating results for swimmer {swimmer_id}...")
        
        try:
            deleted_count = self.db.deduplicate_swimmer_results(swimmer_id)
            
            if deleted_count > 0:
                logger.info(f"  Removed {deleted_count} duplicate results")
            else:
                logger.debug(f"  No duplicates found")
            
            return deleted_count
            
        except Exception as e:
            logger.warning(f"Error deduplicating results: {e}")
            # Non-critical - duplicates will be cleaned up on next sync
            return 0
