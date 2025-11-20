"""
Celery tasks for SwimRankings data synchronization
"""

import asyncio
from datetime import datetime
from typing import Optional
from celery import Task

from worker.database import get_supabase_client
from worker.celery_app import celery_app
from worker.services.database_service import DatabaseService
from worker.services.sync_service import SwimmerSyncService
from worker.scrapers.swimrankings_scraper import SwimRankingsScraper
from worker.models import SyncStatusUpdate


class SyncTask(Task):
    """Custom task class with logging"""
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Handle task failure"""
        print(f"[SYNC TASK] Task {task_id} failed: {exc}")
        
        # Update database with failure status
        try:
            external_link_id = kwargs.get('external_link_id')
            if external_link_id:
                supabase = get_supabase_client()
                db_service = DatabaseService(supabase)
                error_msg = f"{type(exc).__name__}: {str(exc)}"
                
                db_service.update_sync_status(
                    external_link_id,
                    SyncStatusUpdate(
                        sync_status='failed',
                        last_sync_completed_at=datetime.utcnow().isoformat(),
                        sync_error=error_msg[:500]
                    )
                )
        except Exception as update_error:
            print(f"[SYNC TASK] Failed to update error status: {update_error}")


@celery_app.task(bind=True, base=SyncTask, name='worker.sync_tasks.sync_swimmer_task')
def sync_swimmer_task(
    self,
    swimmer_id: str,
    external_link_id: str,
    external_id: str,
    limit_events: Optional[int] = None
) -> dict:
    """
    Celery task to sync SwimRankings data for a single swimmer
    
    Args:
        swimmer_id: Database swimmer ID
        external_link_id: swimmer_external_links table ID
        external_id: SwimRankings athlete ID
        limit_events: Limit number of events to sync (None = all)
    
    Returns:
        Dictionary with sync statistics
    """
    # Initialize services
    supabase = get_supabase_client()
    db_service = DatabaseService(supabase)
    scraper = SwimRankingsScraper()
    sync_service = SwimmerSyncService(db_service, scraper)
    
    # Run the async sync function
    result = asyncio.run(sync_service.sync_swimmer(
        swimmer_id=swimmer_id,
        external_link_id=external_link_id,
        external_id=external_id,
        limit_events=limit_events
    ))
    
    # Convert SyncResult to dict for Celery
    return {
        'swimmer_id': result.swimmer_id,
        'external_link_id': result.external_link_id,
        'events_processed': result.events_processed,
        'results_imported': result.results_imported,
        'results_skipped': result.results_skipped,
        'errors': result.errors,
        'success': result.success,
        'error_message': result.error_message
    }
