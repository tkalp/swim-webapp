"""
Splits fetching service - single responsibility: fetch race splits only
"""

import logging
import asyncio
from typing import List, Dict, Optional, Set
from worker.models import RaceSplit
from worker.scrapers.swimrankings_scraper import SwimRankingsScraper
from worker.config import WorkerConfig

logger = logging.getLogger('splits_fetcher')


class SplitsFetcher:
    """
    Fetches race splits from SwimRankings
    Single responsibility: split fetching with concurrency control
    """
    
    def __init__(self, scraper: SwimRankingsScraper):
        """
        Initialize splits fetcher
        
        Args:
            scraper: SwimRankings scraper instance
        """
        self.scraper = scraper
        # Use SPLITS_MAX_WORKERS from config for concurrent split fetches
        max_workers = WorkerConfig.SPLITS_MAX_WORKERS
        self.semaphore = asyncio.Semaphore(max_workers)
    
    async def fetch_splits_for_attempts(
        self,
        attempt_ids: List[str],
        athlete_id: str,
        event_name: str,
        available_attempt_ids: Optional[Set[str]] = None
    ) -> Dict[str, List[RaceSplit]]:
        """
        Fetch splits for multiple attempts
        Gracefully handles cases where splits aren't available from SwimRankings
        
        Args:
            attempt_ids: List of attempt IDs to fetch splits for
            athlete_id: SwimRankings athlete ID
            event_name: Event name for logging
            available_attempt_ids: Set of attempt IDs where splits are actually available
                                   If provided, skips fetching for unavailable ones
            
        Returns:
            Dictionary mapping attempt_id to List[RaceSplit]
        """
        if not attempt_ids:
            return {}
        
        # Check global SKIP_SPLITS flag
        if WorkerConfig.SKIP_SPLITS:
            logger.info(f"SKIP_SPLITS enabled: skipping split fetch for {event_name} ({len(attempt_ids)} attempts)")
            return {aid: [] for aid in attempt_ids}
        
        # Filter to only attempt IDs where splits are available
        fetchable_ids = attempt_ids
        if available_attempt_ids is not None:
            fetchable_ids = [aid for aid in attempt_ids if aid in available_attempt_ids]
            if len(fetchable_ids) < len(attempt_ids):
                logger.debug(
                    f"Splits for {event_name}: {len(fetchable_ids)}/{len(attempt_ids)} "
                    f"attempts have splits available"
                )
        
        if not fetchable_ids:
            logger.debug(f"Skipping split fetch for {event_name}: no splits available")
            return {aid: [] for aid in attempt_ids}
        
        logger.debug(f"Fetching splits for {len(fetchable_ids)} attempts in {event_name}")
        
        tasks = [
            self._fetch_splits_with_semaphore(athlete_id, attempt_id)
            for attempt_id in fetchable_ids
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        splits_map = {}
        
        # Add results for fetchable IDs
        for attempt_id, result in zip(fetchable_ids, results):
            if isinstance(result, Exception):
                logger.debug(f"  {attempt_id}: Splits fetch failed - {result}")
                splits_map[attempt_id] = []
            else:
                splits_map[attempt_id] = result or []
        
        # Add empty splits for non-fetchable IDs
        for attempt_id in attempt_ids:
            if attempt_id not in splits_map:
                splits_map[attempt_id] = []
        
        return splits_map
    
    async def _fetch_splits_with_semaphore(
        self,
        athlete_id: str,
        attempt_id: str
    ) -> List[RaceSplit]:
        """
        Fetch splits with semaphore limiting
        Note: This is a placeholder for future use. Currently, splits are fetched
        during fetch_event_attempts in the scraper itself.
        
        Args:
            athlete_id: SwimRankings athlete ID
            attempt_id: Attempt ID
            
        Returns:
            List of RaceSplit objects
        """
        async with self.semaphore:
            try:
                # This would call the scraper's _fetch_splits method
                # For now, just return empty (splits are fetched in fetch_event_attempts)
                logger.debug(f"  {attempt_id}: Fetching splits (placeholder - use fetch_event_attempts instead)")
                return []
            except Exception as e:
                logger.debug(f"  {attempt_id}: Error fetching splits - {e}")
                return []
    
    async def fetch_splits_batch(
        self,
        attempt_ids: List[str],
        athlete_id: str,
        batch_size: Optional[int] = None
    ) -> Dict[str, List[RaceSplit]]:
        """
        Fetch splits in micro-batches to limit API load
        
        Args:
            attempt_ids: List of attempt IDs
            athlete_id: SwimRankings athlete ID
            batch_size: Batch size (defaults to SPLIT_BATCH_SIZE)
            
        Returns:
            Dictionary mapping attempt_id to List[RaceSplit]
        """
        if batch_size is None:
            batch_size = WorkerConfig.SPLIT_BATCH_SIZE
        
        logger.debug(f"Fetching {len(attempt_ids)} splits in batches of {batch_size}")
        
        all_splits = {}
        
        # Convert batch_size to int explicitly to avoid type errors
        batch_size_int = int(batch_size) if batch_size else WorkerConfig.SPLIT_BATCH_SIZE
        
        for i in range(0, len(attempt_ids), batch_size_int):
            batch = attempt_ids[i:i + batch_size_int]
            batch_num = (i // batch_size_int) + 1
            logger.debug(f"  Batch {batch_num}: fetching {len(batch)} attempts...")
            
            batch_splits = await self.fetch_splits_for_attempts(
                batch,
                athlete_id,
                f"batch_{batch_num}"
            )
            
            all_splits.update(batch_splits)
        
        return all_splits
