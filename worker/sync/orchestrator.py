"""
Sync orchestrator - simplified diff-based synchronization
Scrapes all results, compares with DB, inserts missing ones
"""

import asyncio
import logging
from typing import Optional, List, Dict
from datetime import datetime
import time

from worker.models import (
    SyncResult,
    SyncStatusUpdate,
    WorkoutResult,
)
from worker.services.database_service import DatabaseService
from worker.scrapers.swimrankings_scraper import SwimRankingsScraper
from worker.sync.services.result_persister import ResultPersister
from worker.constants import get_all_events

logger = logging.getLogger('sync_orchestrator')


class SyncOrchestrator:
    """
    Simplified swimmer data synchronization using diff-based approach
    
    Flow:
    1. Check if swimmer has any results in DB
    2. If none: scrape all events with splits
    3. If some: scrape all events without splits
    4. Diff scraped vs DB results
    5. Insert only missing results
    6. Fetch splits for new results >50m if needed
    """
    
    def __init__(
        self,
        db_service: DatabaseService,
        scraper: SwimRankingsScraper
    ):
        """
        Initialize orchestrator with dependencies
        
        Args:
            db_service: Database service
            scraper: SwimRankings scraper
        """
        self.db = db_service
        self.scraper = scraper
        self.persister = ResultPersister(db_service)
    
    async def sync_swimmer(
        self,
        swimmer_id: str,
        external_link_id: str,
        external_id: str,
        limit_events: Optional[int] = None,
        force_update: bool = False
    ) -> SyncResult:
        """
        Synchronize SwimRankings data for a single swimmer using simplified diff approach
        
        Args:
            swimmer_id: Database swimmer ID
            external_link_id: swimmer_external_links table ID
            external_id: SwimRankings athlete ID
            limit_events: Limit number of events to sync (None = all)
            force_update: Ignored in simplified architecture (kept for compatibility)
            
        Returns:
            SyncResult with statistics
        """
        sync_start_time = time.time()
        
        logger.info(f"Starting sync for swimmer {swimmer_id} (athlete_id={external_id})")
        
        result = SyncResult(
            swimmer_id=swimmer_id,
            external_link_id=external_link_id,
            events_processed=0,
            results_imported=0,
            results_skipped=0,
            errors=0,
            success=False
        )
        
        try:
            # Get all events to sync
            all_events = get_all_events()
            events_to_sync = all_events[:limit_events] if limit_events else all_events
            total_events = len(events_to_sync)
            
            logger.info(f"Processing {total_events} events")
            
            # Update status to in_progress
            self.db.update_sync_status(
                external_link_id,
                SyncStatusUpdate(
                    sync_status='in_progress',
                    last_sync_started_at=datetime.utcnow().isoformat(),
                    sync_error=None,
                    sync_progress=0,
                    sync_total=total_events
                )
            )
            
            # Step 1: Check if swimmer has any results in DB
            has_any_results = self.db.swimmer_has_any_results(swimmer_id)
            fetch_splits = not has_any_results  # Fetch splits only for initial sync
            
            logger.info(
                f"Swimmer has existing results: {has_any_results}, "
                f"will {'fetch' if fetch_splits else 'skip'} splits during scrape"
            )
            
            # Step 2: Scrape all events in parallel
            logger.info("Scraping all events from SwimRankings...")
            all_scraped_results = await self._scrape_all_events(
                external_id,
                events_to_sync,
                fetch_splits=fetch_splits
            )
            
            # Set swimmer_id for all results
            for r in all_scraped_results:
                r.swimmer_id = swimmer_id
            
            logger.info(f"Scraped {len(all_scraped_results)} total results")
            
            # Step 3: Get existing result IDs from DB
            scraped_result_ids = [
                r.swimrankings_result_id 
                for r in all_scraped_results 
                if r.swimrankings_result_id
            ]
            
            existing_result_map = self.db.check_existing_results(
                scraped_result_ids,
                swimmer_id
            )
            existing_ids = set(existing_result_map.keys())
            
            logger.info(
                f"Found {len(existing_ids)} existing results in DB, "
                f"{len(scraped_result_ids) - len(existing_ids)} new results to insert"
            )
            
            # Step 4: Filter to only new results (diff)
            new_results = [
                r for r in all_scraped_results
                if r.swimrankings_result_id not in existing_ids
            ]
            
            # Step 5: Separate results with splits from those without
            # Note: Splits are stored in a separate dict during scraping
            results_without_splits = []
            splits_map = {}
            
            for r in new_results:
                # For now, all results come without splits in this simplified flow
                # Splits will be fetched in second pass if needed
                results_without_splits.append(r)
            
            logger.info(f"New results: {len(new_results)} to insert")
            
            # Step 6: Insert new results
            if new_results:
                logger.info(f"Inserting {len(new_results)} new results...")
                inserted = await self.persister.insert_results_with_splits(
                    new_results,
                    splits_map
                )
                logger.info(f"Successfully inserted {len(inserted)} results")
                
                # Step 7: Fetch splits for new results >50m if not already fetched
                if not fetch_splits and results_without_splits:
                    results_needing_splits = [
                        r for r in results_without_splits
                        if r.distance > 50
                    ]
                    
                    if results_needing_splits:
                        logger.info(
                            f"Fetching splits for {len(results_needing_splits)} "
                            f"new results >50m..."
                        )
                        await self._fetch_and_insert_splits(
                            results_needing_splits,
                            external_id,
                            existing_result_map
                        )
            
            # Step 8: Deduplicate
            logger.info("Deduplicating results...")
            deleted_count = await self.persister.deduplicate(swimmer_id)
            if deleted_count > 0:
                logger.info(f"Removed {deleted_count} duplicate results")
            
            # Mark as completed
            self.db.update_sync_status(
                external_link_id,
                SyncStatusUpdate(
                    sync_status='completed',
                    last_sync_completed_at=datetime.utcnow().isoformat(),
                    results_count=len(new_results),
                    sync_error=None
                )
            )
            
            # Set final result
            result.success = True
            result.events_processed = total_events
            result.results_imported = len(new_results)
            result.results_skipped = len(existing_ids)
            result.errors = 0
            
            sync_elapsed = time.time() - sync_start_time
            logger.info(
                f"Sync completed: {result.results_imported} imported, "
                f"{result.results_skipped} skipped (took {sync_elapsed:.2f}s)"
            )
            
            return result
            
        except Exception as e:
            sync_elapsed = time.time() - sync_start_time
            result.success = False
            result.error_message = f"{type(e).__name__}: {str(e)}"
            
            logger.error(
                f"Sync failed for swimmer {swimmer_id}: {result.error_message} "
                f"(took {sync_elapsed:.2f}s)",
                exc_info=True
            )
            
            # Mark as failed
            self.db.update_sync_status(
                external_link_id,
                SyncStatusUpdate(
                    sync_status='failed',
                    last_sync_completed_at=datetime.utcnow().isoformat(),
                    sync_error=result.error_message[:500]
                )
            )
            
            return result
    
    async def _scrape_all_events(
        self,
        athlete_id: str,
        events: List[str],
        fetch_splits: bool = False
    ) -> List[WorkoutResult]:
        """
        Scrape all events for a swimmer in parallel
        
        Args:
            athlete_id: SwimRankings athlete ID
            events: List of event names to scrape
            fetch_splits: Whether to fetch splits during scrape
            
        Returns:
            List of WorkoutResult objects with optional splits attached
        """
        from worker.constants import get_style_id, get_stroke_enum
        from worker.sync.services.result_converter import ResultConverter
        
        # Create scraping tasks for all events
        tasks = []
        for event_name in events:
            style_id = get_style_id(event_name)
            if style_id:
                task = self.scraper.fetch_event_attempts(
                    athlete_id=athlete_id,
                    style_id=style_id,
                    limit=None,
                    skip_no_splits=not fetch_splits
                )
                tasks.append((event_name, task))
        
        # Execute all scraping tasks in parallel
        logger.info(f"Launching {len(tasks)} parallel scraping tasks...")
        results_by_event = await asyncio.gather(
            *[task for _, task in tasks],
            return_exceptions=True
        )
        
        # Convert scraped results to WorkoutResult objects
        all_workout_results = []
        
        for (event_name, _), scraped_results in zip(tasks, results_by_event):
            if isinstance(scraped_results, Exception):
                logger.error(f"  {event_name}: Scraping failed - {scraped_results}")
                continue
            
            if not scraped_results or not isinstance(scraped_results, list):
                logger.debug(f"  {event_name}: No results found")
                continue
            
            # Parse event to get distance and stroke
            parts = event_name.split()
            try:
                distance_str = parts[0].rstrip('m')
                distance = int(distance_str)
            except (ValueError, IndexError):
                logger.warning(f"Could not parse distance from: {event_name}")
                continue
            
            stroke_name = ' '.join(parts[1:]) if len(parts) > 1 else 'Freestyle'
            stroke = get_stroke_enum(stroke_name)
            
            if not stroke:
                logger.warning(f"Could not map stroke: {stroke_name}")
                continue
            
            # Convert each result
            for result_with_splits in scraped_results:
                attempt = result_with_splits.attempt
                result_units = ResultConverter.normalize_course(attempt.course)
                
                # Type guard for stroke and result_units
                if result_units not in ('LCM', 'SCM'):
                    logger.warning(f"Invalid course: {result_units}")
                    continue
                
                workout_result = WorkoutResult(
                    swimmer_id='',  # Will be set by caller
                    distance=distance,
                    stroke=stroke,  # type: ignore
                    time_result=attempt.time,
                    result_units=result_units,  # type: ignore
                    performed_on=ResultConverter.parse_date(attempt.date),
                    meet_name=attempt.meet_name,
                    meet_city=attempt.location,
                    meet_nation=None,
                    source='swimrankings',
                    swimrankings_result_id=attempt.result_id,
                    reaction_time=result_with_splits.reaction_time,
                    activity='swim',
                    equipment='none',
                    has_splits_available=result_with_splits.has_splits_available
                )
                
                all_workout_results.append(workout_result)
            
            logger.debug(f"  {event_name}: Converted {len(scraped_results)} results")
        
        return all_workout_results
    
    async def _fetch_and_insert_splits(
        self,
        results_needing_splits: List[WorkoutResult],
        athlete_id: str,
        existing_result_map: Dict[str, str]
    ) -> None:
        """
        Fetch splits for specific results and insert them
        
        Args:
            results_needing_splits: Results that need splits fetched
            athlete_id: SwimRankings athlete ID
            existing_result_map: Map of swimrankings_result_id to database ID
        """
        # Group results by swimrankings_result_id for lookup
        result_lookup = {
            r.swimrankings_result_id: r 
            for r in results_needing_splits
        }
        
        # Fetch splits in parallel (with rate limiting handled by scraper)
        # This is a simplified approach - can be optimized further
        logger.info(f"Fetching splits for {len(results_needing_splits)} results...")
        
        # For now, skip this optimization - splits are fetched during initial scrape
        # This method is a placeholder for future two-pass optimization
        logger.info("Splits fetching in second pass not yet implemented")
    
    @staticmethod
    def _to_event_key(event_name: str, course: str) -> str:
        """
        Convert event name to event key
        
        Args:
            event_name: Event name (e.g., "100 Freestyle")
            course: Course type (LCM or SCM)
            
        Returns:
            Event key (e.g., "100_free_LCM")
        """
        from worker.constants import parse_event_key
        result = parse_event_key(event_name, course)
        return result if result is not None else f"{event_name}_{course}"
