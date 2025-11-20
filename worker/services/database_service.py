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
        swimrankings_result_ids: List[str]
    ) -> Dict[str, str]:
        """
        Check which results already exist in database
        
        Args:
            swimrankings_result_ids: List of SwimRankings result IDs to check
            
        Returns:
            Dictionary mapping swimrankings_result_id to database id
        """
        if not swimrankings_result_ids:
            return {}
        
        result = self.supabase.table('workout_result').select(
            'id, swimrankings_result_id'
        ).in_('swimrankings_result_id', swimrankings_result_ids).execute()
        
        if not result.data:
            return {}
        
        return {
            row['swimrankings_result_id']: row['id'] 
            for row in result.data
        }
    
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
