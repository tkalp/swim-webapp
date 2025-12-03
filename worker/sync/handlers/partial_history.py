"""
Handler for PARTIAL_HISTORY sync mode (events with stale results)
Fetches fresh attempts, filters out stale, and fetches missing splits
"""

import logging
from typing import List, Dict, Optional, Set, Tuple, Any
from worker.models import WorkoutResult, ResultWithSplits, SyncMode, RaceSplit
from worker.services.database_service import DatabaseService
from worker.scrapers.swimrankings_scraper import SwimRankingsScraper
from worker.constants import get_style_id, get_stroke_enum
from worker.sync.services.result_converter import ResultConverter

logger = logging.getLogger('partial_history_handler')


class PartialHistorySyncHandler:
    """
    Handler for PARTIAL_HISTORY mode: events with stale results
    
    Strategy:
    - Fetch fresh attempts from SwimRankings
    - Filter out results that are already in DB (stale)
    - Fetch splits for new results >50m
    - Also fetch missing splits for stale results >50m
    - Insert only new results
    """
    
    def __init__(
        self,
        db_service: DatabaseService,
        scraper: SwimRankingsScraper
    ):
        """
        Initialize handler
        
        Args:
            db_service: Database service
            scraper: SwimRankings scraper
        """
        self.db = db_service
        self.scraper = scraper
    
    async def sync_events(
        self,
        event_names: List[str],
        athlete_id: str,
        swimmer_id: str,
        external_link_id: str,
        stale_results: Dict[str, Dict[str, Any]],
        results_needing_splits: Dict[str, str],
        progress: Optional[Dict] = None,
        event_course_modes: Optional[Dict[str, Dict[str, Any]]] = None
    ) -> Tuple[List[WorkoutResult], List[str], Dict[str, List]]:
        """
        Sync all events in PARTIAL_HISTORY mode
        
        Args:
            event_names: List of events to sync
            athlete_id: SwimRankings athlete ID
            swimmer_id: Database swimmer ID
            external_link_id: External link ID
            stale_results: Dict of stale results (swimrankings_result_id → metadata)
            results_needing_splits: Dict of stale results needing splits
            progress: Progress dict to update (optional)
            event_course_modes: Dict mapping event_name → {'LCM': mode, 'SCM': mode}
                               Used to filter results to only sync courses that need updating
            
        Returns:
            Tuple of (new_results, stale_ids_to_update, splits_to_insert)
        """
        all_new_results = []
        stale_result_ids_to_update = []
        stale_splits_to_insert = {}
        
        # Extract stale result IDs for filtering
        stale_result_ids = set(stale_results.keys())
        
        logger.info(f"PARTIAL_HISTORY mode: syncing {len(event_names)} events with {len(stale_result_ids)} stale results")
        
        for event_name in event_names:
            try:
                # Get modes for this event's courses
                event_modes = event_course_modes.get(event_name, {}) if event_course_modes else {}
                lcm_mode = event_modes.get('LCM')
                scm_mode = event_modes.get('SCM')
                
                logger.debug(f"  Syncing {event_name} (partial history, LCM={lcm_mode}, SCM={scm_mode})...")
                
                style_id = get_style_id(event_name)
                if not style_id:
                    logger.warning(f"  {event_name}: Could not get style_id, skipping")
                    continue
                
                # Fetch ALL fresh attempts (no filtering yet)
                all_fresh_results = await self.scraper.fetch_event_attempts(
                    athlete_id=athlete_id,
                    style_id=style_id,
                    limit=None
                )
                
                if not all_fresh_results:
                    logger.debug(f"  {event_name}: No fresh results found")
                    continue
                
                # Filter by course first - only sync courses that need updating
                # CRITICAL: This prevents LCM results being inserted into SCM pool
                filtered_by_course = all_fresh_results
                if lcm_mode and scm_mode:
                    # Both courses tracked - include all (let stale filter handle it)
                    pass
                elif lcm_mode and lcm_mode != SyncMode.FULL_HISTORY:
                    # Only LCM needs updating
                    filtered_by_course = [r for r in all_fresh_results if ResultConverter.normalize_course(r.attempt.course) == 'LCM']
                    logger.debug(f"  {event_name}: Filtered to LCM only ({len(filtered_by_course)}/{len(all_fresh_results)})")
                elif scm_mode and scm_mode != SyncMode.FULL_HISTORY:
                    # Only SCM needs updating
                    filtered_by_course = [r for r in all_fresh_results if ResultConverter.normalize_course(r.attempt.course) == 'SCM']
                    logger.debug(f"  {event_name}: Filtered to SCM only ({len(filtered_by_course)}/{len(all_fresh_results)})")
                
                # Filter: keep only results NOT in stale set
                new_results = [
                    r for r in filtered_by_course
                    if r.attempt.result_id not in stale_result_ids
                ]
                
                logger.debug(
                    f"  {event_name}: {len(all_fresh_results)} fresh, "
                    f"{len(filtered_by_course)} after course filter, {len(new_results)} new"
                )
                
                # Convert new results to WorkoutResult and extract splits
                event_new_results, event_new_splits = self._convert_results(
                    new_results,
                    event_name,
                    swimmer_id
                )
                
                all_new_results.extend(event_new_results)
                stale_splits_to_insert.update(event_new_splits)
                
                # Mark stale results as fresh (will update timestamp later)
                for stale_sr_id in stale_result_ids:
                    if stale_sr_id in stale_results:
                        stale_result_ids_to_update.append(stale_results[stale_sr_id]['id'])
                
                if progress:
                    progress['events_processed'] = progress.get('events_processed', 0) + 1
                    progress['results_imported'] = progress.get('results_imported', 0) + len(event_new_results)
                    progress['results_skipped'] = progress.get('results_skipped', 0) + len(stale_result_ids)
                
                logger.info(f"  {event_name}: {len(event_new_results)} new results")
                
            except Exception as e:
                logger.error(f"  {event_name}: Error - {e}")
                if progress:
                    progress['errors'] = progress.get('errors', 0) + 1
        
        logger.info(
            f"PARTIAL_HISTORY mode complete: {len(all_new_results)} new results, "
            f"{len(stale_result_ids_to_update)} stale to update"
        )
        
        return all_new_results, stale_result_ids_to_update, stale_splits_to_insert
    
    @staticmethod
    def _convert_results(
        results_with_splits: List[ResultWithSplits],
        event_name: str,
        swimmer_id: str
    ) -> Tuple[List[WorkoutResult], Dict[str, List[RaceSplit]]]:
        """
        Convert ResultWithSplits to WorkoutResult objects and extract splits
        
        Args:
            results_with_splits: List of ResultWithSplits from scraper
            event_name: Event name for metadata
            swimmer_id: Swimmer ID
            
        Returns:
            Tuple of (List of WorkoutResult objects, Dict mapping swimrankings_result_id to splits)
        """
        # Parse event name to get distance and stroke
        # Handle both "200 Freestyle" and "200m Freestyle" formats
        # Also handle multi-word strokes like "Individual Medley"
        from worker.sync.services.result_converter import ResultConverter
        
        parts = event_name.split()
        try:
            distance_str = parts[0].rstrip('m')
            distance = int(distance_str)
        except (ValueError, IndexError):
            logger.warning(f"Could not parse distance from event: {event_name}")
            distance = 0
        stroke_name = ' '.join(parts[1:]) if len(parts) > 1 else 'Freestyle'
        stroke = get_stroke_enum(stroke_name)
        logger.debug(f"Parsed event '{event_name}': distance={distance}, stroke_name='{stroke_name}' -> enum='{stroke}'")
        
        workout_results = []
        splits_map = {}
        
        for result_with_splits in results_with_splits:
            attempt = result_with_splits.attempt
            result_units = ResultConverter.normalize_course(attempt.course)
            
            workout_result = WorkoutResult(
                swimmer_id=swimmer_id,
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
            
            workout_results.append(workout_result)
            
            # Capture splits if available
            if attempt.result_id and result_with_splits.splits:
                splits_map[attempt.result_id] = result_with_splits.splits
        
        return workout_results, splits_map
