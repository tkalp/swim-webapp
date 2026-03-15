"""
Celery tasks for SwimRankings data synchronization and training session auto-generation
"""

import asyncio
import time
import random
import logging
from datetime import datetime, timedelta
from typing import Optional
from celery import Task
from sqlalchemy import text
import pytz

from worker.database import get_db
from worker.celery_app import celery_app
from worker.services.database_service import DatabaseService
from worker.services.bulk_sync_service import BulkSyncService
from worker.scrapers.swimrankings_scraper import SwimRankingsScraper
from worker.sync.orchestrator import SyncOrchestrator
from worker.models import SyncStatusUpdate

logger = logging.getLogger('sync_tasks')


class SyncTask(Task):
    """Custom task class with logging"""

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Handle task failure"""
        print(f"[SYNC TASK] Task {task_id} failed: {exc}")

        # Update database with failure status
        try:
            external_link_id = kwargs.get('external_link_id')
            if external_link_id:
                session = get_db()
                try:
                    db_service = DatabaseService(session)
                    error_msg = f"{type(exc).__name__}: {str(exc)}"

                    db_service.update_sync_status(
                        external_link_id,
                        SyncStatusUpdate(
                            sync_status='failed',
                            last_sync_completed_at=datetime.utcnow().isoformat(),
                            sync_error=error_msg[:500]
                        )
                    )
                finally:
                    session.close()
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
    Celery task to sync SwimRankings data for a single swimmer using 3-mode architecture

    Args:
        swimmer_id: Database swimmer ID
        external_link_id: swimmer_external_links table ID
        external_id: SwimRankings athlete ID
        limit_events: Limit number of events to sync (None = all)

    Returns:
        Dictionary with sync statistics
    """
    task_start = time.time()

    # Initialize services
    session = get_db()
    try:
        db_service = DatabaseService(session)
        scraper = SwimRankingsScraper()
        orchestrator = SyncOrchestrator(db_service, scraper)

        # Run the async sync function using new 3-mode architecture
        result = asyncio.run(orchestrator.sync_swimmer(
            swimmer_id=swimmer_id,
            external_link_id=external_link_id,
            external_id=external_id,
            limit_events=limit_events
        ))

        task_elapsed = time.time() - task_start
        logger.info(f"sync_swimmer_task completed in {task_elapsed:.2f}s for swimmer {swimmer_id}")

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
    finally:
        session.close()


@celery_app.task(bind=True, name='worker.sync_tasks.sync_squad_swimmers_task')
def sync_squad_swimmers_task(
    self,
    squad_id: str,
    triggered_by_user_id: str,
    job_id: Optional[str] = None,
) -> dict:
    """
    Celery task to sync SwimRankings data for all swimmers in a specific squad.

    Args:
        squad_id: Squad UUID
        triggered_by_user_id: Coach user ID who triggered the sync
        job_id: Pre-created BulkSyncJob ID (created by API endpoint for polling)

    Returns:
        Dictionary with job_id and summary
    """
    task_start = time.time()
    logger.info(f"Starting squad sync for squad {squad_id}")

    session = get_db()
    try:
        bulk_sync_service = BulkSyncService(session)
        swimmer_links = bulk_sync_service.get_squad_swimrankings_links(squad_id)
        total_swimmers = len(swimmer_links)

        if total_swimmers == 0:
            if job_id:
                bulk_sync_service.update_job_status(job_id, 'failed', error_message='No swimmers with SwimRankings links in this squad')
            return {
                'success': False,
                'error': 'No swimmers with SwimRankings links in this squad'
            }

        # Use pre-created job_id or create a new one
        if not job_id:
            job_id = bulk_sync_service.create_bulk_sync_job(
                triggered_by_user_id=triggered_by_user_id,
                total_swimmers=total_swimmers
            )
        bulk_sync_service.update_job_status(job_id, 'in_progress')

        db_service = DatabaseService(session)
        scraper = SwimRankingsScraper()
        orchestrator = SyncOrchestrator(db_service, scraper)

        for link in swimmer_links:
            swimmer_id = link['swimmer_id']
            external_link_id = link['id']
            external_id = link['external_id']
            swimmer_name = f"{link['first_name']} {link['last_name']}"

            try:
                sync_result = asyncio.run(orchestrator.sync_swimmer(
                    swimmer_id=swimmer_id,
                    external_link_id=external_link_id,
                    external_id=external_id,
                    limit_events=None
                ))

                succeeded = sync_result.success

                if succeeded:
                    logger.info(f"Squad sync success: {swimmer_name} (events={sync_result.events_processed}, results={sync_result.results_imported})")
                else:
                    error_message = sync_result.error_message or 'Unknown error'
                    logger.warning(f"Squad sync failure: {swimmer_name} - {error_message}")
                    bulk_sync_service.record_failure(
                        job_id=job_id,
                        swimmer_id=swimmer_id,
                        external_link_id=external_link_id,
                        swimmer_name=swimmer_name,
                        error_message=error_message
                    )

                bulk_sync_service.increment_job_progress(job_id, succeeded=succeeded)
                time.sleep(random.uniform(1.0, 2.0))

            except Exception as e:
                error_msg = f"Exception during sync: {str(e)}"
                logger.error(f"Squad sync exception: {swimmer_name} - {error_msg}")
                bulk_sync_service.record_failure(
                    job_id=job_id,
                    swimmer_id=swimmer_id,
                    external_link_id=external_link_id,
                    swimmer_name=swimmer_name,
                    error_message=error_msg
                )
                bulk_sync_service.increment_job_progress(job_id, succeeded=False)

        bulk_sync_service.update_job_status(job_id, 'completed')

        job_status = bulk_sync_service.get_job_status(job_id)
        succeeded_count = job_status['swimmers_succeeded'] if job_status else 0
        failed_count = job_status['swimmers_failed'] if job_status else 0
        elapsed = time.time() - task_start

        logger.info(f"sync_squad_swimmers_task completed in {elapsed:.2f}s (job_id={job_id}, succeeded={succeeded_count}, failed={failed_count})")

        return {
            'success': True,
            'job_id': job_id,
            'total_swimmers': total_swimmers,
            'message': f'Squad sync completed: {succeeded_count} succeeded, {failed_count} failed'
        }

    except Exception as e:
        return {
            'success': False,
            'error': f'Failed to start squad sync: {str(e)}'
        }
    finally:
        session.close()


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
    bulk_start_time = time.time()
    logger.info(f"Starting bulk sync of all swimmers (force_update={force_update})")

    session = get_db()
    try:
        # Initialize services
        bulk_sync_service = BulkSyncService(session)

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

        # Initialize sync services once (new 3-mode architecture)
        db_service = DatabaseService(session)
        scraper = SwimRankingsScraper()
        orchestrator = SyncOrchestrator(db_service, scraper)

        # Sync swimmers sequentially (concurrency=1 anyway)
        for link in swimmer_links:
            swimmer_id = link['swimmer_id']
            external_link_id = link['id']
            external_id = link['external_id']

            # Get swimmer name for logging
            swimmer_name = f"{link['first_name']} {link['last_name']}"

            try:
                # Sync swimmer using 3-mode architecture
                sync_result = asyncio.run(orchestrator.sync_swimmer(
                    swimmer_id=swimmer_id,
                    external_link_id=external_link_id,
                    external_id=external_id,
                    limit_events=None
                ))

                succeeded = sync_result.success

                # Log result
                if succeeded:
                    print("=" * 100)
                    print(f"BULK SYNC SUCCESS - SWIMMER: {swimmer_name}")
                    print(f"   Job ID: {job_id}")
                    print(f"   Events Processed: {sync_result.events_processed}")
                    print(f"   Results Imported: {sync_result.results_imported}")
                    print("=" * 100)
                else:
                    error_message = sync_result.error_message or 'Unknown error'
                    print("=" * 100)
                    print(f"BULK SYNC FAILURE - SWIMMER: {swimmer_name}")
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

                # Brief delay between swimmers to avoid rate limiting
                time.sleep(random.uniform(1.0, 2.0))

            except Exception as e:
                # Record failure
                error_msg = f"Exception during sync: {str(e)}"
                print("=" * 100)
                print(f"BULK SYNC FAILURE - SWIMMER: {swimmer_name}")
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

        # Calculate elapsed time
        bulk_elapsed = time.time() - bulk_start_time
        logger.info(f"bulk_sync_all_swimmers_task completed in {bulk_elapsed:.2f}s (job_id={job_id}, succeeded={succeeded_count}, failed={failed_count})")

        print("\n" + "=" * 100)
        print("BULK SYNC JOB COMPLETED")
        print(f"   Job ID: {job_id}")
        print(f"   Total Swimmers: {total_swimmers}")
        print(f"   Succeeded: {succeeded_count}")
        print(f"   Failed: {failed_count}")
        print(f"   Elapsed Time: {bulk_elapsed:.2f}s")
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
    finally:
        session.close()


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
    session = get_db()
    try:
        bulk_sync_service = BulkSyncService(session)

        succeeded = sync_result.get('success', False)

        # Increment progress
        bulk_sync_service.increment_job_progress(job_id, succeeded=succeeded)

        # Record failure if sync failed
        if not succeeded:
            error_message = sync_result.get('error_message', 'Unknown error')
            print("=" * 100)
            print(f"BULK SYNC FAILURE - SWIMMER: {swimmer_name}")
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
            print(f"BULK SYNC SUCCESS - SWIMMER: {swimmer_name}")
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
            print("BULK SYNC JOB COMPLETED")
            print(f"   Job ID: {job_id}")
            print(f"   Total Swimmers: {total}")
            print(f"   Succeeded: {succeeded_count}")
            print(f"   Failed: {failed_count}")
            print("=" * 100 + "\n")

    except Exception as e:
        print("=" * 100)
        print(f"BULK SYNC PROGRESS UPDATE FAILED")
        print(f"   Job ID: {job_id}")
        print(f"   Swimmer: {swimmer_name}")
        print(f"   Error: {e}")
        print("=" * 100)
    finally:
        session.close()


@celery_app.task(name='worker.sync_tasks.cleanup_expired_tokens')
def cleanup_expired_tokens():
    """Delete revoked and expired refresh tokens."""
    db = get_db()
    try:
        result = db.execute(text(
            "DELETE FROM refresh_tokens WHERE revoked = TRUE OR expires_at < NOW()"
        ))
        db.commit()
        logger.info(f"Cleaned up {result.rowcount} expired/revoked refresh tokens")
    except Exception as e:
        logger.error(f"Token cleanup failed: {e}")
        db.rollback()
    finally:
        db.close()
