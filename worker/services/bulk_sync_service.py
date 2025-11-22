"""
Bulk sync service for orchestrating multi-swimmer synchronization
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from supabase import Client

logger = logging.getLogger('bulk_sync_service')


class BulkSyncService:
    """Service for managing bulk swimmer synchronization operations"""
    
    def __init__(self, supabase_client: Client):
        self.supabase = supabase_client
    
    def create_bulk_sync_job(self, triggered_by_user_id: str, total_swimmers: int) -> str:
        """
        Create a new bulk sync job record
        
        Args:
            triggered_by_user_id: ID of the admin user triggering the sync
            total_swimmers: Total number of swimmers to sync
            
        Returns:
            Job ID (UUID)
        """
        job_data = {
            'triggered_by': triggered_by_user_id,
            'status': 'pending',
            'total_swimmers': total_swimmers,
            'swimmers_processed': 0,
            'swimmers_succeeded': 0,
            'swimmers_failed': 0,
            'started_at': datetime.utcnow().isoformat()
        }
        
        result = self.supabase.table('bulk_sync_jobs').insert(job_data).execute()
        
        if not result.data or len(result.data) == 0:
            raise Exception(f"Failed to create bulk sync job - no data returned. Result: {result}")
        
        if 'id' not in result.data[0]:
            raise Exception(f"Failed to create bulk sync job - no ID in response. Data: {result.data[0]}")
        
        job_id = result.data[0]['id']
        logger.info(f"Created bulk sync job {job_id} for {total_swimmers} swimmers")
        
        return job_id
    
    def get_all_swimrankings_links(self) -> List[Dict[str, Any]]:
        """
        Get all swimmer external links for SwimRankings
        
        Returns:
            List of swimmer external link records with swimmer details
        """
        result = self.supabase.table('swimmer_external_links').select(
            'id, swimmer_id, external_id, swimmers(first_name, last_name)'
        ).eq('platform', 'swimrankings').execute()
        
        if not result.data:
            return []
        
        return result.data
    
    def update_job_status(self, job_id: str, status: str, error_message: Optional[str] = None) -> None:
        """
        Update bulk sync job status
        
        Args:
            job_id: Bulk sync job ID
            status: New status (pending, in_progress, completed, failed, cancelled)
            error_message: Optional error message if failed
        """
        update_data = {
            'status': status,
            'updated_at': datetime.utcnow().isoformat()
        }
        
        if error_message:
            update_data['error_message'] = error_message
        
        if status in ['completed', 'failed', 'cancelled']:
            update_data['completed_at'] = datetime.utcnow().isoformat()
        
        self.supabase.table('bulk_sync_jobs').update(
            update_data
        ).eq('id', job_id).execute()
        
        logger.info(f"Updated bulk sync job {job_id} status to {status}")
    
    def increment_job_progress(
        self, 
        job_id: str, 
        succeeded: bool = True
    ) -> None:
        """
        Increment job progress counters
        
        Args:
            job_id: Bulk sync job ID
            succeeded: Whether the sync succeeded or failed
        """
        # Get current job state
        result = self.supabase.table('bulk_sync_jobs').select(
            'swimmers_processed, swimmers_succeeded, swimmers_failed'
        ).eq('id', job_id).single().execute()
        
        if not result.data:
            logger.error(f"Bulk sync job {job_id} not found")
            return
        
        # Calculate new values
        new_processed = result.data['swimmers_processed'] + 1
        new_succeeded = result.data['swimmers_succeeded'] + (1 if succeeded else 0)
        new_failed = result.data['swimmers_failed'] + (0 if succeeded else 1)
        
        # Update job
        self.supabase.table('bulk_sync_jobs').update({
            'swimmers_processed': new_processed,
            'swimmers_succeeded': new_succeeded,
            'swimmers_failed': new_failed,
            'updated_at': datetime.utcnow().isoformat()
        }).eq('id', job_id).execute()
    
    def record_failure(
        self,
        job_id: str,
        swimmer_id: str,
        external_link_id: str,
        swimmer_name: str,
        error_message: str
    ) -> None:
        """
        Record a failed swimmer sync
        
        Args:
            job_id: Bulk sync job ID
            swimmer_id: Swimmer ID that failed
            external_link_id: External link ID
            swimmer_name: Swimmer's full name for display
            error_message: Error message/stack trace
        """
        failure_data = {
            'bulk_sync_job_id': job_id,
            'swimmer_id': swimmer_id,
            'external_link_id': external_link_id,
            'swimmer_name': swimmer_name,
            'error_message': error_message[:500]  # Truncate long errors
        }
        
        self.supabase.table('bulk_sync_failures').insert(failure_data).execute()
        
        logger.warning(f"Recorded failure for swimmer {swimmer_name} in job {job_id}")
    
    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Get bulk sync job details
        
        Args:
            job_id: Bulk sync job ID
            
        Returns:
            Job details including progress
        """
        result = self.supabase.table('bulk_sync_jobs').select('*').eq(
            'id', job_id
        ).maybe_single().execute()
        
        return result.data if result.data else None
    
    def get_job_failures(self, job_id: str) -> List[Dict[str, Any]]:
        """
        Get all failures for a bulk sync job
        
        Args:
            job_id: Bulk sync job ID
            
        Returns:
            List of failure records
        """
        result = self.supabase.table('bulk_sync_failures').select(
            '*'
        ).eq('bulk_sync_job_id', job_id).order('failed_at', desc=True).execute()
        
        return result.data if result.data else []
    
    def cancel_job(self, job_id: str) -> None:
        """
        Mark a bulk sync job as cancelled
        
        Args:
            job_id: Bulk sync job ID
        """
        self.update_job_status(job_id, 'cancelled')
        logger.info(f"Cancelled bulk sync job {job_id}")
    
    def get_recent_jobs(self, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Get recent bulk sync jobs
        
        Args:
            limit: Maximum number of jobs to return
            
        Returns:
            List of recent job records
        """
        result = self.supabase.table('bulk_sync_jobs').select(
            '*'
        ).order('created_at', desc=True).limit(limit).execute()
        
        return result.data if result.data else []
