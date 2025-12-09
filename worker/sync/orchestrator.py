"""
Sync orchestrator - main coordination layer using 3-mode architecture
Replaces the monolithic SwimmerSyncService with clear mode-based routing
"""

import asyncio
import logging
from typing import Optional
from datetime import datetime
import time

from worker.models import (
    SyncResult,
    SyncProgress,
    SyncStatusUpdate,
    SyncMode,
)
from worker.services.database_service import DatabaseService
from worker.scrapers.swimrankings_scraper import SwimRankingsScraper
from worker.sync.mode_detector import SyncModeDetector
from worker.sync.handlers.no_history import NoHistorySyncHandler
from worker.sync.handlers.partial_history import PartialHistorySyncHandler
from worker.sync.handlers.full_history import FullHistorySyncHandler
from worker.sync.services.result_persister import ResultPersister
from worker.constants import get_all_events

logger = logging.getLogger('sync_orchestrator')


class SyncOrchestrator:
    """
    Main orchestrator for 3-mode swimmer data synchronization
    
    Routes each event to appropriate handler based on detected mode:
    - NO_HISTORY: Full fetch (new event)
    - PARTIAL_HISTORY: Incremental (stale results)
    - FULL_HISTORY: Skip (fresh data)
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
        import asyncio
        from worker.config import WorkerConfig
        
        self.db = db_service
        self.scraper = scraper
        
        # Initialize mode detection layer
        self.mode_detector = SyncModeDetector(db_service)
        
        # Initialize mode-specific handlers
        self.no_history_handler = NoHistorySyncHandler(db_service, scraper)
        self.partial_history_handler = PartialHistorySyncHandler(db_service, scraper)
        self.full_history_handler = FullHistorySyncHandler()
        
        # Initialize services
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
        Synchronize SwimRankings data for a single swimmer using 3-mode architecture
        
        Args:
            swimmer_id: Database swimmer ID
            external_link_id: swimmer_external_links table ID
            external_id: SwimRankings athlete ID
            limit_events: Limit number of events to sync (None = all)
            force_update: Set True to ignore freshness and fetch all
            
        Returns:
            SyncResult with statistics
        """
        sync_start_time = time.time()
        
        logger.info(
            f"Starting 3-mode sync for swimmer {swimmer_id} "
            f"(athlete_id={external_id}, force_update={force_update})"
        )
        
        # Use a dict to track progress
        progress: dict = {
            'events_processed': 0,
            'results_imported': 0,
            'results_skipped': 0,
            'errors': 0,
        }
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
            
            logger.info(f"Total events to process: {total_events}")
            
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
            
            # PHASE 0: Detect sync mode for each event (per course)
            logger.info("Phase 0: Detecting sync modes for all events...")
            mode_map = self.mode_detector.batch_detect_all_events(
                events_to_sync,
                swimmer_id,
                force_update=force_update
            )
            
            # CRITICAL: Store mode info per event per course (LCM/SCM)
            # This ensures results are only inserted into the correct pool (long vs short course)
            event_course_modes = {}
            for event in events_to_sync:
                event_course_modes[event] = {
                    'LCM': mode_map.get(self._to_event_key(event, 'LCM'), SyncMode.NO_HISTORY),
                    'SCM': mode_map.get(self._to_event_key(event, 'SCM'), SyncMode.NO_HISTORY)
                }
            
            # Segregate events by mode
            # CRITICAL: Track which courses need syncing per event (LCM and SCM are independent)
            # An event can have different modes for different courses
            no_history_events = []
            partial_events = []
            full_events = []
            
            for event in events_to_sync:
                lcm_mode = event_course_modes[event]['LCM']
                scm_mode = event_course_modes[event]['SCM']
                
                # Event needs syncing if EITHER course needs it
                if lcm_mode == SyncMode.NO_HISTORY or scm_mode == SyncMode.NO_HISTORY:
                    if event not in no_history_events:
                        no_history_events.append(event)
                
                if lcm_mode == SyncMode.PARTIAL_HISTORY or scm_mode == SyncMode.PARTIAL_HISTORY:
                    if event not in partial_events:
                        partial_events.append(event)
                
                # Event skipped ONLY if BOTH courses are fresh
                if lcm_mode == SyncMode.FULL_HISTORY and scm_mode == SyncMode.FULL_HISTORY:
                    full_events.append(event)
            
            logger.info(
                f"Mode summary: {len(no_history_events)} NO_HISTORY, "
                f"{len(partial_events)} PARTIAL_HISTORY, {len(full_events)} FULL_HISTORY (total {len(events_to_sync)} events)"
            )
            
            # Log course-level details for mixed-mode events
            for event in events_to_sync:
                lcm_mode = event_course_modes[event]['LCM']
                scm_mode = event_course_modes[event]['SCM']
                if lcm_mode != scm_mode:
                    logger.debug(f"  {event}: LCM={lcm_mode.value}, SCM={scm_mode.value} (mixed modes)")
            
            # PHASE 1-2: Process each mode
            all_results = []
            all_splits_map = {}
            all_stale_ids_to_update = []  # Collect all stale IDs for batch update
            
            # Process NO_HISTORY events (full fetch)
            if no_history_events:
                logger.info(f"Phase 1: Processing {len(no_history_events)} NO_HISTORY events...")
                no_history_results, no_history_splits = await self.no_history_handler.sync_events(
                    no_history_events,
                    external_id,
                    swimmer_id,
                    external_link_id,
                    progress,
                    event_course_modes
                )
                all_results.extend(no_history_results)
                all_splits_map.update(no_history_splits)
                logger.info(f"Phase 1 complete: {len(no_history_results)} results from NO_HISTORY events")
                
                if no_history_splits:
                    logger.info(f"  Collected {sum(len(splits) for splits in no_history_splits.values())} splits for {len(no_history_splits)} results")
            
            # Process PARTIAL_HISTORY events (incremental)
            if partial_events:
                logger.info(f"Phase 1: Processing {len(partial_events)} PARTIAL_HISTORY events...")
                
                # Get stale results info for partial processing
                stale_results, stale_event_keys, _ = self.db.get_swimmer_recent_results(
                    swimmer_id
                )
                results_needing_splits = {}
                for sr_id, data in stale_results.items():
                    if data['distance'] > 50 and not data['has_splits']:
                        results_needing_splits[sr_id] = data['id']
                
                partial_results, stale_ids_to_update, stale_splits = await self.partial_history_handler.sync_events(
                    partial_events,
                    external_id,
                    swimmer_id,
                    external_link_id,
                    stale_results,
                    results_needing_splits,
                    progress,
                    event_course_modes
                )
                all_results.extend(partial_results)
                all_splits_map.update(stale_splits)
                all_stale_ids_to_update.extend(stale_ids_to_update)
                logger.info(f"Phase 1 complete: {len(partial_results)} results from PARTIAL_HISTORY events")

                if stale_splits:
                    logger.info(f"  Collected {sum(len(splits) for splits in stale_splits.values())} splits for {len(stale_splits)} stale results")
            
            # Process FULL_HISTORY events (skip)
            if full_events:
                logger.info(f"Phase 2: Skipping {len(full_events)} FULL_HISTORY events (data is fresh)...")
                await self.full_history_handler.skip_events(full_events, progress)
            
            # PHASE 3: Batch insert all results and finalize
            logger.info(f"Phase 3: Inserting {len(all_results)} total results with {len(all_splits_map)} split maps...")
            
            if all_results:
                # Optimization #3: Parallelize database inserts with asyncio.gather()
                # Insert results with splits and update stale timestamps concurrently
                insert_tasks = []
                insert_tasks.append(self.persister.insert_results_with_splits(all_results, all_splits_map))
                if all_stale_ids_to_update:
                    insert_tasks.append(self.persister.update_stale_timestamps(all_stale_ids_to_update))
                
                results_from_tasks = await asyncio.gather(*insert_tasks)
                inserted = results_from_tasks[0] if results_from_tasks else []
                logger.info(f"Inserted {len(inserted)} results")
                
                if all_splits_map:
                    total_splits = sum(len(splits) for splits in all_splits_map.values())
                    logger.info(f"Inserted {total_splits} race splits across {len(all_splits_map)} results")
            
            # Finalize sync
            logger.info("Finalization: Deduplicating and marking complete...")
            deleted_count = await self.persister.deduplicate(swimmer_id)
            if deleted_count > 0:
                logger.info(f"Removed {deleted_count} duplicate results")
            
            # Mark as completed
            self.db.update_sync_status(
                external_link_id,
                SyncStatusUpdate(
                    sync_status='completed',
                    last_sync_completed_at=datetime.utcnow().isoformat(),
                    results_count=progress['results_imported'],
                    sync_error=None
                )
            )
            
            # Set final result
            result.success = True
            result.events_processed = progress['events_processed']
            result.results_imported = progress['results_imported']
            result.results_skipped = progress['results_skipped']
            result.errors = progress['errors']
            
            sync_elapsed = time.time() - sync_start_time
            logger.info(
                f"Sync completed successfully: "
                f"{result.results_imported} imported, {result.results_skipped} skipped, "
                f"{result.errors} errors (took {sync_elapsed:.2f}s)"
            )
            
            return result
            
        except Exception as e:
            sync_elapsed = time.time() - sync_start_time
            result.success = False
            result.error_message = f"{type(e).__name__}: {str(e)}"
            
            logger.error(
                f"Sync failed for swimmer {swimmer_id}: {result.error_message} (took {sync_elapsed:.2f}s)", 
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
