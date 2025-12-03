"""
SwimRankings scraper implementation
"""

import asyncio
import logging
from typing import List, Dict, Optional
from bs4 import BeautifulSoup

from worker.scrapers.base_scraper import BaseScraper
from worker.parsers.swimrankings_parser import SwimRankingsParser
from worker.models import ResultWithSplits, AttemptData, RaceSplit
from worker.config import WorkerConfig
from worker.fetchers import FetcherFactory, BaseFetcher
from worker.utils import DistanceHelper


logger = logging.getLogger('swimrankings_scraper')


class SwimRankingsScraper(BaseScraper):
    """Service for scraping SwimRankings.net"""
    
    def __init__(self, max_workers: Optional[int] = None, fetch_mode: Optional[str] = None, global_splits_semaphore: Optional[asyncio.Semaphore] = None):
        """
        Initialize SwimRankings scraper
        
        Args:
            max_workers: Maximum parallel workers for split fetching
            fetch_mode: Fetch mode ('curl', 'httpx', 'playwright'). Defaults to config.
            global_splits_semaphore: Optional global semaphore for parallel splits across events (optimization #1)
        """
        super().__init__(max_workers)
        self.base_url = WorkerConfig.SWIMRANKINGS_BASE_URL
        self.parser = SwimRankingsParser()
        self.fetcher: BaseFetcher = FetcherFactory.create(mode=fetch_mode)
        self.global_splits_semaphore = global_splits_semaphore
        logger.info(f"SwimRankingsScraper initialized with {self.fetcher.get_name()} fetcher" + 
                   (" (global splits semaphore enabled)" if global_splits_semaphore else ""))
    
    async def fetch_event_attempts(
        self,
        athlete_id: str,
        style_id: str,
        limit: Optional[int] = None,
        skip_no_splits: bool = False,
        external_link_id: Optional[str] = None,
        check_cancellation_fn: Optional[callable] = None
    ) -> List[ResultWithSplits]:
        """
        Fetch all attempts for a specific event
        
        Args:
            athlete_id: SwimRankings athlete ID
            style_id: Event style ID
            limit: Maximum number of results to fetch (None = all)
            skip_no_splits: If True, only include results that have splits
            external_link_id: Optional external link ID to check for cancellation
            check_cancellation_fn: Optional function to check if operation was cancelled
            
        Returns:
            List of ResultWithSplits objects
        """
        logger.info(f"Starting event attempts fetch: athlete_id={athlete_id}, style_id={style_id}, limit={limit}, skip_no_splits={skip_no_splits}")
        
        # Check for cancellation before expensive operations
        if check_cancellation_fn and await check_cancellation_fn():
            logger.info("Sync cancelled before fetching event attempts")
            raise asyncio.CancelledError("Sync cancelled by user")
        
        url = f"{self.base_url}/index.php?page=athleteDetail&athleteId={athlete_id}&styleId={style_id}"
        
        try:
            # Fetch main page using configured fetcher
            logger.info(f"Fetching athlete detail page: {url}")
            html = await self.fetcher.fetch(url)
            logger.info(f"Successfully fetched page, HTML size: {len(html)} bytes")
            
            soup = BeautifulSoup(html, 'html.parser')
            
            # Parse attempts
            logger.info("Parsing event attempts from page...")
            attempts = self.parser.parse_event_attempts(soup)
            logger.info(f"Found {len(attempts)} total attempt(s) on page")
            
            if limit:
                original_count = len(attempts)
                attempts = attempts[:limit]
                logger.info(f"Limiting results from {original_count} to {len(attempts)} attempt(s)")
            
            # Check if we should fetch splits for this event distance
            style_id_int = int(style_id)
            should_fetch_splits = DistanceHelper.should_fetch_splits(style_id_int)
            
            if not should_fetch_splits:
                logger.info(f"Skipping splits fetch for all {len(attempts)} attempt(s) (event distance <= 50m)")
                # Return results without splits, marked as unavailable
                all_results = [
                    ResultWithSplits(
                        attempt=attempt,
                        reaction_time=None,
                        splits=[],
                        has_splits_available=False
                    )
                    for attempt in attempts
                ]
            elif limit:
                logger.info(f"Skipping splits fetch for {len(attempts)} attempt(s) (limit={limit}, optimization)")
                # Return results without splits when limiting for speed
                all_results = [
                    ResultWithSplits(
                        attempt=attempt,
                        reaction_time=None,
                        splits=[],
                        has_splits_available=None  # Unknown since we didn't check
                    )
                    for attempt in attempts
                ]
            elif skip_no_splits:
                logger.info(f"Skipping splits fetch for {len(attempts)} attempt(s) (skip_no_splits=True)")
                # Return results without splits for maximum speed
                all_results = [
                    ResultWithSplits(
                        attempt=attempt,
                        reaction_time=None,
                        splits=[],
                        has_splits_available=None  # Unknown since we didn't check
                    )
                    for attempt in attempts
                ]
            else:
                # Check global SKIP_SPLITS flag
                from worker.config import WorkerConfig
                
                if WorkerConfig.SKIP_SPLITS:
                    logger.info(f"SKIP_SPLITS enabled: skipping splits fetch for {len(attempts)} attempt(s)")
                    all_results = [
                        ResultWithSplits(
                            attempt=attempt,
                            reaction_time=None,
                            splits=[],
                            has_splits_available=False
                        )
                        for attempt in attempts
                    ]
                else:
                    # Fetch splits for all attempts in parallel with semaphore for rate limiting
                    logger.info(f"Fetching splits for {len(attempts)} attempt(s) using {self.MAX_WORKERS} parallel workers...")
                    # Optimization #1: Use global semaphore if provided (parallel across events), otherwise local (per-event)
                    semaphore = self.global_splits_semaphore if self.global_splits_semaphore else asyncio.Semaphore(self.MAX_WORKERS)
                    
                    async def fetch_splits_with_semaphore(idx: int, attempt: AttemptData) -> ResultWithSplits:
                        """Fetch splits for a single attempt with rate limiting"""
                        async with semaphore:
                            # Check for cancellation before fetching each split
                            if check_cancellation_fn and await check_cancellation_fn():
                                logger.info(f"[{idx}/{len(attempts)}] Sync cancelled, stopping splits fetch")
                                raise asyncio.CancelledError("Sync cancelled by user")
                            
                            logger.info(f"[{idx}/{len(attempts)}] Processing attempt: {attempt.time} on {attempt.date} at {attempt.location}")
                            
                            result = ResultWithSplits(
                                attempt=attempt,
                                reaction_time=None,
                                splits=[],
                                has_splits_available=None
                            )
                            
                            if attempt.result_id:
                                # Note: Rate limiting removed for concurrent split fetching
                                # Concurrency controlled by semaphore in sync_service
                                
                                logger.info(f"[{idx}/{len(attempts)}] Fetching splits for result_id={attempt.result_id}")
                                splits_data = await self._fetch_splits(attempt.result_id)
                                result.reaction_time = splits_data.get('reaction_time')
                                result.splits = splits_data.get('splits', [])
                                
                                # Mark availability based on whether splits were found
                                result.has_splits_available = len(result.splits) > 0
                                
                                if result.splits:
                                    logger.info(f"[{idx}/{len(attempts)}] Found {len(result.splits)} split(s)" + 
                                              (f" (reaction time: {result.reaction_time}s)" if result.reaction_time else ""))
                                else:
                                    logger.debug(f"[{idx}/{len(attempts)}] No splits found for this result")
                            else:
                                logger.debug(f"[{idx}/{len(attempts)}] No result_id available, skipping splits fetch")
                            
                            return result
                    
                    # Fetch all splits in parallel
                    tasks = [fetch_splits_with_semaphore(idx + 1, attempt) for idx, attempt in enumerate(attempts)]
                    all_results = await asyncio.gather(*tasks)
            
            # Count results without result_id for logging
            skipped_no_result_id = sum(1 for r in all_results if not r.attempt.result_id)
            
            logger.info(f"Event attempts fetch complete: {len(all_results)} result(s) returned" +
                       (f", {skipped_no_result_id} without result_id" if skipped_no_result_id > 0 else ""))
            return all_results
            
        except Exception as e:
            logger.error(f"Failed to fetch event attempts: {str(e)}", exc_info=True)
            raise
    
    async def _fetch_splits(self, result_id: str, retry_count: int = 0) -> Dict:
        """
        Fetch race splits for a single result using configured fetcher.
        
        Args:
            result_id: SwimRankings result ID
            retry_count: Current retry attempt
            
        Returns:
            Dictionary with 'reaction_time' and 'splits' keys
        """
        url = f"{self.base_url}/index.php?page=resultDetail&id={result_id}"
        
        try:
            logger.debug(f"Fetching splits page for result_id={result_id}")
            html = await self.fetcher.fetch(url)
            
            soup = BeautifulSoup(html, 'html.parser')
            splits_data = self.parser.parse_result_splits(soup)
            
            split_count = len(splits_data.get('splits', []))
            reaction = splits_data.get('reaction_time')
            logger.debug(f"Parsed splits for result_id={result_id}: {split_count} split(s), reaction_time={reaction}")
            
            return splits_data
            
        except Exception as e:
            logger.warning(f"Error fetching splits (attempt {retry_count + 1}/{self.MAX_RETRIES}): {e}")
            
            if retry_count < self.MAX_RETRIES:
                delay = self.calculate_retry_delay(retry_count)
                logger.info(f"Retrying in {delay:.2f}s...")
                await asyncio.sleep(delay)
                return await self._fetch_splits(result_id, retry_count + 1)
            else:
                logger.error(f"Failed to fetch splits for result {result_id} after {self.MAX_RETRIES} attempts")
                return {'reaction_time': None, 'splits': []}
