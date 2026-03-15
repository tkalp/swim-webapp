"""
Background tasks for SwimRankings data synchronization
"""

import sys
import os
from pathlib import Path

# Add jobs directory to path to import sync logic
jobs_path = Path(__file__).parent.parent.parent.parent / "jobs"
sys.path.insert(0, str(jobs_path))

import asyncio
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select, delete, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db import AsyncSessionLocal
from app.infrastructure.models import SwimmerExternalLink, WorkoutResult, RaceSplit
from app.utils import logger, log_error

# Import from jobs folder
try:
    from swimrankings_scraper import SwimRankingsScraper, get_all_events
except ImportError as e:
    logger.error(f"Failed to import from jobs folder: {e}")
    logger.error(f"Jobs path: {jobs_path}")
    raise


async def sync_swimmer_data(
    swimmer_id: str,
    external_link_id: str,
    external_id: str,
    limit_events: Optional[int] = None,
) -> dict:
    """
    Background task to sync SwimRankings data for a single swimmer.
    Creates its own DB session since it runs outside the request lifecycle.
    """
    logger.info(f"[SYNC TASK] Starting sync for swimmer {swimmer_id} (athlete_id={external_id})")

    scraper = SwimRankingsScraper()

    stats = {
        'swimmer_id': swimmer_id,
        'external_link_id': external_link_id,
        'events_processed': 0,
        'results_imported': 0,
        'results_skipped': 0,
        'errors': 0,
        'success': False,
    }

    async with AsyncSessionLocal() as db:
        try:
            all_events = get_all_events()
            events_to_sync = all_events[:limit_events] if limit_events else all_events
            total_events = len(events_to_sync)

            # Update status to in_progress
            await db.execute(
                update(SwimmerExternalLink)
                .where(SwimmerExternalLink.id == external_link_id)
                .values(
                    sync_status='in_progress',
                    last_sync_started_at=datetime.now(timezone.utc),
                    sync_error_message=None,
                    sync_progress=0,
                    sync_total_events=total_events,
                )
            )
            await db.commit()

            logger.info(f"[SYNC TASK] Syncing {total_events} events")

            for event_name in events_to_sync:
                try:
                    # Check if sync was cancelled
                    result = await db.execute(
                        select(SwimmerExternalLink.sync_status)
                        .where(SwimmerExternalLink.id == external_link_id)
                    )
                    current_status = result.scalar_one_or_none()
                    if current_status == 'cancelled':
                        logger.info("[SYNC TASK] Sync cancelled by user")
                        stats['success'] = False
                        return stats

                    stats['events_processed'] += 1

                    # Parse event
                    parts = event_name.split('m ')
                    if len(parts) != 2:
                        continue

                    distance = int(parts[0])
                    stroke_name = parts[1]

                    stroke_map = {
                        'Freestyle': 'free', 'Backstroke': 'back',
                        'Breaststroke': 'breast', 'Butterfly': 'fly',
                        'Individual Medley': 'im',
                    }
                    stroke_enum = stroke_map.get(stroke_name)
                    if not stroke_enum:
                        continue

                    from swimrankings_scraper import get_style_id
                    style_id = get_style_id(event_name)
                    if not style_id:
                        continue

                    logger.info(f"[SYNC TASK] Fetching {event_name} (style_id={style_id})")

                    # Smart fetching: check most recent results per course
                    for course_label in ['LCM', 'SCM']:
                        existing = await db.execute(
                            select(WorkoutResult.performed_on)
                            .where(WorkoutResult.swimmer_id == swimmer_id)
                            .where(WorkoutResult.distance == distance)
                            .where(WorkoutResult.stroke == stroke_enum)
                            .where(WorkoutResult.result_units == course_label)
                            .where(WorkoutResult.source == 'swimrankings')
                            .order_by(WorkoutResult.performed_on.desc())
                            .limit(1)
                        )
                        most_recent = existing.scalar_one_or_none()
                        if most_recent:
                            logger.info(f"[SYNC TASK]   Most recent {course_label} result in DB: {most_recent}")

                    # Fetch results with progressive limits
                    all_attempts = []
                    current_limit = 10

                    try:
                        while current_limit <= 200:
                            attempts_batch = await scraper.fetch_event_attempts(
                                athlete_id=external_id,
                                style_id=style_id,
                                limit=current_limit,
                                skip_no_splits=False,
                            )
                            if not attempts_batch:
                                break

                            all_attempts = attempts_batch
                            lcm_count = sum(
                                1 for a in all_attempts
                                if 'Long Course' in a.get('attempt', {}).get('course', '')
                                or '50m' in a.get('attempt', {}).get('course', '')
                            )
                            scm_count = sum(
                                1 for a in all_attempts
                                if 'Short Course' in a.get('attempt', {}).get('course', '')
                                or '25m' in a.get('attempt', {}).get('course', '')
                            )

                            if lcm_count >= 10 and scm_count >= 10:
                                break
                            if current_limit >= 200:
                                break
                            current_limit = min(current_limit * 2, 200)

                        if not all_attempts:
                            continue

                        # Group by course
                        results_by_course = {'LCM': [], 'SCM': []}
                        for attempt in all_attempts:
                            course_text = attempt.get('attempt', {}).get('course', '')
                            if 'Long Course' in course_text or '50m' in course_text:
                                results_by_course['LCM'].append(attempt)
                            elif 'Short Course' in course_text or '25m' in course_text:
                                results_by_course['SCM'].append(attempt)

                        # Import results for each course
                        for course, attempts in results_by_course.items():
                            if not attempts:
                                continue

                            workout_results_to_upsert = []
                            splits_to_insert = []

                            for attempt in attempts:
                                try:
                                    attempt_data = attempt.get('attempt', {})
                                    swimrankings_result_id = f"{external_id}_{attempt_data.get('date')}_{distance}_{stroke_name}_{course}_{attempt_data.get('time')}"

                                    # Parse time
                                    time_parts = attempt_data.get('time', '').split(':')
                                    if len(time_parts) == 2:
                                        minutes, seconds = time_parts
                                        time_interval = f"00:{minutes.zfill(2)}:{seconds.zfill(5)}"
                                    elif len(time_parts) == 3:
                                        time_interval = ':'.join(time_parts)
                                    else:
                                        time_interval = f"00:00:{time_parts[0].zfill(5)}"

                                    # Parse date
                                    performed_on = None
                                    date_str = attempt_data.get('date', '').strip().replace('\xa0', ' ')
                                    if date_str:
                                        for fmt in ['%d/%m/%Y', '%d-%m-%Y', '%d.%m.%Y', '%Y-%m-%d', '%d %b %Y', '%d %B %Y']:
                                            try:
                                                performed_on = datetime.strptime(date_str, fmt).strftime('%Y-%m-%d')
                                                break
                                            except ValueError:
                                                continue

                                    if not performed_on:
                                        stats['errors'] += 1
                                        continue

                                    # Parse location
                                    location = attempt_data.get('location', '')
                                    city, nation = None, None
                                    if '(' in location:
                                        loc_parts = location.split('(')
                                        city = loc_parts[0].strip()
                                        nation = loc_parts[1].replace(')', '').strip()
                                    else:
                                        city = location.strip() if location else None

                                    result_data = {
                                        'swimmer_id': swimmer_id,
                                        'distance': distance,
                                        'stroke': stroke_enum,
                                        'time_result': time_interval,
                                        'result_units': course,
                                        'performed_on': performed_on,
                                        'meet_name': attempt_data.get('meet_name'),
                                        'meet_city': city,
                                        'meet_nation': nation,
                                        'source': 'swimrankings',
                                        'swimrankings_result_id': swimrankings_result_id,
                                        'reaction_time': attempt.get('reaction_time'),
                                        'activity': 'swim',
                                        'equipment': 'none',
                                    }
                                    workout_results_to_upsert.append(result_data)

                                    if 'splits' in attempt and attempt['splits']:
                                        splits_to_insert.append({
                                            'swimrankings_result_id': swimrankings_result_id,
                                            'splits': attempt['splits'],
                                        })

                                except Exception as e:
                                    import traceback
                                    logger.warning(f"[SYNC TASK]   Error preparing result: {e}")
                                    logger.warning(f"[SYNC TASK]   Traceback: {traceback.format_exc()}")
                                    stats['errors'] += 1

                            # Bulk upsert
                            if workout_results_to_upsert:
                                try:
                                    result_ids = [w['swimrankings_result_id'] for w in workout_results_to_upsert]
                                    existing_results = await db.execute(
                                        select(WorkoutResult.id, WorkoutResult.swimrankings_result_id)
                                        .where(WorkoutResult.swimrankings_result_id.in_(result_ids))
                                    )
                                    existing_map = {row.swimrankings_result_id: row.id for row in existing_results}

                                    all_result_ids = {}

                                    # Update existing
                                    for workout_data in workout_results_to_upsert:
                                        rid = workout_data['swimrankings_result_id']
                                        if rid in existing_map:
                                            await db.execute(
                                                update(WorkoutResult)
                                                .where(WorkoutResult.id == existing_map[rid])
                                                .values(**workout_data)
                                            )
                                            all_result_ids[rid] = existing_map[rid]
                                            stats['results_skipped'] += 1
                                        else:
                                            instance = WorkoutResult(**workout_data)
                                            db.add(instance)
                                            await db.flush()
                                            all_result_ids[rid] = instance.id
                                            stats['results_imported'] += 1

                                    await db.commit()

                                    # Handle splits
                                    if all_result_ids and splits_to_insert:
                                        workout_ids_needing_splits = []
                                        all_splits_data = []

                                        for split_info in splits_to_insert:
                                            wr_id = all_result_ids.get(split_info['swimrankings_result_id'])
                                            if wr_id:
                                                workout_ids_needing_splits.append(wr_id)
                                                for split in split_info['splits']:
                                                    all_splits_data.append(RaceSplit(
                                                        workout_result_id=wr_id,
                                                        split_distance=split['split_distance'],
                                                        split_time=split['split_time'],
                                                        cumulative_time=split['cumulative_time'],
                                                        split_order=split['split_order'],
                                                    ))

                                        if all_splits_data:
                                            # Delete old splits
                                            for wr_id in set(workout_ids_needing_splits):
                                                await db.execute(
                                                    delete(RaceSplit)
                                                    .where(RaceSplit.workout_result_id == wr_id)
                                                )

                                            db.add_all(all_splits_data)
                                            await db.commit()

                                except Exception as e:
                                    import traceback
                                    logger.error(f"[SYNC TASK]   Error during bulk upsert: {e}")
                                    logger.error(f"[SYNC TASK]   Traceback: {traceback.format_exc()}")
                                    stats['errors'] += len(workout_results_to_upsert)
                                    await db.rollback()

                    except Exception as e:
                        logger.warning(f"[SYNC TASK]   Error fetching event results: {e}")
                        stats['errors'] += 1
                        continue

                    # Update progress
                    await db.execute(
                        update(SwimmerExternalLink)
                        .where(SwimmerExternalLink.id == external_link_id)
                        .values(
                            sync_progress=stats['events_processed'],
                            results_count=stats['results_imported'],
                        )
                    )
                    await db.commit()

                    await asyncio.sleep(0.5)

                except Exception as e:
                    logger.warning(f"[SYNC TASK] Error processing event {event_name}: {e}")
                    stats['errors'] += 1
                    await db.execute(
                        update(SwimmerExternalLink)
                        .where(SwimmerExternalLink.id == external_link_id)
                        .values(sync_progress=stats['events_processed'])
                    )
                    await db.commit()

            # Check final status
            result = await db.execute(
                select(SwimmerExternalLink.sync_status)
                .where(SwimmerExternalLink.id == external_link_id)
            )
            final_status = result.scalar_one_or_none()

            if final_status == 'cancelled':
                logger.info("[SYNC TASK] Sync was cancelled, not marking as completed")
                stats['success'] = False
                await db.execute(
                    update(SwimmerExternalLink)
                    .where(SwimmerExternalLink.id == external_link_id)
                    .values(last_sync_completed_at=datetime.now(timezone.utc))
                )
            else:
                stats['success'] = True
                await db.execute(
                    update(SwimmerExternalLink)
                    .where(SwimmerExternalLink.id == external_link_id)
                    .values(
                        sync_status='completed',
                        last_sync_at=datetime.now(timezone.utc),
                        last_sync_completed_at=datetime.now(timezone.utc),
                        results_count=stats['results_imported'],
                        sync_error_message=None,
                    )
                )

            await db.commit()

            logger.info(
                f"[SYNC TASK] Completed sync for swimmer {swimmer_id}: "
                f"{stats['results_imported']} imported, {stats['results_skipped']} skipped, "
                f"{stats['errors']} errors"
            )

        except Exception as e:
            stats['success'] = False
            error_msg = f"{type(e).__name__}: {str(e)}"
            logger.error(f"[SYNC TASK] Failed to sync swimmer {swimmer_id}: {error_msg}")
            log_error(e, context="sync_swimmer_data", swimmer_id=swimmer_id)

            try:
                await db.execute(
                    update(SwimmerExternalLink)
                    .where(SwimmerExternalLink.id == external_link_id)
                    .values(
                        sync_status='failed',
                        last_sync_completed_at=datetime.now(timezone.utc),
                        sync_error_message=error_msg[:500],
                    )
                )
                await db.commit()
            except Exception as update_error:
                logger.error(f"[SYNC TASK] Failed to update error status: {update_error}")

    return stats


def start_swimmer_sync(
    swimmer_id: str,
    external_link_id: str,
    external_id: str,
    limit_events: Optional[int] = None,
) -> None:
    """Synchronous wrapper to start async swimmer sync."""
    asyncio.run(sync_swimmer_data(swimmer_id, external_link_id, external_id, limit_events))
