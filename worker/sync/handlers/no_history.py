"""
Handler for NO_HISTORY sync mode (events with no database history)
Fetches ALL attempts from SwimRankings and inserts them
"""

import logging
from typing import List, Dict, Optional, Tuple, Any
from worker.models import WorkoutResult, ResultWithSplits, SyncMode, RaceSplit
from worker.services.database_service import DatabaseService
from worker.scrapers.swimrankings_scraper import SwimRankingsScraper
from worker.constants import get_style_id
from worker.sync.services.result_converter import ResultConverter

logger = logging.getLogger('no_history_handler')


class NoHistorySyncHandler:
    """
    Handler for NO_HISTORY mode: event completely missing from database
    
    Strategy:
    - Fetch ALL attempts from SwimRankings (no filtering)
    - Fetch splits for all attempts >50m
    - Insert all results directly (no stale filtering needed)
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
        progress: Optional[Dict] = None,
        event_course_modes: Optional[Dict[str, Dict[str, Any]]] = None
    ) -> Tuple[List[WorkoutResult], Dict[str, List[RaceSplit]]]:
        """
        Sync all events in NO_HISTORY mode
        
        Args:
            event_names: List of events to sync (e.g., ["100 Freestyle", "200 Freestyle"])
            athlete_id: SwimRankings athlete ID
            swimmer_id: Database swimmer ID
            external_link_id: External link ID for status updates
            progress: Progress dict to update (optional)
            event_course_modes: Dict mapping event_name → {'LCM': mode, 'SCM': mode}
                               Used to filter results to only sync courses that need updating
            
        Returns:
            List of WorkoutResult objects to insert
        """
        all_results = []
        all_splits_map = {}
        
        logger.info(f"NO_HISTORY mode: syncing {len(event_names)} events with no existing data")
        
        for event_name in event_names:
            try:
                # Get modes for this event's courses
                event_modes = event_course_modes.get(event_name, {}) if event_course_modes else {}
                lcm_mode = event_modes.get('LCM')
                scm_mode = event_modes.get('SCM')
                
                logger.debug(f"  Fetching {event_name} (no history, LCM={lcm_mode}, SCM={scm_mode})...")
                
                # Fetch event attempts (includes splits if available and >50m)
                style_id = get_style_id(event_name)
                if not style_id:
                    logger.warning(f"  {event_name}: Could not get style_id, skipping")
                    continue
                
                results_with_splits = await self.scraper.fetch_event_attempts(
                    athlete_id=athlete_id,
                    style_id=style_id,
                    limit=None  # Get all attempts
                )
                
                if not results_with_splits:
                    logger.debug(f"  {event_name}: No results found")
                    continue
                
                # Filter by course first - only sync courses that need updating
                # CRITICAL: This prevents LCM results being inserted into SCM pool
                filtered_by_course = results_with_splits
                if lcm_mode and scm_mode:
                    # Both courses tracked - include all
                    pass
                elif lcm_mode and lcm_mode == SyncMode.NO_HISTORY:
                    # Only LCM needs updating
                    filtered_by_course = [r for r in results_with_splits if ResultConverter.normalize_course(r.attempt.course) == 'LCM']
                    logger.debug(f"  {event_name}: Filtered to LCM only ({len(filtered_by_course)}/{len(results_with_splits)})")
                elif scm_mode and scm_mode == SyncMode.NO_HISTORY:
                    # Only SCM needs updating
                    filtered_by_course = [r for r in results_with_splits if ResultConverter.normalize_course(r.attempt.course) == 'SCM']
                    logger.debug(f"  {event_name}: Filtered to SCM only ({len(filtered_by_course)}/{len(results_with_splits)})")
                
                # Convert to WorkoutResult objects and collect splits
                event_results, event_splits = self._convert_results(
                    filtered_by_course,
                    event_name,
                    swimmer_id
                )
                
                all_results.extend(event_results)
                all_splits_map.update(event_splits)
                
                if progress:
                    progress['events_processed'] = progress.get('events_processed', 0) + 1
                    progress['results_imported'] = progress.get('results_imported', 0) + len(event_results)
                
                logger.info(f"  {event_name}: {len(event_results)} results")
                
            except Exception as e:
                logger.error(f"  {event_name}: Error - {e}")
                if progress:
                    progress['errors'] = progress.get('errors', 0) + 1
        
        logger.info(f"NO_HISTORY mode complete: {len(all_results)} total results")
        return all_results, all_splits_map
    
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
        from worker.constants import get_stroke_enum
        from worker.sync.services.result_converter import ResultConverter
        
        # Parse event name to get distance and stroke
        # Handle both "200 Freestyle" and "200m Freestyle" formats
        # Also handle multi-word strokes like "Individual Medley"
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
            
            # Determine course from attempt.course
            result_units = ResultConverter.normalize_course(attempt.course)  # "LCM" or "SCM"
            
            workout_result = WorkoutResult(
                swimmer_id=swimmer_id,
                distance=distance,
                stroke=stroke,  # type: ignore
                time_result=attempt.time,
                result_units=result_units,  # type: ignore
                performed_on=ResultConverter.parse_date(attempt.date),
                meet_name=attempt.meet_name,
                meet_city=attempt.location,
                meet_nation=None,  # Not available from scraper
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
