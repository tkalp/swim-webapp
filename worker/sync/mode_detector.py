"""
Mode detection layer for determining which sync strategy to use per event
"""

import logging
from typing import Dict, List, Tuple, Any, Optional
from worker.models import SyncMode
from worker.services.database_service import DatabaseService
from worker.config import WorkerConfig

logger = logging.getLogger('mode_detector')


class SyncModeDetector:
    """
    Detects which sync mode (no history, partial, full) each event should use
    
    Modes:
    - NO_HISTORY: Event completely missing from DB, needs full sync
    - PARTIAL_HISTORY: Event has stale results, needs incremental sync
    - FULL_HISTORY: Event has fresh data within freshness window, skip
    """
    
    def __init__(self, db_service: DatabaseService):
        """
        Initialize mode detector
        
        Args:
            db_service: Database service for queries
        """
        self.db = db_service
    
    def detect_event_mode(
        self,
        event_key: str,
        swimmer_id: str,
        all_db_event_keys: set,
        cached_empty_events: set,
        stale_event_keys: set
    ) -> SyncMode:
        """
        Detect which mode an event falls into
        
        Args:
            event_key: Event key (e.g., "100_free_LCM")
            swimmer_id: Swimmer ID
            all_db_event_keys: Set of all event keys in database for this swimmer
            cached_empty_events: Set of cached event keys with no results
            stale_event_keys: Set of event keys with stale results
            
        Returns:
            SyncMode enum value
        """
        # If in database with fresh data (not in stale set) → full history
        if event_key in all_db_event_keys and event_key not in stale_event_keys:
            logger.debug(f"  Event {event_key}: FULL_HISTORY (fresh data in DB)")
            return SyncMode.FULL_HISTORY
        
        # If stale results exist for this event → partial history
        if event_key in stale_event_keys:
            logger.debug(f"  Event {event_key}: PARTIAL_HISTORY (stale results)")
            return SyncMode.PARTIAL_HISTORY
        
        # If cached as empty → already checked, no results exist anywhere
        if event_key in cached_empty_events:
            logger.debug(f"  Event {event_key}: NO_HISTORY (cached empty)")
            return SyncMode.NO_HISTORY
        
        # Not in database and not cached empty → no history
        if event_key not in all_db_event_keys:
            logger.debug(f"  Event {event_key}: NO_HISTORY (missing from DB)")
            return SyncMode.NO_HISTORY
        
        # Default to no history (safe fallback)
        logger.warning(f"  Event {event_key}: Defaulting to NO_HISTORY (unexpected state)")
        return SyncMode.NO_HISTORY
    
    def batch_detect_all_events(
        self,
        event_names: List[str],
        swimmer_id: str,
        force_update: bool = False
    ) -> Dict[str, SyncMode]:
        """
        Detect mode for multiple events at once (single DB query)
        
        Args:
            event_names: List of event names (e.g., ["100 Freestyle", "200 Freestyle"])
            swimmer_id: Swimmer ID
            force_update: If True, all events get NO_HISTORY mode (treat as missing)
            
        Returns:
            Dictionary mapping event_key to SyncMode
        """
        mode_map = {}
        
        if force_update:
            # Force update: treat all events as missing (fetch everything)
            logger.info("Force update enabled: treating all events as NO_HISTORY")
            for event_name in event_names:
                # Parse event into LCM/SCM keys
                lcm_key = self._parse_event_key(event_name, 'LCM')
                scm_key = self._parse_event_key(event_name, 'SCM')
                mode_map[lcm_key] = SyncMode.NO_HISTORY
                mode_map[scm_key] = SyncMode.NO_HISTORY
            return mode_map
        
        # Get all database info in one batch
        logger.info(f"Detecting sync modes for {len(event_names)} events...")
        all_db_event_keys = self.db.get_swimmer_all_event_keys(swimmer_id)
        
        # Get cached empty events (convert dict keys to set)
        # Note: get_events_checked expects external_link_id, not swimmer_id
        # For now, we'll skip cached empty events since we don't have external_link_id here
        cached_empty_events = set()
        
        # Get stale results info
        stale_results, stale_event_keys, _ = self.db.get_swimmer_recent_results(
            swimmer_id,
            hours=WorkerConfig.SYNC_FRESHNESS_HOURS
        )
        
        logger.info(f"  DB has {len(all_db_event_keys)} event keys total")
        logger.info(f"  {len(stale_event_keys)} event keys are stale")
        logger.info(f"  {len(cached_empty_events)} event keys cached as empty")
        
        # Detect mode for each event
        for event_name in event_names:
            lcm_key = self._parse_event_key(event_name, 'LCM')
            scm_key = self._parse_event_key(event_name, 'SCM')
            
            # Detect for both courses
            lcm_mode = self.detect_event_mode(
                lcm_key, swimmer_id, all_db_event_keys, cached_empty_events, stale_event_keys
            )
            scm_mode = self.detect_event_mode(
                scm_key, swimmer_id, all_db_event_keys, cached_empty_events, stale_event_keys
            )
            
            mode_map[lcm_key] = lcm_mode
            mode_map[scm_key] = scm_mode
        
        # Summary
        no_history_count = sum(1 for m in mode_map.values() if m == SyncMode.NO_HISTORY)
        partial_count = sum(1 for m in mode_map.values() if m == SyncMode.PARTIAL_HISTORY)
        full_count = sum(1 for m in mode_map.values() if m == SyncMode.FULL_HISTORY)
        
        logger.info(
            f"Mode summary: {no_history_count} NO_HISTORY, "
            f"{partial_count} PARTIAL_HISTORY, {full_count} FULL_HISTORY"
        )
        
        return mode_map
    
    @staticmethod
    def _parse_event_key(event_name: str, course: str) -> str:
        """
        Parse event name into event key for specific course
        
        Args:
            event_name: Event name (e.g., "100 Freestyle")
            course: Course type (LCM or SCM)
            
        Returns:
            Event key (e.g., "100_free_LCM")
        """
        # This is a simplified parser - the actual implementation
        # should use the constants.parse_event_key() if available
        # For now, create a placeholder that will be replaced
        from worker.constants import parse_event_key
        result = parse_event_key(event_name, course)
        # Handle None return from parse_event_key
        return result if result is not None else f"{event_name}_{course}"
