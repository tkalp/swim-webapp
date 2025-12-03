"""
Event page fetching service - single responsibility: fetch event pages from SwimRankings
"""

import logging
from typing import List, Optional
from worker.models import ResultWithSplits
from worker.scrapers.swimrankings_scraper import SwimRankingsScraper

logger = logging.getLogger('event_fetcher')


class EventPageFetcher:
    """
    Fetches event pages from SwimRankings
    Single responsibility: page fetch + attempt parsing only
    Does NOT decide about splits or filtering
    """
    
    def __init__(self, scraper: SwimRankingsScraper):
        """
        Initialize fetcher
        
        Args:
            scraper: SwimRankings scraper instance
        """
        self.scraper = scraper
    
    async def fetch_event_page(
        self,
        athlete_id: str,
        style_id: str,
        limit: Optional[int] = None,
        skip_no_splits: bool = False
    ) -> List[ResultWithSplits]:
        """
        Fetch a single event page and parse attempts
        
        Args:
            athlete_id: SwimRankings athlete ID
            style_id: Style/event ID
            limit: Limit number of results (None = all)
            skip_no_splits: Skip results without splits available
            
        Returns:
            List of ResultWithSplits objects
        """
        logger.debug(f"Fetching event page: athlete={athlete_id}, style_id={style_id}")
        
        try:
            results = await self.scraper.fetch_event_attempts(
                athlete_id=athlete_id,
                style_id=style_id,
                limit=limit,
                skip_no_splits=skip_no_splits
            )
            
            logger.debug(f"  Fetched {len(results) if results else 0} attempts")
            return results or []
            
        except Exception as e:
            logger.error(f"  Error fetching event page: {e}")
            raise
    
    async def fetch_event_batch(
        self,
        athlete_id: str,
        style_ids: List[str],
        limit: Optional[int] = None,
        skip_no_splits: bool = False
    ) -> dict:
        """
        Fetch multiple event pages in parallel
        
        Args:
            athlete_id: SwimRankings athlete ID
            style_ids: List of style IDs to fetch
            limit: Limit per event
            skip_no_splits: Skip results without splits
            
        Returns:
            Dictionary mapping style_id to List[ResultWithSplits]
        """
        import asyncio
        
        logger.debug(f"Fetching {len(style_ids)} event pages in parallel")
        
        tasks = [
            self.fetch_event_page(athlete_id, style_id, limit, skip_no_splits)
            for style_id in style_ids
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        result_map = {}
        for style_id, result in zip(style_ids, results):
            if isinstance(result, Exception):
                logger.error(f"  {style_id}: Fetch failed - {result}")
                result_map[style_id] = []
            else:
                result_map[style_id] = result or []
        
        return result_map
