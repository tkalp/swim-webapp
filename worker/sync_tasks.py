"""
Celery tasks for SwimRankings data synchronization and training session auto-generation
"""

import asyncio
from datetime import datetime, timedelta
from typing import Optional
from celery import Task
import pytz

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


@celery_app.task(bind=True, name='worker.sync_tasks.auto_generate_sessions_task')
def auto_generate_sessions_task(self, days_ahead: int = 14, squad_id: Optional[str] = None) -> dict:
    """
    Celery task to automatically generate training sessions from schedules for all active squads
    
    This task:
    1. Queries all active training schedules (or for specific squad if provided)
    2. Uses UTC timestamps stored in start_time_utc and end_time_utc columns
    3. Groups schedules by squad
    4. Generates sessions for the next N days (default: 14)
    5. Uses upsert with ignoreDuplicates to avoid overwriting existing sessions
    
    Args:
        days_ahead: Number of days ahead to generate sessions (default: 14)
        squad_id: Optional squad ID to limit generation to specific squad (default: None for all)
    
    Returns:
        Dictionary with generation statistics
    """
    try:
        print("\n" + "=" * 100)
        print("🔄 AUTO-GENERATE SESSIONS TASK STARTED")
        print(f"   Days Ahead: {days_ahead}")
        if squad_id:
            print(f"   Limited to Squad: {squad_id}")
        print(f"   Started At: {datetime.utcnow().isoformat()}")
        print("=" * 100)
        
        # Initialize Supabase client
        supabase = get_supabase_client()
        
        # Get active training schedules (no need to join squads for timezone anymore)
        query = supabase.table('training_schedules')\
            .select('*')\
            .eq('active', True)
        
        if squad_id:
            query = query.eq('squad_id', squad_id)
        
        response = query.execute()
        
        schedules = response.data
        
        if not schedules:
            print("ℹ️  No active training schedules found")
            return {
                'success': True,
                'squads_processed': 0,
                'sessions_generated': 0,
                'message': 'No active schedules found'
            }
        
        # Group schedules by squad_id
        squads_schedules = {}
        
        for schedule in schedules:
            squad_id_key = schedule['squad_id']
            
            if squad_id_key not in squads_schedules:
                squads_schedules[squad_id_key] = []
            
            squads_schedules[squad_id_key].append(schedule)
        
        total_sessions_generated = 0
        squads_processed = 0
        errors = []
        
        # Calculate date range in UTC
        now_utc = datetime.utcnow()
        start_date = now_utc.date()
        end_date = start_date + timedelta(days=days_ahead)
        
        # Process each squad
        for squad_id_key, squad_schedules in squads_schedules.items():
            try:
                print(f"\n📅 Processing Squad ID: {squad_id_key}")
                print(f"   Schedules Count: {len(squad_schedules)}")
                
                sessions_to_create = []
                
                # Generate sessions for each day in the range
                current_date = start_date
                while current_date <= end_date:
                    day_of_week = current_date.strftime('%A')
                    
                    # Find schedule(s) for this day
                    for schedule in squad_schedules:
                        if schedule['day_of_week'] == day_of_week:
                            # Use UTC time values if available, otherwise fall back to old format
                            if schedule.get('start_time_utc') and schedule.get('end_time_utc'):
                                # Parse UTC time string (format: "HH:MM:SS")
                                start_time_parts = schedule['start_time_utc'].split(':')
                                end_time_parts = schedule['end_time_utc'].split(':')
                                
                                # Create session datetime with current date + UTC time from schedule
                                utc_session_start = datetime(
                                    current_date.year,
                                    current_date.month,
                                    current_date.day,
                                    int(start_time_parts[0]),
                                    int(start_time_parts[1]),
                                    0,
                                    tzinfo=pytz.UTC
                                )
                                
                                utc_session_end = datetime(
                                    current_date.year,
                                    current_date.month,
                                    current_date.day,
                                    int(end_time_parts[0]),
                                    int(end_time_parts[1]),
                                    0,
                                    tzinfo=pytz.UTC
                                )
                            else:
                                # Fallback: use old start_time/end_time format (will be removed after migration)
                                # Assume times are in UTC for backward compatibility
                                start_time_parts = schedule['start_time'].split(':')
                                end_time_parts = schedule['end_time'].split(':')
                                
                                utc_session_start = datetime(
                                    current_date.year,
                                    current_date.month,
                                    current_date.day,
                                    int(start_time_parts[0]),
                                    int(start_time_parts[1]),
                                    0,
                                    tzinfo=pytz.UTC
                                )
                                
                                utc_session_end = datetime(
                                    current_date.year,
                                    current_date.month,
                                    current_date.day,
                                    int(end_time_parts[0]),
                                    int(end_time_parts[1]),
                                    0,
                                    tzinfo=pytz.UTC
                                )
                            
                            sessions_to_create.append({
                                'squad_id': squad_id_key,
                                'start_date': utc_session_start.isoformat(),
                                'end_date': utc_session_end.isoformat(),
                                'workout_id': None,
                                'training_type': schedule['training_type']
                            })
                    
                    current_date += timedelta(days=1)
                
                # Upsert sessions (will ignore duplicates based on squad_id, start_date unique constraint)
                if sessions_to_create:
                    result = supabase.table('training_sessions')\
                        .upsert(
                            sessions_to_create,
                            on_conflict='squad_id,start_date',
                            ignore_duplicates=True
                        )\
                        .execute()
                    
                    # Count actual insertions (note: Supabase may not return inserted count with ignoreDuplicates)
                    sessions_count = len(sessions_to_create)
                    total_sessions_generated += sessions_count
                    
                    print(f"   ✅ Generated {sessions_count} session(s)")
                else:
                    print(f"   ℹ️  No sessions to generate for this squad")
                
                squads_processed += 1
                
            except Exception as squad_error:
                error_msg = f"Squad {squad_id_key}: {str(squad_error)}"
                errors.append(error_msg)
                print(f"   ❌ Error: {squad_error}")
        
        # Final summary
        print("\n" + "=" * 100)
        print("✅ AUTO-GENERATE SESSIONS TASK COMPLETED")
        print(f"   Squads Processed: {squads_processed}/{len(squads_schedules)}")
        print(f"   Sessions Generated: {total_sessions_generated}")
        print(f"   Errors: {len(errors)}")
        print(f"   Completed At: {datetime.utcnow().isoformat()}")
        print("=" * 100 + "\n")
        
        return {
            'success': len(errors) == 0,
            'squads_processed': squads_processed,
            'total_squads': len(squads_schedules),
            'sessions_generated': total_sessions_generated,
            'errors': errors,
            'days_ahead': days_ahead,
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat()
        }
        
    except Exception as e:
        error_msg = f"Task failed: {str(e)}"
        print("\n" + "=" * 100)
        print("❌ AUTO-GENERATE SESSIONS TASK FAILED")
        print(f"   Error: {error_msg}")
        print("=" * 100 + "\n")
        
        return {
            'success': False,
            'error': error_msg,
            'squads_processed': 0,
            'sessions_generated': 0
        }
