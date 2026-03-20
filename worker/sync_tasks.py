"""
Celery tasks for SwimRankings data synchronization.

Uses the swim-scraper client (SwimRankingsClientManager) and RaceResultConverter
to fetch and store athlete history from SwimRankings.net.
"""

import time
import random
import logging
from datetime import datetime, timezone
from typing import Optional
from celery import Task
from sqlalchemy import select, text

from worker.database import get_db
from worker.celery_app import celery_app
from worker.client import SwimRankingsClientManager
from worker.converter import RaceResultConverter
from worker.config import WorkerConfig
from worker.services.database_service import DatabaseService
from worker.services.bulk_sync_service import BulkSyncService
from worker.models import SyncStatusUpdate, SyncResult

logger = logging.getLogger('sync_tasks')


class SyncTask(Task):
    """Custom task class with failure logging and status update."""

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Handle task failure by logging and updating sync status."""
        logger.error(f"Task {task_id} failed: {exc}")

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
                            last_sync_completed_at=datetime.now(timezone.utc).isoformat(),
                            sync_error=error_msg[:500]
                        )
                    )
                finally:
                    session.close()
        except Exception as update_error:
            logger.error(f"Failed to update error status: {update_error}")


def _sync_single_swimmer(
    db_service: DatabaseService,
    swimmer_id: str,
    external_link_id: str,
    external_id: str,
    force: bool = False,
) -> SyncResult:
    """
    Sync SwimRankings history for a single swimmer.

    Fetches all athlete history via the swim-scraper client, converts results,
    deduplicates against the database, and bulk-inserts new records.

    Args:
        db_service: DatabaseService instance (synchronous SQLAlchemy session).
        swimmer_id: Database swimmer UUID.
        external_link_id: swimmer_external_links table UUID.
        external_id: SwimRankings athlete ID.
        force: If True, skip the freshness check and always sync.

    Returns:
        SyncResult with counts and success flag.
    """
    now = datetime.now(timezone.utc)

    # ── Freshness check ──────────────────────────────────────────────────────
    if not force:
        # NOTE: This inline query will be replaced by db_service.get_last_sync_time()
        # once Task 11 lands.
        from app.infrastructure.models import SwimmerExternalLink
        stmt = (
            select(SwimmerExternalLink.last_sync_completed_at)
            .where(SwimmerExternalLink.id == external_link_id)
        )
        row = db_service.session.execute(stmt).first()
        last_sync = row[0] if row and row[0] else None

        # if last_sync is not None:
        #     if last_sync.tzinfo is None:
        #         last_sync = last_sync.replace(tzinfo=timezone.utc)
        #     age_hours = (now - last_sync).total_seconds() / 3600
        #     if age_hours < WorkerConfig.SYNC_FRESHNESS_HOURS:
        #         logger.info(
        #             f"Skipping swimmer {swimmer_id} — synced {age_hours:.1f}h ago "
        #             f"(freshness window: {WorkerConfig.SYNC_FRESHNESS_HOURS}h)"
        #         )
        #         return SyncResult(
        #             swimmer_id=swimmer_id,
        #             external_link_id=external_link_id,
        #             events_processed=0,
        #             results_imported=0,
        #             results_skipped=0,
        #             errors=0,
        #             success=True,
        #             error_message="Skipped (recently synced)",
        #         )

    # ── Mark in_progress ─────────────────────────────────────────────────────
    db_service.update_sync_status(
        external_link_id,
        SyncStatusUpdate(
            sync_status='in_progress',
            last_sync_started_at=now.isoformat(),
        )
    )

    try:
        # ── Fetch history from SwimRankings ──────────────────────────────────
        client = SwimRankingsClientManager.get_client()
        logger.info(f"Fetching history for athlete {external_id} (swimmer {swimmer_id})")
        history = client.history(external_id)
        race_results = history.results
        logger.info(f"Fetched {len(race_results)} race results for athlete {external_id}")

        # ── Convert RaceResult → WorkoutResult ───────────────────────────────
        workout_results = RaceResultConverter.convert_batch(race_results, swimmer_id, external_id)

        # ── Count distinct events in the raw results ─────────────────────────
        events_processed = len(set(rr.event for rr in race_results))

        # ── Early return if nothing to process ───────────────────────────────
        if not workout_results:
            logger.info(f"No convertible results for swimmer {swimmer_id}")
            db_service.update_sync_status(
                external_link_id,
                SyncStatusUpdate(
                    sync_status='completed',
                    last_sync_completed_at=datetime.now(timezone.utc).isoformat(),
                    sync_progress=0,
                    sync_total=events_processed,
                    results_count=0,
                )
            )
            return SyncResult(
                swimmer_id=swimmer_id,
                external_link_id=external_link_id,
                events_processed=events_processed,
                results_imported=0,
                results_skipped=len(race_results),
                errors=0,
                success=True,
            )

        # ── Deduplicate against existing DB records ───────────────────────────
        sr_ids = [
            wr.swimrankings_result_id
            for wr in workout_results
            if wr.swimrankings_result_id
        ]
        existing = db_service.check_existing_results(sr_ids, swimmer_id)
        new_results = [
            wr for wr in workout_results
            if wr.swimrankings_result_id not in existing
        ]
        results_skipped = len(workout_results) - len(new_results)

        logger.info(
            f"Swimmer {swimmer_id}: {len(new_results)} new results, "
            f"{results_skipped} already exist"
        )

        # ── Bulk insert new results ───────────────────────────────────────────
        results_imported = 0
        if new_results:
            inserted = db_service.bulk_insert_workout_results(new_results)
            results_imported = len(inserted)
            logger.info(f"Inserted {results_imported} results for swimmer {swimmer_id}")

        # ── Mark completed ────────────────────────────────────────────────────
        db_service.update_sync_status(
            external_link_id,
            SyncStatusUpdate(
                sync_status='completed',
                last_sync_completed_at=datetime.now(timezone.utc).isoformat(),
                sync_progress=events_processed,
                sync_total=events_processed,
                results_count=results_imported,
            )
        )

        return SyncResult(
            swimmer_id=swimmer_id,
            external_link_id=external_link_id,
            events_processed=events_processed,
            results_imported=results_imported,
            results_skipped=results_skipped,
            errors=0,
            success=True,
        )

    except Exception as exc:
        error_msg = f"{type(exc).__name__}: {str(exc)}"
        logger.error(f"Sync failed for swimmer {swimmer_id}: {error_msg}", exc_info=True)

        db_service.update_sync_status(
            external_link_id,
            SyncStatusUpdate(
                sync_status='failed',
                last_sync_completed_at=datetime.now(timezone.utc).isoformat(),
                sync_error=error_msg[:500],
            )
        )

        return SyncResult(
            swimmer_id=swimmer_id,
            external_link_id=external_link_id,
            events_processed=0,
            results_imported=0,
            results_skipped=0,
            errors=1,
            success=False,
            error_message=error_msg,
        )


@celery_app.task(bind=True, base=SyncTask, name='worker.sync_tasks.sync_swimmer_task')
def sync_swimmer_task(
    self,
    swimmer_id: str,
    external_link_id: str,
    external_id: str,
) -> dict:
    """
    Celery task to sync SwimRankings data for a single swimmer.

    Args:
        swimmer_id: Database swimmer UUID.
        external_link_id: swimmer_external_links table UUID.
        external_id: SwimRankings athlete ID.

    Returns:
        Dictionary with sync statistics.
    """
    task_start = time.time()
    session = get_db()
    try:
        db_service = DatabaseService(session)
        result = _sync_single_swimmer(
            db_service=db_service,
            swimmer_id=swimmer_id,
            external_link_id=external_link_id,
            external_id=external_id,
            force=False,
        )
        elapsed = time.time() - task_start
        logger.info(
            f"sync_swimmer_task completed in {elapsed:.2f}s for swimmer {swimmer_id} "
            f"(imported={result.results_imported}, skipped={result.results_skipped})"
        )
        return {
            'swimmer_id': result.swimmer_id,
            'external_link_id': result.external_link_id,
            'events_processed': result.events_processed,
            'results_imported': result.results_imported,
            'results_skipped': result.results_skipped,
            'errors': result.errors,
            'success': result.success,
            'error_message': result.error_message,
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

    Squad sync always forces a full re-sync (ignores the freshness window).

    Args:
        squad_id: Squad UUID.
        triggered_by_user_id: Coach user ID who triggered the sync.
        job_id: Pre-created BulkSyncJob ID (created by API endpoint for polling).

    Returns:
        Dictionary with job_id and summary.
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
                bulk_sync_service.update_job_status(
                    job_id, 'failed',
                    error_message='No swimmers with SwimRankings links in this squad'
                )
            return {
                'success': False,
                'error': 'No swimmers with SwimRankings links in this squad',
            }

        # Use pre-created job_id or create a new one.
        if not job_id:
            job_id = bulk_sync_service.create_bulk_sync_job(
                triggered_by_user_id=triggered_by_user_id,
                total_swimmers=total_swimmers,
            )
        bulk_sync_service.update_job_status(job_id, 'in_progress')

        db_service = DatabaseService(session)

        for link in swimmer_links:
            swimmer_id = link['swimmer_id']
            external_link_id = link['id']
            external_id = link['external_id']
            swimmer_name = f"{link['first_name']} {link['last_name']}"

            try:
                sync_result = _sync_single_swimmer(
                    db_service=db_service,
                    swimmer_id=swimmer_id,
                    external_link_id=external_link_id,
                    external_id=external_id,
                    force=True,  # Squad sync always re-syncs all
                )
                succeeded = sync_result.success

                if succeeded:
                    logger.info(
                        f"Squad sync success: {swimmer_name} "
                        f"(events={sync_result.events_processed}, "
                        f"results={sync_result.results_imported})"
                    )
                else:
                    error_message = sync_result.error_message or 'Unknown error'
                    logger.warning(f"Squad sync failure: {swimmer_name} — {error_message}")
                    bulk_sync_service.record_failure(
                        job_id=job_id,
                        swimmer_id=swimmer_id,
                        external_link_id=external_link_id,
                        swimmer_name=swimmer_name,
                        error_message=error_message,
                    )

                bulk_sync_service.increment_job_progress(job_id, succeeded=succeeded)
                time.sleep(random.uniform(1.0, 2.0))

            except Exception as e:
                error_msg = f"Exception during sync: {str(e)}"
                logger.error(f"Squad sync exception: {swimmer_name} — {error_msg}")
                bulk_sync_service.record_failure(
                    job_id=job_id,
                    swimmer_id=swimmer_id,
                    external_link_id=external_link_id,
                    swimmer_name=swimmer_name,
                    error_message=error_msg,
                )
                bulk_sync_service.increment_job_progress(job_id, succeeded=False)

        bulk_sync_service.update_job_status(job_id, 'completed')

        job_status = bulk_sync_service.get_job_status(job_id)
        succeeded_count = job_status['swimmers_succeeded'] if job_status else 0
        failed_count = job_status['swimmers_failed'] if job_status else 0
        elapsed = time.time() - task_start

        logger.info(
            f"sync_squad_swimmers_task completed in {elapsed:.2f}s "
            f"(job_id={job_id}, succeeded={succeeded_count}, failed={failed_count})"
        )

        return {
            'success': True,
            'job_id': job_id,
            'total_swimmers': total_swimmers,
            'message': f'Squad sync completed: {succeeded_count} succeeded, {failed_count} failed',
        }

    except Exception as e:
        return {
            'success': False,
            'error': f'Failed to start squad sync: {str(e)}',
        }
    finally:
        session.close()


@celery_app.task(bind=True, name='worker.sync_tasks.bulk_sync_all_swimmers_task')
def bulk_sync_all_swimmers_task(
    self,
    triggered_by_user_id: str,
    force_update: bool = False,
    job_id: Optional[str] = None,
) -> dict:
    """
    Celery task to sync all SwimRankings swimmers in bulk.

    Args:
        triggered_by_user_id: Admin user ID who triggered the sync.
        force_update: If True, bypass freshness check and sync all data.
        job_id: Pre-created BulkSyncJob ID (created by API for immediate polling).
                If not provided, the task creates one after counting swimmers.

    Returns:
        Dictionary with job_id and summary.
    """
    bulk_start_time = time.time()
    logger.info(f"Starting bulk sync of all swimmers (force_update={force_update})")

    session = get_db()
    try:
        bulk_sync_service = BulkSyncService(session)
        swimmer_links = bulk_sync_service.get_all_swimrankings_links()
        total_swimmers = len(swimmer_links)

        if total_swimmers == 0:
            if job_id:
                bulk_sync_service.update_job_status(
                    job_id, 'failed',
                    error_message='No swimmers with SwimRankings links'
                )
            return {
                'success': False,
                'error': 'No swimmers found with SwimRankings links',
            }

        # Use pre-created job_id or create a new one.
        if not job_id:
            job_id = bulk_sync_service.create_bulk_sync_job(
                triggered_by_user_id=triggered_by_user_id,
                total_swimmers=total_swimmers,
            )
        else:
            # Update total_swimmers on the pre-created record now that we know the count.
            bulk_sync_service.update_job_total_swimmers(job_id, total_swimmers)

        bulk_sync_service.update_job_status(job_id, 'in_progress')

        db_service = DatabaseService(session)

        for link in swimmer_links:
            swimmer_id = link['swimmer_id']
            external_link_id = link['id']
            external_id = link['external_id']
            swimmer_name = f"{link['first_name']} {link['last_name']}"

            try:
                sync_result = _sync_single_swimmer(
                    db_service=db_service,
                    swimmer_id=swimmer_id,
                    external_link_id=external_link_id,
                    external_id=external_id,
                    force=force_update,
                )
                succeeded = sync_result.success

                if succeeded:
                    logger.info(
                        f"Bulk sync success: {swimmer_name} "
                        f"(job={job_id}, events={sync_result.events_processed}, "
                        f"results={sync_result.results_imported})"
                    )
                else:
                    error_message = sync_result.error_message or 'Unknown error'
                    logger.warning(
                        f"Bulk sync failure: {swimmer_name} "
                        f"(job={job_id}) — {error_message}"
                    )
                    bulk_sync_service.record_failure(
                        job_id=job_id,
                        swimmer_id=swimmer_id,
                        external_link_id=external_link_id,
                        swimmer_name=swimmer_name,
                        error_message=error_message,
                    )

                bulk_sync_service.increment_job_progress(job_id, succeeded=succeeded)
                time.sleep(random.uniform(1.0, 2.0))

            except Exception as e:
                error_msg = f"Exception during sync: {str(e)}"
                logger.error(
                    f"Bulk sync exception: {swimmer_name} (job={job_id}) — {error_msg}"
                )
                bulk_sync_service.record_failure(
                    job_id=job_id,
                    swimmer_id=swimmer_id,
                    external_link_id=external_link_id,
                    swimmer_name=swimmer_name,
                    error_message=error_msg,
                )
                bulk_sync_service.increment_job_progress(job_id, succeeded=False)

        bulk_sync_service.update_job_status(job_id, 'completed')

        job_status = bulk_sync_service.get_job_status(job_id)
        succeeded_count = job_status['swimmers_succeeded'] if job_status else 0
        failed_count = job_status['swimmers_failed'] if job_status else 0
        bulk_elapsed = time.time() - bulk_start_time

        logger.info(
            f"bulk_sync_all_swimmers_task completed in {bulk_elapsed:.2f}s "
            f"(job_id={job_id}, total={total_swimmers}, "
            f"succeeded={succeeded_count}, failed={failed_count})"
        )

        return {
            'success': True,
            'job_id': job_id,
            'total_swimmers': total_swimmers,
            'message': f'Bulk sync job {job_id} completed for {total_swimmers} swimmers',
        }

    except Exception as e:
        return {
            'success': False,
            'error': f'Failed to start bulk sync: {str(e)}',
        }
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
