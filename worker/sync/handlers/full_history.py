"""
Handler for FULL_HISTORY sync mode (events with fresh data)
Skips events entirely - no action needed
"""

import logging
from typing import List, Dict, Optional, Any
from worker.models import WorkoutResult

logger = logging.getLogger('full_history_handler')


class FullHistorySyncHandler:
    """
    Handler for FULL_HISTORY mode: events with fresh data
    
    Strategy:
    - Do nothing (data is current)
    - Skip event entirely
    - Return empty results
    """
    
    async def skip_events(
        self,
        event_names: List[str],
        progress: Optional[Dict] = None
    ) -> List[WorkoutResult]:
        """
        Skip events (full history - data is fresh)
        
        Args:
            event_names: List of events being skipped
            progress: Progress dict to update (optional)
            
        Returns:
            Empty list (no results to insert)
        """
        logger.info(f"FULL_HISTORY mode: skipping {len(event_names)} events (data is fresh)")
        
        if progress:
            progress['events_processed'] = progress.get('events_processed', 0) + len(event_names)
            # Don't increment results_imported - we're not importing anything
        
        # No action needed - return empty
        return []
