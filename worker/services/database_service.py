"""
Database service for worker operations
Handles all Supabase interactions
"""

from typing import List, Dict, Optional, Tuple, Any
from datetime import datetime
from supabase import Client

from worker.models import (
    SyncStatusUpdate, 
    WorkoutResult, 
    RaceSplit,
    SyncStatus
)


class DatabaseService:
    """Service for database operations"""
    
    def __init__(self, supabase_client: Client):
        self.supabase = supabase_client
    
    def update_sync_status(
        self, 
        external_link_id: str, 
        status_update: SyncStatusUpdate
    ) -> None:
        """
        Update sync status in swimmer_external_links table
        
        Args:
            external_link_id: ID of the swimmer external link
            status_update: Status update data
        """
        update_data = {}
        
        if status_update.sync_status:
            update_data['sync_status'] = status_update.sync_status
        if status_update.last_sync_started_at:
            update_data['last_sync_started_at'] = status_update.last_sync_started_at
        if status_update.last_sync_completed_at:
            update_data['last_sync_completed_at'] = status_update.last_sync_completed_at
        if status_update.sync_error is not None:
            update_data['sync_error'] = status_update.sync_error
        if status_update.sync_progress is not None:
            update_data['sync_progress'] = status_update.sync_progress
        if status_update.sync_total is not None:
            update_data['sync_total'] = status_update.sync_total
        if status_update.results_count is not None:
            update_data['results_count'] = status_update.results_count
        
        if update_data:
            self.supabase.table('swimmer_external_links').update(
                update_data
            ).eq('id', external_link_id).execute()
    
    def check_sync_status(self, external_link_id: str) -> Optional[SyncStatus]:
        """
        Check current sync status
        
        Args:
            external_link_id: ID of the swimmer external link
            
        Returns:
            Current sync status or None if not found
        """
        result = self.supabase.table('swimmer_external_links').select(
            'sync_status'
        ).eq('id', external_link_id).maybe_single().execute()
        
        if not result.data:
            return None
        
        return result.data.get('sync_status')
    
    def check_existing_results(
        self, 
        swimrankings_result_ids: List[str],
        chunk_size: int = 50
    ) -> Dict[str, str]:
        """
        Check which results already exist in database
        
        Args:
            swimrankings_result_ids: List of SwimRankings result IDs to check
            chunk_size: Number of IDs to check per query (to avoid URL length limits)
            
        Returns:
            Dictionary mapping swimrankings_result_id to database id
        """
        if not swimrankings_result_ids:
            return {}
        
        existing = {}
        
        # Process in chunks to avoid URL length limits
        for i in range(0, len(swimrankings_result_ids), chunk_size):
            chunk = swimrankings_result_ids[i:i + chunk_size]
            result = self.supabase.table('workout_result').select(
                'id, swimrankings_result_id'
            ).in_('swimrankings_result_id', chunk).execute()
            
            if result.data:
                for row in result.data:
                    existing[row['swimrankings_result_id']] = row['id']
        
        return existing
    
    def get_swimmer_all_event_keys(self, swimmer_id: str) -> set:
        """
        Get all event keys for swimmer's existing results (no time filter)
        Used to determine which events are missing vs stale
        
        Args:
            swimmer_id: Database swimmer ID
            
        Returns:
            Set of event keys in database (distance_stroke_course format)
        """
        # Lightweight query - only need event identifiers
        result = self.supabase.table('workout_result').select(
            'distance, stroke, result_units'
        ).eq('swimmer_id', swimmer_id).eq(
            'activity', 'swim'
        ).not_.is_(
            'swimrankings_result_id', 'null'
        ).execute()
        
        if not result.data:
            return set()
        
        # Build set of unique event keys
        event_keys = set()
        for row in result.data:
            event_key = f"{row['distance']}_{row['stroke']}_{row['result_units']}"
            event_keys.add(event_key)
        
        return event_keys
    
    def get_swimmer_recent_results(
        self,
        swimmer_id: str,
        hours: int = 48
    ) -> Tuple[Dict[str, Dict[str, Any]], set, set]:
        """
        Get swimmer's results OUTSIDE the freshness window (older than X hours)
        These are "stale" results that should be skipped during sync
        Optimized to use bulk queries instead of N+1 pattern
        
        Args:
            swimmer_id: Database swimmer ID
            hours: Time window in hours (default 48) - results OLDER than this are returned
            
        Returns:
            Tuple of:
            - Dictionary mapping swimrankings_result_id to result metadata
            - Set of stale event keys (distance_stroke_course format)
            - Set of all event keys in database (for detecting missing events)
        """
        from datetime import datetime, timedelta
        
        cutoff_time = (datetime.utcnow() - timedelta(hours=hours)).isoformat()
        
        # Get swim results OLDER than cutoff (outside freshness window = stale)
        result = self.supabase.table('workout_result').select(
            'id, swimrankings_result_id, created_at, distance, stroke, result_units'
        ).eq('swimmer_id', swimmer_id).eq(
            'activity', 'swim'
        ).not_.is_(
            'swimrankings_result_id', 'null'
        ).lt('created_at', cutoff_time).execute()

        print("Fetched stale results: ", len(result.data) if result.data else 0)
        
        # Get all event keys for this swimmer (to detect missing events)
        all_event_keys = self.get_swimmer_all_event_keys(swimmer_id)
        
        if not result.data:
            return {}, set(), all_event_keys
        
        # Extract all workout_result_ids for bulk split check
        workout_result_ids = [row['id'] for row in result.data]
        
        # Bulk check which results have splits - batch to avoid URL length limits
        # Supabase API has URL length limits (~8KB), so we batch large ID lists
        BATCH_SIZE = 100  # Conservative batch size to stay well under URL limits
        ids_with_splits = set()
        
        for i in range(0, len(workout_result_ids), BATCH_SIZE):
            batch_ids = workout_result_ids[i:i + BATCH_SIZE]
            splits_result = self.supabase.table('race_splits').select(
                'workout_result_id'
            ).in_('workout_result_id', batch_ids).execute()
            
            # Add this batch's results to the set
            if splits_result.data:
                ids_with_splits.update(row['workout_result_id'] for row in splits_result.data)
        
        # Build final map and stale event keys
        recent_results = {}
        stale_event_keys = set()
        
        for row in result.data:
            sr_id = row['swimrankings_result_id']
            workout_result_id = row['id']
            
            recent_results[sr_id] = {
                'id': workout_result_id,
                'created_at': row['created_at'],
                'has_splits': workout_result_id in ids_with_splits,
                'distance': row['distance'],
                'stroke': row['stroke'],
                'result_units': row['result_units']
            }
            
            # Build event key: distance_stroke_course (e.g., "100_free_LCM")
            event_key = f"{row['distance']}_{row['stroke']}_{row['result_units']}"
            stale_event_keys.add(event_key)
        
        return recent_results, stale_event_keys, all_event_keys
    
    def get_existing_result_count(
        self, 
        swimmer_id: str, 
        distance: int, 
        stroke: str
    ) -> int:
        """
        Get count of existing results for a specific event
        
        Args:
            swimmer_id: Swimmer ID
            distance: Race distance
            stroke: Stroke type
            
        Returns:
            Count of existing results
        """
        result = self.supabase.table('workout_result').select(
            'id'
        ).eq('swimmer_id', swimmer_id).eq(
            'distance', distance
        ).eq('stroke', stroke).eq('source', 'swimrankings').execute()
        
        return len(result.data) if result.data else 0
    
    def bulk_insert_workout_results(
        self, 
        results: List[WorkoutResult]
    ) -> List[Any]:
        """
        Bulk insert workout results
        
        Args:
            results: List of WorkoutResult objects
            
        Returns:
            List of inserted records with IDs
        """
        if not results:
            return []
        
        # Convert dataclasses to dicts
        results_data = [
            {
                'swimmer_id': r.swimmer_id,
                'distance': r.distance,
                'stroke': r.stroke,
                'time_result': r.time_result,
                'result_units': r.result_units,
                'performed_on': r.performed_on,
                'meet_name': r.meet_name,
                'meet_city': r.meet_city,
                'meet_nation': r.meet_nation,
                'source': r.source,
                'swimrankings_result_id': r.swimrankings_result_id,
                'reaction_time': r.reaction_time,
                'activity': r.activity,
                'equipment': r.equipment
            }
            for r in results
        ]
        
        result = self.supabase.table('workout_result').insert(
            results_data
        ).execute()
        
        return result.data if result.data else []
    
    def bulk_insert_race_splits(
        self, 
        workout_result_id: str, 
        splits: List[RaceSplit]
    ) -> None:
        """
        Bulk insert race splits for a workout result
        
        Args:
            workout_result_id: ID of the workout result
            splits: List of RaceSplit objects
        """
        if not splits:
            return
        
        splits_data = [
            {
                'workout_result_id': workout_result_id,
                'split_distance': split.split_distance,
                'split_time': split.split_time,
                'cumulative_time': split.cumulative_time,
                'split_order': split.split_order
            }
            for split in splits
        ]
        
        self.supabase.table('race_splits').insert(
            splits_data
        ).execute()
    
    def bulk_insert_splits_for_multiple_results(
        self,
        splits_map: Dict[str, List[RaceSplit]]
    ) -> None:
        """
        Bulk insert splits for multiple workout results
        
        Args:
            splits_map: Dictionary mapping workout_result_id to list of splits
        """
        if not splits_map:
            return
        
        all_splits = []
        for workout_result_id, splits in splits_map.items():
            for split in splits:
                all_splits.append({
                    'workout_result_id': workout_result_id,
                    'split_distance': split.split_distance,
                    'split_time': split.split_time,
                    'cumulative_time': split.cumulative_time,
                    'split_order': split.split_order
                })
        
        if all_splits:
            self.supabase.table('race_splits').insert(
                all_splits
            ).execute()
    
    def update_stale_results_timestamp(
        self,
        workout_result_ids: List[str]
    ) -> None:
        """
        Update created_at timestamp for stale results to mark them as fresh
        
        Args:
            workout_result_ids: List of workout_result IDs to update
        """
        if not workout_result_ids:
            return
        
        # Update created_at to current time
        # Batch to avoid URL length limits
        BATCH_SIZE = 100
        for i in range(0, len(workout_result_ids), BATCH_SIZE):
            batch_ids = workout_result_ids[i:i + BATCH_SIZE]
            self.supabase.table('workout_result').update({
                'created_at': 'now()'
            }).in_('id', batch_ids).execute()
    
    def mark_results_without_splits(
        self,
        workout_result_ids: List[str]
    ) -> None:
        """
        Mark results as having no splits available on SwimRankings
        
        Args:
            workout_result_ids: List of workout_result IDs to mark
        """
        if not workout_result_ids:
            return
        
        # Update has_splits_available to false for these results
        # Batch to avoid URL length limits
        BATCH_SIZE = 100
        for i in range(0, len(workout_result_ids), BATCH_SIZE):
            batch_ids = workout_result_ids[i:i + BATCH_SIZE]
            self.supabase.table('workout_result').update({
                'has_splits_available': False
            }).in_('id', batch_ids).execute()
    
    def get_events_checked(self, external_link_id: str) -> Dict[str, str]:
        """
        Get events_checked map from swimmer_external_links
        
        Args:
            external_link_id: ID of the swimmer external link
            
        Returns:
            Dictionary mapping event keys to ISO 8601 timestamps
            Empty dict if not found or no events checked yet
        """
        result = self.supabase.table('swimmer_external_links').select(
            'events_checked'
        ).eq('id', external_link_id).maybe_single().execute()
        
        if not result.data or not result.data.get('events_checked'):
            return {}
        
        return result.data['events_checked']
    
    def update_events_checked(
        self,
        external_link_id: str,
        event_keys: List[str],
        timestamp: Optional[str] = None
    ) -> None:
        """
        Update events_checked map with new event check timestamps
        
        Args:
            external_link_id: ID of the swimmer external link
            event_keys: List of event keys that were checked
            timestamp: ISO 8601 timestamp (defaults to now)
        """
        if not event_keys:
            return
        
        # Use current time if no timestamp provided
        if timestamp is None:
            timestamp = datetime.utcnow().isoformat() + 'Z'
        
        # Build update map for the event keys
        updates = {key: timestamp for key in event_keys}
        
        # Get current events_checked
        current = self.get_events_checked(external_link_id)
        
        # Merge with updates (updates take precedence)
        current.update(updates)
        
        # Write back to database
        self.supabase.table('swimmer_external_links').update({
            'events_checked': current
        }).eq('id', external_link_id).execute()
