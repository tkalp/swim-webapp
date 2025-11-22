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
from worker.services.bulk_sync_service import BulkSyncService
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


@celery_app.task(bind=True, name='worker.sync_tasks.bulk_sync_all_swimmers_task')
def bulk_sync_all_swimmers_task(
    self,
    triggered_by_user_id: str,
    force_update: bool = False
) -> dict:
    """
    Celery task to sync all SwimRankings swimmers in bulk
    
    Args:
        triggered_by_user_id: Admin user ID who triggered the sync
        force_update: If True, bypass freshness check and sync all data
    
    Returns:
        Dictionary with job_id and summary
    """
    try:
        # Initialize services
        supabase = get_supabase_client()
        bulk_sync_service = BulkSyncService(supabase)
        
        # Get all swimmer external links
        swimmer_links = bulk_sync_service.get_all_swimrankings_links()
        total_swimmers = len(swimmer_links)
        
        if total_swimmers == 0:
            return {
                'success': False,
                'error': 'No swimmers found with SwimRankings links'
            }
        
        # Create bulk sync job
        job_id = bulk_sync_service.create_bulk_sync_job(
            triggered_by_user_id=triggered_by_user_id,
            total_swimmers=total_swimmers
        )
        
        # Update status to in_progress
        bulk_sync_service.update_job_status(job_id, 'in_progress')
        
        # Initialize sync services once
        db_service = DatabaseService(supabase)
        scraper = SwimRankingsScraper()
        sync_service = SwimmerSyncService(db_service, scraper)
        
        # Sync swimmers sequentially (concurrency=1 anyway)
        for link in swimmer_links:
            swimmer_id = link['swimmer_id']
            external_link_id = link['id']
            external_id = link['external_id']
            
            # Get swimmer name for logging
            swimmer_name = f"{link['swimmers']['first_name']} {link['swimmers']['last_name']}"
            
            try:
                # Sync swimmer directly
                sync_result = asyncio.run(sync_service.sync_swimmer(
                    swimmer_id=swimmer_id,
                    external_link_id=external_link_id,
                    external_id=external_id,
                    limit_events=None
                ))
                
                succeeded = sync_result.success
                
                # Log result
                if succeeded:
                    print("=" * 100)
                    print(f"✅ BULK SYNC SUCCESS - SWIMMER: {swimmer_name}")
                    print(f"   Job ID: {job_id}")
                    print(f"   Events Processed: {sync_result.events_processed}")
                    print(f"   Results Imported: {sync_result.results_imported}")
                    print("=" * 100)
                else:
                    error_message = sync_result.error_message or 'Unknown error'
                    print("=" * 100)
                    print(f"❌ BULK SYNC FAILURE - SWIMMER: {swimmer_name}")
                    print(f"   Job ID: {job_id}")
                    print(f"   Swimmer ID: {swimmer_id}")
                    print(f"   Error: {error_message}")
                    print("=" * 100)
                    
                    bulk_sync_service.record_failure(
                        job_id=job_id,
                        swimmer_id=swimmer_id,
                        external_link_id=external_link_id,
                        swimmer_name=swimmer_name,
                        error_message=error_message
                    )
                
                # Increment progress
                bulk_sync_service.increment_job_progress(job_id, succeeded=succeeded)
                
            except Exception as e:
                # Record failure
                error_msg = f"Exception during sync: {str(e)}"
                print("=" * 100)
                print(f"❌ BULK SYNC FAILURE - SWIMMER: {swimmer_name}")
                print(f"   Job ID: {job_id}")
                print(f"   Swimmer ID: {swimmer_id}")
                print(f"   Error: {error_msg}")
                print("=" * 100)
                
                bulk_sync_service.record_failure(
                    job_id=job_id,
                    swimmer_id=swimmer_id,
                    external_link_id=external_link_id,
                    swimmer_name=swimmer_name,
                    error_message=error_msg
                )
                bulk_sync_service.increment_job_progress(job_id, succeeded=False)
        
        # Mark job as completed
        bulk_sync_service.update_job_status(job_id, 'completed')
        
        # Get final stats
        job_status = bulk_sync_service.get_job_status(job_id)
        succeeded_count = job_status['swimmers_succeeded'] if job_status else 0
        failed_count = job_status['swimmers_failed'] if job_status else 0
        
        print("\n" + "=" * 100)
        print("🎉 BULK SYNC JOB COMPLETED")
        print(f"   Job ID: {job_id}")
        print(f"   Total Swimmers: {total_swimmers}")
        print(f"   ✅ Succeeded: {succeeded_count}")
        print(f"   ❌ Failed: {failed_count}")
        print("=" * 100 + "\n")
        
        return {
            'success': True,
            'job_id': job_id,
            'total_swimmers': total_swimmers,
            'message': f'Bulk sync job {job_id} started for {total_swimmers} swimmers'
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': f'Failed to start bulk sync: {str(e)}'
        }


@celery_app.task(name='worker.sync_tasks.update_bulk_sync_progress')
def update_bulk_sync_progress(
    sync_result: dict,
    job_id: str,
    swimmer_id: str,
    external_link_id: str,
    swimmer_name: str
) -> None:
    """
    Callback task to update bulk sync progress after individual swimmer sync
    
    Args:
        sync_result: Result from sync_swimmer_task
        job_id: Bulk sync job ID
        swimmer_id: Swimmer ID
        external_link_id: External link ID
        swimmer_name: Swimmer's full name
    """
    try:
        supabase = get_supabase_client()
        bulk_sync_service = BulkSyncService(supabase)
        
        succeeded = sync_result.get('success', False)
        
        # Increment progress
        bulk_sync_service.increment_job_progress(job_id, succeeded=succeeded)
        
        # Record failure if sync failed
        if not succeeded:
            error_message = sync_result.get('error_message', 'Unknown error')
            print("=" * 100)
            print(f"❌ BULK SYNC FAILURE - SWIMMER: {swimmer_name}")
            print(f"   Job ID: {job_id}")
            print(f"   Swimmer ID: {swimmer_id}")
            print(f"   Error: {error_message}")
            print("=" * 100)
            
            bulk_sync_service.record_failure(
                job_id=job_id,
                swimmer_id=swimmer_id,
                external_link_id=external_link_id,
                swimmer_name=swimmer_name,
                error_message=error_message
            )
        else:
            # Log success
            results_imported = sync_result.get('results_imported', 0)
            events_processed = sync_result.get('events_processed', 0)
            print("=" * 100)
            print(f"✅ BULK SYNC SUCCESS - SWIMMER: {swimmer_name}")
            print(f"   Job ID: {job_id}")
            print(f"   Events Processed: {events_processed}")
            print(f"   Results Imported: {results_imported}")
            print("=" * 100)
        
        # Check if all swimmers have been processed
        job_status = bulk_sync_service.get_job_status(job_id)
        if job_status and job_status['swimmers_processed'] >= job_status['total_swimmers']:
            # All swimmers processed - mark job as completed
            bulk_sync_service.update_job_status(job_id, 'completed')
            
            total = job_status['total_swimmers']
            succeeded_count = job_status['swimmers_succeeded']
            failed_count = job_status['swimmers_failed']
            
            print("\n" + "=" * 100)
            print("🎉 BULK SYNC JOB COMPLETED")
            print(f"   Job ID: {job_id}")
            print(f"   Total Swimmers: {total}")
            print(f"   ✅ Succeeded: {succeeded_count}")
            print(f"   ❌ Failed: {failed_count}")
            print("=" * 100 + "\n")
            
    except Exception as e:
        print("=" * 100)
        print(f"❌ BULK SYNC PROGRESS UPDATE FAILED")
        print(f"   Job ID: {job_id}")
        print(f"   Swimmer: {swimmer_name}")
        print(f"   Error: {e}")
        print("=" * 100)

