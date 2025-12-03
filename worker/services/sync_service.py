"""
Sync service orchestration layer
Coordinates swimmer data synchronization
"""

import asyncio
import logging
from typing import Optional, Dict, List, Tuple, Any
from datetime import datetime, timezone

from worker.models import (
    SyncResult, 
    SyncProgress, 
    SyncStatusUpdate,
    WorkoutResult,
    RaceSplit,
    StrokeType,
    CourseType
)
from worker.services.database_service import DatabaseService
from worker.scrapers.swimrankings_scraper import SwimRankingsScraper
from worker.constants import (
    get_all_events,
    get_style_id,
    get_stroke_enum
)
from worker.config import WorkerConfig


logger = logging.getLogger('sync_service')


class SwimmerSyncService:
    """Service for orchestrating swimmer data synchronization"""
    
    def __init__(
        self, 
        db_service: DatabaseService,
        scraper: SwimRankingsScraper
    ):
        """
        Initialize sync service
        
        Args:
            db_service: Database service instance
            scraper: SwimRankings scraper instance
        """
        self.db = db_service
        self.scraper = scraper
    
    async def sync_swimmer(
        self,
        swimmer_id: str,
        external_link_id: str,
        external_id: str,
        limit_events: Optional[int] = None,
        force_update: bool = False
    ) -> SyncResult:
        """
        Synchronize SwimRankings data for a single swimmer
        
        Args:
            swimmer_id: Database swimmer ID
            external_link_id: swimmer_external_links table ID
            external_id: SwimRankings athlete ID
            limit_events: Limit number of events to sync (None = all)
            force_update: Set True to ignore freshness window and re-fetch all results
            
        Returns:
            SyncResult with statistics
        """
        logger.info(f"Starting sync for swimmer {swimmer_id} (athlete_id={external_id}, force_update={force_update})")
        
        progress = SyncProgress()
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
            # Get all swimming events
            all_events = get_all_events()
            events_to_sync = all_events[:limit_events] if limit_events else all_events
            #events_to_sync = all_events[:1]
            total_events = len(events_to_sync)
            
            # Update status to in_progress with progress tracking
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
            
            logger.info(f"Syncing {total_events} events")
            
            # PHASE 0: Check for stale results and determine which events to fetch
            from worker.constants import get_all_event_keys, parse_event_key
            from datetime import timedelta
            
            # Initialize variables (may be overridden by force_update path)
            stale_result_ids = set()
            stale_event_keys = set()
            results_needing_splits = {}  # sr_id -> workout_result_id
            events_to_fetch = set()  # Event names that need fetching
            stale_results = {}  # sr_id -> full result metadata
            
            if not force_update:
                logger.info(f"Phase 0: Checking for stale results (>{WorkerConfig.SYNC_FRESHNESS_HOURS}h old)...")
                
                # Get all possible event keys from constants
                all_possible_event_keys = get_all_event_keys()
                logger.info(f"  Total possible event keys: {len(all_possible_event_keys)}")
                logger.info(f"  All possible: {sorted(all_possible_event_keys)}")
                
                # Get events_checked cache - these are events confirmed to have NO results
                # No timestamp checking needed; presence in cache = swimmer never competed in this event
                cached_empty_events = set(self.db.get_events_checked(external_link_id).keys())
                
                logger.info(f"  Cached empty events: {len(cached_empty_events)} event keys")
                logger.info(f"  Cached: {sorted(cached_empty_events)}")
                
                # Get stale results, stale event keys, and all event keys in DB
                stale_results, stale_event_keys, db_event_keys = self.db.get_swimmer_recent_results(
                    swimmer_id, 
                    hours=WorkerConfig.SYNC_FRESHNESS_HOURS
                )
                
                logger.info(f"  DB event keys: {len(db_event_keys)}")
                logger.info(f"  DB keys: {sorted(db_event_keys)}")
                logger.info(f"  Stale event keys: {len(stale_event_keys)}")
                logger.info(f"  Stale: {sorted(stale_event_keys)}")
                
                if stale_results:
                    stale_result_ids = set(stale_results.keys())
                    
                    # Find stale results that need splits
                    for sr_id, data in stale_results.items():
                        if data['distance'] > 50 and not data['has_splits']:
                            results_needing_splits[sr_id] = data['id']
                
                # Calculate which events to fetch:
                # 1. Missing events (no data in DB AND not in empty cache) - need to fetch
                # 2. Events with fresh data - SKIP (recently synced)
                # 3. Events with only stale data - need to re-fetch
                # 4. Cached empty events - SKIP (confirmed no results)
                missing_event_keys = all_possible_event_keys - db_event_keys
                fresh_event_keys = db_event_keys - stale_event_keys
                
                logger.info(f"  Missing event keys (not in DB): {len(missing_event_keys)}")
                logger.info(f"  Missing: {sorted(missing_event_keys)}")
                logger.info(f"  Fresh event keys (in DB, recent): {len(fresh_event_keys)}")
                logger.info(f"  Fresh: {sorted(fresh_event_keys)}")
                
                # Exclude cached empty events from missing events
                truly_missing_event_keys = missing_event_keys - cached_empty_events
                
                logger.info(f"  Truly missing (not in DB, not cached): {len(truly_missing_event_keys)}")
                logger.info(f"  Truly missing: {sorted(truly_missing_event_keys)}")
                
                # Only fetch: truly missing OR stale events
                # Skip: fresh events (recently synced) OR cached empty events
                event_keys_to_fetch = truly_missing_event_keys | stale_event_keys
                
                logger.info(f"  Event keys to fetch: {len(event_keys_to_fetch)}")
                logger.info(f"  To fetch: {sorted(event_keys_to_fetch)}")
                
                # Map back to event names for Phase 1
                for event_name in events_to_sync:
                    # Check if this event needs fetching for ANY course
                    lcm_key = parse_event_key(event_name, 'LCM')
                    scm_key = parse_event_key(event_name, 'SCM')
                    
                    # Debug: Check why this event is being fetched or skipped
                    lcm_in_fetch = lcm_key in event_keys_to_fetch
                    scm_in_fetch = scm_key in event_keys_to_fetch
                    
                    # Fetch if either course is missing OR stale (not fresh)
                    if lcm_in_fetch or scm_in_fetch:
                        events_to_fetch.add(event_name)
                        logger.debug(f"  Will fetch {event_name}: LCM={lcm_in_fetch}, SCM={scm_in_fetch}")
                    else:
                        logger.debug(f"  Skipping {event_name}: both courses fresh/cached")
                
                logger.info(
                    f"  Found {len(stale_result_ids)} stale results across {len(stale_event_keys)} event types"
                )
                logger.info(
                    f"  - {len(missing_event_keys)} event keys missing from DB"
                )
                logger.info(
                    f"  - {len(cached_empty_events)} event keys cached as empty (will skip)"
                )
                logger.info(
                    f"  - {len(truly_missing_event_keys)} event keys truly missing (will fetch)"
                )
                logger.info(
                    f"  - {len(fresh_event_keys)} event keys have fresh data (will skip)"
                )
                logger.info(
                    f"  - {len(stale_event_keys)} event keys fully stale (will re-fetch)"
                )
                logger.info(
                    f"  Need to fetch {len(events_to_fetch)}/{len(events_to_sync)} events, "
                    f"{len(results_needing_splits)} stale results need splits"
                )
                
                # PHASE 0B: Smart comparison - check if most recent external result matches DB
                # This optimization skips 50-80% of events for stable swimmers
                # Parallelized with asyncio.gather() to fetch all comparisons concurrently
                logger.info("Phase 0B: Smart comparison - checking most recent results (parallelized)...")
                most_recent_per_event = self.db.get_swimmer_most_recent_result_per_event(swimmer_id)
                logger.info(f"  Retrieved {len(most_recent_per_event)} most recent results from DB per event")
                
                # Build list of comparison tasks to run in parallel
                # Each task: fetch 1 most recent external result and prepare comparison data
                comparison_tasks = []
                event_comparison_map = {}  # Maps task index to (event_name, course_type, db_result_key)
                
                for event_name in events_to_fetch:
                    lcm_key = parse_event_key(event_name, 'LCM')
                    scm_key = parse_event_key(event_name, 'SCM')
                    
                    # Create comparison task for LCM if we have DB data
                    if lcm_key in most_recent_per_event:
                        style_id = get_style_id(event_name)
                        if style_id:
                            task_idx = len(comparison_tasks)
                            comparison_tasks.append(
                                self.scraper.fetch_event_attempts(
                                    athlete_id=external_id,
                                    style_id=style_id,
                                    limit=1,
                                    skip_no_splits=False
                                )
                            )
                            event_comparison_map[task_idx] = (event_name, 'LCM', lcm_key)
                    
                    # Create comparison task for SCM if we have DB data
                    if scm_key in most_recent_per_event:
                        style_id = get_style_id(event_name)
                        if style_id:
                            task_idx = len(comparison_tasks)
                            comparison_tasks.append(
                                self.scraper.fetch_event_attempts(
                                    athlete_id=external_id,
                                    style_id=style_id,
                                    limit=1,
                                    skip_no_splits=False
                                )
                            )
                            event_comparison_map[task_idx] = (event_name, 'SCM', scm_key)
                
                # Execute all comparison fetches in parallel
                logger.info(f"  Fetching {len(comparison_tasks)} most recent external results in parallel...")
                if comparison_tasks:
                    comparison_results = await asyncio.gather(*comparison_tasks, return_exceptions=True)
                else:
                    comparison_results = []
                
                # Process comparison results
                events_skipped_by_comparison = 0
                events_to_fetch_optimized = set(events_to_fetch)  # Start with all, remove skipped ones
                
                for task_idx, external_results in enumerate(comparison_results):
                    if task_idx not in event_comparison_map:
                        continue
                    
                    event_name, course_type, db_key = event_comparison_map[task_idx]
                    
                    try:
                        if isinstance(external_results, Exception):
                            # Fetch failed - be conservative and fetch to be safe
                            logger.debug(f"  {event_name} ({course_type}): Comparison fetch failed - will fetch to be safe")
                            continue
                        
                        # Type guard: ensure external_results is list, not Exception
                        if not isinstance(external_results, list):
                            logger.debug(f"  {event_name} ({course_type}): Unexpected result type - will fetch to be safe")
                            continue
                        
                        if external_results:
                            external_newest = external_results[0].attempt
                            db_newest = most_recent_per_event[db_key]
                            
                            # Compare: if same time and date, mark for skipping
                            if (external_newest.time == db_newest['time_result'] and 
                                external_newest.date == db_newest['performed_on']):
                                logger.debug(f"  {event_name} ({course_type}): Most recent unchanged - skipping fetch")
                                events_skipped_by_comparison += 1
                                # Only remove from events_to_fetch_optimized if BOTH courses are skipped
                                # This will be handled after processing all results
                            else:
                                logger.debug(f"  {event_name} ({course_type}): Changed ({db_newest['time_result']} → {external_newest.time}) - will fetch all")
                        else:
                            # No external results, but we have DB results - skip
                            logger.debug(f"  {event_name} ({course_type}): No external results, skipping")
                            events_skipped_by_comparison += 1
                    except Exception as e:
                        logger.debug(f"  {event_name} ({course_type}): Comparison processing failed ({e}) - will fetch to be safe")
                        continue
                
                # Now do a second pass to determine which events to truly fetch
                # Only fetch events where both courses have changes OR we couldn't compare
                events_to_fetch_final = set()
                skipped_events = set()
                
                for event_name in events_to_fetch_optimized:
                    lcm_key = parse_event_key(event_name, 'LCM')
                    scm_key = parse_event_key(event_name, 'SCM')
                    
                    should_fetch = False
                    
                    # Check if either course needs fetching
                    lcm_needs_fetch = True  # Default to fetch if not in comparison_map
                    scm_needs_fetch = True
                    
                    # Look for this event in comparison results
                    for task_idx, (comp_event, comp_course, comp_key) in event_comparison_map.items():
                        if comp_event != event_name:
                            continue
                        
                        if task_idx >= len(comparison_results):
                            continue
                        
                        result_item = comparison_results[task_idx]
                        
                        # Skip if the task failed with an exception
                        if isinstance(result_item, Exception):
                            continue
                        
                        external_results = result_item
                        
                        if external_results:
                            external_newest = external_results[0].attempt
                            db_newest = most_recent_per_event[comp_key]
                            
                            unchanged = (external_newest.time == db_newest['time_result'] and 
                                       external_newest.date == db_newest['performed_on'])
                            
                            if comp_course == 'LCM':
                                lcm_needs_fetch = not unchanged
                            elif comp_course == 'SCM':
                                scm_needs_fetch = not unchanged
                        # If no results, keep the default (fetch to be safe)
                    
                    # Fetch if either course needs it
                    if lcm_needs_fetch or scm_needs_fetch:
                        events_to_fetch_final.add(event_name)
                    else:
                        skipped_events.add(event_name)
                
                # Use final optimized set
                events_to_fetch = events_to_fetch_final
                logger.info(f"  Smart comparison (parallelized): Skipped {len(skipped_events)} events, now fetching {len(events_to_fetch)}")

            else:
                # Force update: fetch all events
                events_to_fetch = set(events_to_sync)

            
            # STEP 4: Early termination if no events need fetching
            # If all events were skipped (stable swimmer with no new/changed data),
            # mark sync complete and skip the entire pipeline
            if not events_to_fetch:
                logger.info(f"Early termination: No events require fetching - all data is fresh/unchanged")
                result.events_processed = len(events_to_sync)
                result.success = True
                result.results_imported = 0
                result.results_skipped = len(events_to_sync)
                
                # Mark sync as complete with success
                self.db.update_sync_status(
                    external_link_id,
                    SyncStatusUpdate(
                        sync_status='completed',
                        last_sync_completed_at=datetime.utcnow().isoformat(),
                        sync_error=None,
                        sync_progress=total_events,
                        sync_total=total_events
                    )
                )
                
                logger.info(f"Sync completed early for swimmer {swimmer_id}: all {total_events} events fresh (0 fetched)")
                return result
            
            # PIPELINE: Overlap event fetching with result processing and split fetching
            # This provides ~40-50% performance improvement by utilizing I/O wait time
            await self._pipeline_sync_events(
                events_to_sync,
                events_to_fetch,
                external_id,
                swimmer_id,
                external_link_id,
                stale_result_ids,
                stale_results,
                results_needing_splits,
                progress
            )
            
            if await self._check_cancellation(external_link_id):
                result.success = False
                return result
            
            # Finalize sync
            self._finalize_sync(external_link_id, progress, result)
            
        except Exception as e:
            result.success = False
            result.error_message = f"{type(e).__name__}: {str(e)}"
            
            logger.error(f"Failed to sync swimmer {swimmer_id}: {result.error_message}")
            
            # Mark as failed
            self.db.update_sync_status(
                external_link_id,
                SyncStatusUpdate(
                    sync_status='failed',
                    last_sync_completed_at=datetime.utcnow().isoformat(),
                    sync_error=result.error_message[:500] if result.error_message else None
                )
            )
        
        return result
    
    async def _pipeline_sync_events(
        self,
        events_to_sync: List[str],
        events_to_fetch: set,
        external_id: str,
        swimmer_id: str,
        external_link_id: str,
        stale_result_ids: set,
        stale_results: Dict[str, Dict[str, Any]],
        results_needing_splits: Dict[str, str],
        progress: SyncProgress
    ) -> None:
        """
        Pipeline parallelization: Overlap event fetching with result processing
        
        This producer-consumer pattern allows event fetching and result processing
        to run in parallel, significantly improving performance by utilizing I/O
        wait time during network requests.
        
        Architecture:
        - Producer: Fetches event pages and pushes to queue
        - Consumer: Processes events, inserts results, fetches splits
        - Queue provides backpressure control to prevent memory issues
        
        Args:
            events_to_sync: All events to potentially sync
            events_to_fetch: Events that need fresh data
            external_id: SwimRankings athlete ID
            swimmer_id: Database swimmer ID
            external_link_id: swimmer_external_links table ID
            stale_result_ids: Results to skip (being refreshed)
            stale_results: Full metadata of stale results
            results_needing_splits: Stale results needing split fetching
            progress: Progress tracking object
        """
        logger.info("Starting pipelined event sync (overlapping fetch + process)...")
        
        # Create bounded queue for event flow control
        # Max size prevents unbounded memory growth if processing is slower than fetching
        event_queue = asyncio.Queue(maxsize=WorkerConfig.PIPELINE_QUEUE_SIZE)
        
        # Track pipeline metrics
        pipeline_stats = {
            'events_fetched': 0,
            'events_processed': 0,
            'peak_queue_size': 0,
            'total_splits_inserted': 0
        }
        
        # Update stale results timestamp once at start (from Phase 2)
        if stale_results:
            stale_db_ids = [data['id'] for sr_id, data in stale_results.items()]
            if stale_db_ids:
                self.db.update_stale_results_timestamp(stale_db_ids)
                logger.info(f"  ✅ Updated timestamps for {len(stale_db_ids)} stale results")
        
        # Handle stale results needing splits (fetch and insert separately)
        if results_needing_splits:
            logger.info(f"Fetching splits for {len(results_needing_splits)} stale results...")
            stale_splits_list = [
                {
                    'sr_result_id': sr_id.split('_', 1)[1] if '_' in sr_id else sr_id,
                    'workout_result_id': workout_result_id
                }
                for sr_id, workout_result_id in results_needing_splits.items()
            ]
            await self._fetch_splits_batch(stale_splits_list, external_link_id)
        
        # Producer: Fetch events and push to queue
        async def event_producer():
            """Fetch events and push to processing queue"""
            empty_event_keys = []
            total_events = len(events_to_sync)
            
            try:
                for idx, event_name in enumerate(events_to_sync):
                    # Check cancellation
                    if await self._check_cancellation(external_link_id):
                        logger.info("[Producer] Sync cancelled")
                        break
                    
                    # Parse event details
                    parts = event_name.split('m ')
                    if len(parts) != 2:
                        progress.events_processed += 1
                        continue
                    
                    distance = int(parts[0])
                    stroke_name = parts[1]
                    stroke_enum = get_stroke_enum(stroke_name)
                    style_id = get_style_id(event_name)
                    
                    if not stroke_enum or not style_id:
                        logger.warning(f"[Producer] Skipping {event_name}: missing stroke or style_id")
                        progress.events_processed += 1
                        continue
                    
                    # Skip if not in fetch set
                    if event_name not in events_to_fetch:
                        logger.info(f"[Producer] [{idx+1}/{total_events}] Skipping {event_name} - fresh")
                        progress.events_processed += 1
                        continue
                    
                    logger.info(f"[Producer] [{idx+1}/{total_events}] Fetching {event_name} (queue: {event_queue.qsize()})")
                    
                    # Fetch event attempts (fetch ALL attempts, filter for splits later)
                    attempts = await self.scraper.fetch_event_attempts(
                        athlete_id=external_id,
                        style_id=style_id,
                        limit=None,
                        skip_no_splits=False,  # Fetch all attempts; consumer will decide what to insert
                        external_link_id=external_link_id,
                        check_cancellation_fn=lambda: self._check_cancellation(external_link_id)
                    )
                    
                    logger.info(f"[Producer]   Fetched {len(attempts)} attempt(s)")
                    
                    # Track empty events for caching
                    from worker.constants import parse_event_key
                    lcm_key = parse_event_key(event_name, 'LCM')
                    scm_key = parse_event_key(event_name, 'SCM')
                    
                    lcm_count = sum(1 for a in attempts if 'Long Course' in a.attempt.course or '50m' in a.attempt.course)
                    scm_count = sum(1 for a in attempts if 'Short Course' in a.attempt.course or '25m' in a.attempt.course)
                    
                    if lcm_count == 0:
                        empty_event_keys.append(lcm_key)
                    if scm_count == 0:
                        empty_event_keys.append(scm_key)
                    
                    # Push event data to queue
                    event_data = {
                        'event_name': event_name,
                        'distance': distance,
                        'stroke_name': stroke_name,
                        'stroke_enum': stroke_enum,
                        'style_id': style_id,
                        'attempts': attempts
                    }
                    
                    await event_queue.put(event_data)
                    pipeline_stats['events_fetched'] += 1
                    pipeline_stats['peak_queue_size'] = max(pipeline_stats['peak_queue_size'], event_queue.qsize())
                    
                    # Update progress periodically
                    if (idx + 1) % 5 == 0 or (idx + 1) == total_events:
                        self.db.update_sync_status(
                            external_link_id,
                            SyncStatusUpdate(
                                sync_status='in_progress',
                                sync_progress=progress.events_processed
                            )
                        )
                
                # Update empty events cache
                if empty_event_keys:
                    logger.info(f"[Producer] Recording {len(empty_event_keys)} empty event keys")
                    self.db.update_events_checked(external_link_id, empty_event_keys)
                
            except Exception as e:
                logger.error(f"[Producer] Fatal error: {e}", exc_info=True)
                raise
            finally:
                # Signal completion
                await event_queue.put(None)
                logger.info(f"[Producer] Complete: fetched {pipeline_stats['events_fetched']} events")
        
        # Consumer: Process events and insert results with splits
        async def event_consumer():
            """Process events from queue: insert results with splits"""
            try:
                while True:
                    # Get next event from queue
                    event_data = await event_queue.get()
                    
                    if event_data is None:  # Producer finished
                        break
                    
                    event_name = event_data['event_name']
                    distance = event_data['distance']
                    stroke_name = event_data['stroke_name']
                    stroke_enum = event_data['stroke_enum']
                    attempts = event_data['attempts']
                    
                    logger.info(f"[Consumer] Processing {distance}m {stroke_name} ({len(attempts)} attempts)")
                    
                    # Build and filter result IDs
                    event_result_ids = []
                    result_id_to_data = {}
                    
                    for attempt_idx, attempt in enumerate(attempts):
                        attempt_data = attempt.attempt
                        
                        # Parse course
                        course_text = attempt_data.course
                        if 'Long Course' in course_text or '50m' in course_text:
                            course = 'LCM'
                        elif 'Short Course' in course_text or '25m' in course_text:
                            course = 'SCM'
                        else:
                            continue
                        
                        # Build swimrankings_result_id
                        if attempt_data.result_id:
                            swimrankings_result_id = f"{external_id}_{attempt_data.result_id}"
                        else:
                            # Fallback: Use stable content-based ID (no attempt_idx to avoid duplicates)
                            # Format: athleteId_date_distance_stroke_course_time_location
                            location_key = attempt_data.location.replace(' ', '_').replace(',', '') if attempt_data.location else 'unknown'
                            swimrankings_result_id = (
                                f"{external_id}_{attempt_data.date}_{distance}_"
                                f"{stroke_name}_{course}_{attempt_data.time}_{location_key}"
                            )
                        
                        event_result_ids.append(swimrankings_result_id)
                        result_id_to_data[swimrankings_result_id] = (attempt_idx, course, attempt)
                    
                    logger.debug(f"[Consumer]   Built {len(event_result_ids)} result IDs from {len(attempts)} attempts")
                    
                    # Filter out stale and existing results
                    fresh_result_ids = [rid for rid in event_result_ids if rid not in stale_result_ids]
                    existing_results = self.db.check_existing_results(fresh_result_ids, swimmer_id, chunk_size=50)
                    new_result_ids = set(fresh_result_ids) - set(existing_results.keys())
                    
                    skipped_count = len(existing_results) + (len(event_result_ids) - len(fresh_result_ids))
                    progress.results_skipped += skipped_count
                    
                    logger.info(
                        f"[Consumer]   {len(new_result_ids)} new, {skipped_count} skipped "
                        f"(total_ids: {len(event_result_ids)}, stale_filtered: {len(event_result_ids) - len(fresh_result_ids)}, "
                        f"existing_in_db: {len(existing_results)})"
                    )
                    
                    if not new_result_ids:
                        progress.events_processed += 1
                        pipeline_stats['events_processed'] += 1
                        continue
                    
                    # Prepare results and splits for insertion
                    workout_results_to_insert = []
                    splits_map = {}  # Map swimrankings_result_id -> List[RaceSplit]
                    splits_inserted_count = 0
                    
                    for result_id in new_result_ids:
                        try:
                            attempt_idx, course, attempt = result_id_to_data[result_id]
                            attempt_data = attempt.attempt
                            
                            # Convert and validate
                            time_interval = self._convert_time_to_interval(attempt_data.time)
                            performed_on = self._parse_date(attempt_data.date)
                            
                            if not performed_on:
                                continue
                            
                            city, nation = self._parse_location(attempt_data.location)
                            
                            # Create workout result
                            workout_result = WorkoutResult(
                                swimmer_id=swimmer_id,
                                distance=distance,
                                stroke=stroke_enum,
                                time_result=time_interval,
                                result_units=course,
                                performed_on=performed_on,
                                meet_name=attempt_data.meet_name,
                                meet_city=city,
                                meet_nation=nation,
                                source='swimrankings',
                                swimrankings_result_id=result_id,
                                reaction_time=attempt.reaction_time,
                                activity='swim',
                                equipment='none',
                                has_splits_available=attempt.has_splits_available
                            )
                            
                            workout_results_to_insert.append(workout_result)
                            
                            # Collect splits if available (already fetched by producer)
                            if attempt.splits and len(attempt.splits) > 0:
                                splits_map[result_id] = attempt.splits
                        
                        except Exception as e:
                            logger.error(f"[Consumer] Error preparing result: {e}")
                            progress.errors += 1
                            continue
                    
                    # Insert results with splits in single operation
                    if workout_results_to_insert:
                        inserted_records = self.db.bulk_insert_workout_results_with_splits(
                            workout_results_to_insert,
                            splits_map
                        )
                        
                        if inserted_records:
                            progress.results_imported += len(inserted_records)
                            splits_inserted_count = len(splits_map)
                            
                            logger.info(
                                f"[Consumer]   ✅ Inserted {len(inserted_records)} results "
                                f"({splits_inserted_count} with splits)"
                            )
                            
                            # Update progress
                            self.db.update_sync_status(
                                external_link_id,
                                SyncStatusUpdate(
                                    sync_status='in_progress',
                                    sync_progress=progress.events_processed,
                                    results_count=progress.results_imported
                                )
                            )
                    
                    progress.events_processed += 1
                    pipeline_stats['events_processed'] += 1
                    
            except Exception as e:
                logger.error(f"[Consumer] Fatal error: {e}", exc_info=True)
                raise
            finally:
                logger.info(f"[Consumer] Complete: processed {pipeline_stats['events_processed']} events")
        
        # Run producer and consumer in parallel
        try:
            await asyncio.gather(
                event_producer(),
                event_consumer()
            )
            
            logger.info(
                f"Pipeline complete: {pipeline_stats['events_fetched']} fetched, "
                f"{pipeline_stats['events_processed']} processed, "
                f"peak queue: {pipeline_stats['peak_queue_size']}"
            )
            
        except Exception as e:
            logger.error(f"Pipeline error: {e}", exc_info=True)
            raise
    
    async def _fetch_splits_batch(
        self,
        results_needing_splits: List[Dict],
        external_link_id: str
    ) -> int:
        """
        Fetch splits in micro-batches with concurrency control
        
        Args:
            results_needing_splits: Results that need split data
            external_link_id: swimmer_external_links table ID
            
        Returns:
            Number of results with splits inserted
        """
        total_splits_inserted = 0
        batch_size = WorkerConfig.SPLIT_BATCH_SIZE
        
        for i in range(0, len(results_needing_splits), batch_size):
            if await self._check_cancellation(external_link_id):
                logger.info("Sync cancelled during splits fetch")
                break
            
            batch = results_needing_splits[i:i + batch_size]
            batch_num = i//batch_size + 1
            total_batches = (len(results_needing_splits) + batch_size - 1)//batch_size
            
            logger.info(f"  Split batch {batch_num}/{total_batches}: {len(batch)} results")
            
            # Fetch concurrently with semaphore
            semaphore = asyncio.Semaphore(WorkerConfig.MAX_WORKERS)
            
            async def fetch_with_semaphore(split_info: Dict) -> Optional[Dict]:
                async with semaphore:
                    sr_result_id = split_info['sr_result_id']
                    workout_result_id = split_info['workout_result_id']
                    
                    if not workout_result_id:
                        return None
                    
                    return await self._fetch_splits_with_id(sr_result_id, workout_result_id)
            
            tasks = [fetch_with_semaphore(info) for info in batch]
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Collect splits for insertion
            splits_to_insert = {}
            results_without_splits = []
            
            for split_result in batch_results:
                # Skip exceptions and None results
                if isinstance(split_result, Exception) or not split_result or not isinstance(split_result, dict):
                    continue
                
                workout_result_id = split_result.get('workout_result_id')
                if not workout_result_id:
                    continue
                    
                if split_result.get('splits'):
                    splits_to_insert[workout_result_id] = split_result['splits']
                elif split_result.get('has_splits_available') is False:
                    results_without_splits.append(workout_result_id)
            
            # Insert batch
            if splits_to_insert:
                self.db.bulk_insert_splits_for_multiple_results(splits_to_insert)
                total_splits_inserted += len(splits_to_insert)
                logger.info(f"    ✅ Inserted splits for {len(splits_to_insert)} results")
            
            if results_without_splits:
                self.db.mark_results_without_splits(results_without_splits)
        
        return total_splits_inserted

    async def _fetch_all_event_pages(
        self,
        events_to_sync: List[str],
        external_id: str,
        external_link_id: str,
        progress: SyncProgress,
        events_to_fetch: set
    ) -> List[Dict]:
        """
        Phase 1: Fetch event pages (only for events that need data)
        
        Args:
            events_to_sync: List of all event names
            external_id: SwimRankings athlete ID
            external_link_id: swimmer_external_links table ID
            progress: Progress tracker
            events_to_fetch: Set of event names that need fetching (not fully stale)
            progress: Progress tracker
            
        Returns:
            List of event data dictionaries
        """
        logger.info("Phase 1: Fetching all event pages...")
        all_event_data = []
        empty_event_keys = []  # Track event keys with NO results (for caching)
        check_cancellation = lambda: self._check_cancellation(external_link_id)
        total_events = len(events_to_sync)
        
        for idx, event_name in enumerate(events_to_sync):
            try:
                # Check if sync was cancelled
                if await self._check_cancellation(external_link_id):
                    logger.info("Sync cancelled by user")
                    break
                
                # Parse event details
                parts = event_name.split('m ')
                if len(parts) != 2:
                    progress.events_processed += 1
                    continue
                
                distance = int(parts[0])
                stroke_name = parts[1]
                stroke_enum = get_stroke_enum(stroke_name)
                style_id = get_style_id(event_name)
                
                if not stroke_enum or not style_id:
                    logger.warning(f"Skipping {event_name}: missing stroke or style_id")
                    progress.events_processed += 1
                    continue
                
                # Skip if this event doesn't need fetching (all results are fresh)
                if event_name not in events_to_fetch:
                    logger.info(f"[{idx+1}/{total_events}] Skipping {event_name} - all results are fresh")
                    progress.events_processed += 1
                    continue
                
                logger.info(f"[{idx+1}/{total_events}] Fetching {event_name} (style_id={style_id})")
                
                # Fetch event attempts WITHOUT splits (fast)
                attempts = await self.scraper.fetch_event_attempts(
                    athlete_id=external_id,
                    style_id=style_id,
                    limit=None,
                    skip_no_splits=True,
                    external_link_id=external_link_id,
                    check_cancellation_fn=check_cancellation
                )
                
                logger.info(f"  Fetched {len(attempts)} attempt(s)")
                
                # Check which courses have zero results and record those as empty
                from worker.constants import parse_event_key
                lcm_key = parse_event_key(event_name, 'LCM')
                scm_key = parse_event_key(event_name, 'SCM')
                
                # Count results per course
                lcm_count = sum(1 for a in attempts if 'Long Course' in a.attempt.course or '50m' in a.attempt.course)
                scm_count = sum(1 for a in attempts if 'Short Course' in a.attempt.course or '25m' in a.attempt.course)
                
                # Record empty event keys (no results for that specific course)
                if lcm_count == 0:
                    empty_event_keys.append(lcm_key)
                    logger.debug(f"    Recording empty LCM: {lcm_key}")
                if scm_count == 0:
                    empty_event_keys.append(scm_key)
                    logger.debug(f"    Recording empty SCM: {scm_key}")
                
                # Store event data for Phase 2
                all_event_data.append({
                    'event_name': event_name,
                    'distance': distance,
                    'stroke_name': stroke_name,
                    'stroke_enum': stroke_enum,
                    'style_id': style_id,
                    'attempts': attempts
                })
                
                progress.events_processed += 1
                
                # Update progress every 5 events (reduce DB roundtrips)
                if (idx + 1) % 5 == 0 or (idx + 1) == total_events:
                    self.db.update_sync_status(
                        external_link_id,
                        SyncStatusUpdate(
                            sync_status='in_progress',
                            sync_progress=progress.events_processed
                        )
                    )
                
            except Exception as e:
                logger.error(f"Error fetching event {event_name}: {e}")
                progress.errors += 1
                progress.events_processed += 1
                continue
        
        # Update events_checked cache ONLY for empty events (no results found)
        if empty_event_keys:
            logger.info(f"📝 Recording {len(empty_event_keys)} EMPTY event keys in cache")
            self.db.update_events_checked(external_link_id, empty_event_keys)
        
        logger.info(f"Phase 1 complete: Fetched {len(all_event_data)} events")
        return all_event_data
    
    async def _process_and_insert_new_results(
        self,
        all_event_data: List[Dict],
        swimmer_id: str,
        external_id: str,
        external_link_id: str,
        stale_result_ids: set,
        stale_results: Dict[str, Dict[str, Any]],
        results_needing_splits: Dict[str, str],
        progress: SyncProgress
    ) -> List[Dict]:
        """
        Phase 2: Process and insert new results with splits (STREAMING - per-event inserts)
        
        Args:
            all_event_data: Event data from Phase 1
            swimmer_id: Database swimmer ID
            external_id: SwimRankings athlete ID
            external_link_id: swimmer_external_links table ID
            stale_result_ids: Set of stale result IDs to skip
            stale_results: Dict of all stale results with metadata {sr_id: {id, created_at, ...}}
            results_needing_splits: Dict of stale results needing splits {sr_id: workout_result_id}
            progress: Progress tracker
            
        Returns:
            List of inserted workout result records
        """
        logger.info("Phase 2: Processing and inserting new results with splits (streaming mode)...")
        
        # Update stale results timestamp once at start
        if stale_results:
            stale_db_ids = [data['id'] for sr_id, data in stale_results.items()]
            if stale_db_ids:
                self.db.update_stale_results_timestamp(stale_db_ids)
                logger.info(f"  ✅ Updated timestamps for {len(stale_db_ids)} stale results")
        
        # Fetch splits for stale results that don't have them yet
        if results_needing_splits:
            logger.info(f"Fetching splits for {len(results_needing_splits)} stale results...")
            stale_splits_list = [
                {
                    'sr_result_id': sr_id.split('_', 1)[1] if '_' in sr_id else sr_id,
                    'workout_result_id': workout_result_id
                }
                for sr_id, workout_result_id in results_needing_splits.items()
            ]
            await self._fetch_splits_batch(stale_splits_list, external_link_id)
        
        # Tracking for aggregated results
        all_inserted_records = []
        
        # Process each event independently and insert immediately with splits
        total_skipped = 0
        for event_idx, event_data in enumerate(all_event_data, 1):
            logger.info(f"  Event {event_idx}/{len(all_event_data)}: {event_data['distance']}m {event_data['stroke_name']}")
            
            # Build result IDs for this event only
            event_result_ids = []
            result_id_to_data = {}
            
            for attempt_idx, attempt in enumerate(event_data['attempts']):
                attempt_data = attempt.attempt
                
                # Parse course
                course_text = attempt_data.course
                if 'Long Course' in course_text or '50m' in course_text:
                    course = 'LCM'
                elif 'Short Course' in course_text or '25m' in course_text:
                    course = 'SCM'
                else:
                    continue
                
                # Build swimrankings_result_id
                if attempt_data.result_id:
                    swimrankings_result_id = f"{external_id}_{attempt_data.result_id}"
                else:
                    # Fallback: Use stable content-based ID (no attempt_idx to avoid duplicates)
                    # Format: athleteId_date_distance_stroke_course_time_location
                    location_key = attempt_data.location.replace(' ', '_').replace(',', '') if attempt_data.location else 'unknown'
                    swimrankings_result_id = (
                        f"{external_id}_{attempt_data.date}_{event_data['distance']}_"
                        f"{event_data['stroke_name']}_{course}_{attempt_data.time}_{location_key}"
                    )
                
                event_result_ids.append(swimrankings_result_id)
                result_id_to_data[swimrankings_result_id] = (attempt_idx, course, attempt)
            
            # Filter out stale results for this event
            fresh_result_ids = [rid for rid in event_result_ids if rid not in stale_result_ids]
            
            # Check which exist
            existing_results = self.db.check_existing_results(fresh_result_ids, swimmer_id, chunk_size=50)
            new_result_ids = set(fresh_result_ids) - set(existing_results.keys())
            
            skipped_count = len(existing_results) + (len(event_result_ids) - len(fresh_result_ids))
            total_skipped += skipped_count
            
            logger.info(f"    {len(new_result_ids)} new, {skipped_count} skipped")
            
            if not new_result_ids:
                continue
            
            # Prepare results and splits for this event
            workout_results_to_insert = []
            splits_map = {}  # Map swimrankings_result_id -> List[RaceSplit]
            
            for result_id in new_result_ids:
                try:
                    attempt_idx, course, attempt = result_id_to_data[result_id]
                    attempt_data = attempt.attempt
                    
                    # Convert time and parse date
                    time_interval = self._convert_time_to_interval(attempt_data.time)
                    performed_on = self._parse_date(attempt_data.date)
                    
                    if not performed_on:
                        logger.warning(f"Could not parse date: {attempt_data.date}")
                        continue
                    
                    # Parse location
                    city, nation = self._parse_location(attempt_data.location)
                    
                    # Create workout result
                    workout_result = WorkoutResult(
                        swimmer_id=swimmer_id,
                        distance=event_data['distance'],
                        stroke=event_data['stroke_enum'],
                        time_result=time_interval,
                        result_units=course,
                        performed_on=performed_on,
                        meet_name=attempt_data.meet_name,
                        meet_city=city,
                        meet_nation=nation,
                        source='swimrankings',
                        swimrankings_result_id=result_id,
                        reaction_time=attempt.reaction_time,
                        activity='swim',
                        equipment='none',
                        has_splits_available=attempt.has_splits_available
                    )
                    
                    workout_results_to_insert.append(workout_result)
                    
                    # Collect splits if available
                    if attempt.splits and len(attempt.splits) > 0:
                        splits_map[result_id] = attempt.splits
                
                except Exception as e:
                    logger.error(f"Error preparing result {result_id}: {e}")
                    progress.errors += 1
                    continue
            
            # INSERT IMMEDIATELY for this event with splits
            if workout_results_to_insert:
                inserted_records = self.db.bulk_insert_workout_results_with_splits(
                    workout_results_to_insert,
                    splits_map
                )
                
                if inserted_records:
                    all_inserted_records.extend(inserted_records)
                    progress.results_imported += len(inserted_records)
                    splits_inserted_count = len(splits_map)
                    
                    logger.info(
                        f"    ✅ Inserted {len(inserted_records)} results "
                        f"({splits_inserted_count} with splits, total: {progress.results_imported})"
                    )
                    
                    # Update progress immediately
                    self.db.update_sync_status(
                        external_link_id,
                        SyncStatusUpdate(
                            sync_status='in_progress',
                            sync_progress=progress.events_processed,
                            results_count=progress.results_imported
                        )
                    )
            
            # Clear temporary data to free memory
            del workout_results_to_insert
            del splits_map
        
        progress.results_skipped = total_skipped
        logger.info(f"Phase 2 complete: Inserted {len(all_inserted_records)} results, skipped {total_skipped}")
        
        return all_inserted_records
    
    async def _fetch_and_insert_splits(
        self,
        new_results_needing_splits: List[Dict],
        inserted_by_sr_id: Dict[str, str],
        external_link_id: str
    ) -> int:
        """
        Phase 3: Fetch and insert splits for >50m results (STREAMING - micro-batches)
        
        Args:
            new_results_needing_splits: List of results needing splits
            inserted_by_sr_id: Map of swimrankings_result_id to workout_result_id
            external_link_id: swimmer_external_links table ID
            
        Returns:
            Number of results with splits inserted
        """
        logger.info(f"Phase 3: Fetching splits for {len(new_results_needing_splits)} results (streaming mode)...")
        
        # Track total splits inserted
        total_splits_inserted = 0
        
        # Process in SMALL batches with immediate inserts
        batch_size = 5  # Reduced from 10 to minimize impact of slow requests
        
        for i in range(0, len(new_results_needing_splits), batch_size):
            # Check for cancellation at batch boundaries
            if await self._check_cancellation(external_link_id):
                logger.info("Sync cancelled during splits fetch")
                break
            
            batch = new_results_needing_splits[i:i + batch_size]
            batch_num = i//batch_size + 1
            total_batches = (len(new_results_needing_splits) + batch_size - 1)//batch_size
            
            logger.info(f"  Batch {batch_num}/{total_batches}: Fetching {len(batch)} results concurrently...")
            
            # Fetch splits with limited concurrency
            semaphore = asyncio.Semaphore(WorkerConfig.MAX_WORKERS)
            
            async def fetch_single_split(batch_idx: int, split_info: Dict) -> Optional[Dict]:
                """Fetch splits for a single result with semaphore limiting concurrency"""
                sr_result_id = split_info['sr_result_id']
                swimrankings_result_id = split_info['swimrankings_result_id']
                event_data = split_info['event_data']
                
                # Get the workout_result ID
                workout_result_id = split_info.get('workout_result_id') or inserted_by_sr_id.get(swimrankings_result_id)
                
                if not workout_result_id:
                    logger.warning(f"No workout_result_id found for swimrankings_result_id={swimrankings_result_id}")
                    return None
                
                async with semaphore:
                    # Retry logic built into _fetch_splits_with_id
                    split_result = await self._fetch_splits_with_id(sr_result_id, workout_result_id)
                    
                    if isinstance(split_result, Exception):
                        logger.error(f"    [{batch_idx + 1}/{len(batch)}] Error fetching splits: {split_result}")
                        return None
                    
                    # Log the result
                    if split_result and isinstance(split_result, dict):
                        if split_result.get('splits'):
                            logger.info(
                                f"    [{batch_idx + 1}/{len(batch)}] ✓ Got {len(split_result['splits'])} splits for "
                                f"{event_data['distance']}m {event_data['stroke_name']}"
                            )
                        elif split_result.get('has_splits_available') is False:
                            logger.debug(
                                f"    [{batch_idx + 1}/{len(batch)}] - No splits available for "
                                f"{event_data['distance']}m {event_data['stroke_name']}"
                            )
                    
                    return split_result
            
            # Create all tasks at once and execute concurrently (limited by semaphore)
            tasks = [fetch_single_split(idx, split_info) for idx, split_info in enumerate(batch)]
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Collect splits for immediate insertion
            splits_to_insert = {}
            results_without_splits = []
            
            for split_result in batch_results:
                # Skip exceptions (already logged and retried inside fetch_single_split)
                if isinstance(split_result, Exception):
                    logger.warning(f"    Unexpected exception in split fetch: {split_result}")
                    continue
                    
                if split_result and isinstance(split_result, dict):
                    workout_result_id = split_result['workout_result_id']
                    
                    if split_result.get('splits'):
                        splits_to_insert[workout_result_id] = split_result['splits']
                    elif split_result.get('has_splits_available') is False:
                        results_without_splits.append(workout_result_id)
            
            # INSERT IMMEDIATELY after each batch
            if splits_to_insert:
                logger.info(f"    ✅ Inserting splits for {len(splits_to_insert)} results...")
                self.db.bulk_insert_splits_for_multiple_results(splits_to_insert)
                total_splits_inserted += len(splits_to_insert)
                logger.info(f"    Total splits inserted so far: {total_splits_inserted}")
            
            # Mark results without splits immediately
            if results_without_splits:
                logger.info(f"    Marking {len(results_without_splits)} results as having no splits")
                self.db.mark_results_without_splits(results_without_splits)
            
            # CLEAR MEMORY after each batch
            del splits_to_insert
            del results_without_splits
            del batch_results
            del tasks
        
        logger.info(f"Phase 3 complete: Processed splits for {len(new_results_needing_splits)} results, inserted {total_splits_inserted}")
        return total_splits_inserted
    
    def _finalize_sync(
        self,
        external_link_id: str,
        progress: SyncProgress,
        result: SyncResult
    ) -> None:
        """
        Finalize sync by updating status and setting result statistics
        
        Args:
            external_link_id: swimmer_external_links table ID
            progress: Progress tracker
            result: Result object to populate
        """
        # Check final status before marking as completed
        final_status = self.db.check_sync_status(external_link_id)
        
        if not final_status or final_status == 'cancelled':
            logger.info("Sync was cancelled")
            result.success = False
            self.db.update_sync_status(
                external_link_id,
                SyncStatusUpdate(
                    sync_status='cancelled',
                    last_sync_completed_at=datetime.utcnow().isoformat()
                )
            )
        else:
            # STEP 6: Batch deduplication at end of sync (replaces 100+ RPC calls during sync)
            # This significantly reduces network overhead for syncs with many results
            logger.info(f"Phase 3: Batch deduplication for swimmer {result.swimmer_id}")
            try:
                deleted_count = self.db.deduplicate_swimmer_results(result.swimmer_id)
                if deleted_count > 0:
                    logger.info(f"  Removed {deleted_count} duplicate results (1 RPC call instead of per-insert)")
                else:
                    logger.debug(f"  No duplicates found to remove")
            except Exception as e:
                logger.warning(f"  Could not deduplicate results: {e}")
            
            # Mark as completed
            result.success = True
            self.db.update_sync_status(
                external_link_id,
                SyncStatusUpdate(
                    sync_status='completed',
                    last_sync_completed_at=datetime.utcnow().isoformat(),
                    results_count=progress.results_imported,
                    sync_error=None
                )
            )
        
        # Set final statistics
        result.events_processed = progress.events_processed
        result.results_imported = progress.results_imported
        result.results_skipped = progress.results_skipped
        result.errors = progress.errors
        
        logger.info(
            f"Completed sync: "
            f"{result.results_imported} imported, {result.results_skipped} skipped, "
            f"{result.errors} errors"
        )
    
    async def _check_cancellation(self, external_link_id: str) -> bool:
        """Check if sync was cancelled"""
        status = self.db.check_sync_status(external_link_id)
        return status is None or status == 'cancelled'
    
    async def _fetch_splits_with_id(
        self, 
        sr_result_id: str, 
        workout_result_id: str
    ) -> Optional[dict]:
        """
        Fetch splits for a result and return with workout_result_id
        
        Args:
            sr_result_id: SwimRankings result ID
            workout_result_id: Database workout_result ID
            
        Returns:
            Dictionary with workout_result_id and splits, or None if fetch fails
        """
        try:
            splits_data = await self.scraper._fetch_splits(sr_result_id)
            
            if splits_data and splits_data.get('splits'):
                return {
                    'workout_result_id': workout_result_id,
                    'splits': splits_data['splits'],
                    'reaction_time': splits_data.get('reaction_time'),
                    'has_splits_available': True
                }
            
            # Mark as no splits available if fetch succeeded but no splits found
            return {
                'workout_result_id': workout_result_id,
                'splits': None,
                'has_splits_available': False
            }
            
        except Exception as e:
            logger.error(f"Error fetching splits for {sr_result_id}: {e}")
            return None
    
    def _convert_time_to_interval(self, time_str: str) -> str:
        """Convert time string to PostgreSQL interval format"""
        time_parts = time_str.split(':')
        if len(time_parts) == 2:
            minutes, seconds = time_parts
            return f"00:{minutes.zfill(2)}:{seconds.zfill(5)}"
        elif len(time_parts) == 3:
            return ':'.join(time_parts)
        else:
            return f"00:00:{time_parts[0].zfill(5)}"
    
    def _parse_date(self, date_str: str) -> Optional[str]:
        """Parse date string to YYYY-MM-DD format"""
        if not date_str or not date_str.strip():
            return None
        
        date_str = date_str.strip().replace('\xa0', ' ')
        
        for fmt in ['%d/%m/%Y', '%d-%m-%Y', '%d.%m.%Y', '%Y-%m-%d', '%d %b %Y', '%d %B %Y']:
            try:
                parsed_date = datetime.strptime(date_str, fmt)
                return parsed_date.strftime('%Y-%m-%d')
            except ValueError:
                continue
        
        return None
    
    def _parse_location(self, location: str) -> tuple[Optional[str], Optional[str]]:
        """Parse location into city and nation"""
        if not location:
            return None, None
        
        if '(' in location:
            parts = location.split('(')
            city = parts[0].strip()
            nation = parts[1].replace(')', '').strip()
            return city, nation
        else:
            return location.strip() if location else None, None
