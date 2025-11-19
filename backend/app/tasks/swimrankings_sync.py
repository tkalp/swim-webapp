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
from datetime import datetime
from typing import Optional
from supabase import Client

from app.utils import logger, log_error

# Import from jobs folder
try:
    from swimrankings_scraper import SwimRankingsScraper, get_all_events
    from database import get_supabase_client
except ImportError as e:
    logger.error(f"Failed to import from jobs folder: {e}")
    logger.error(f"Jobs path: {jobs_path}")
    raise


async def sync_swimmer_data(
    swimmer_id: str,
    external_link_id: str,
    external_id: str,
    limit_events: Optional[int] = None
) -> dict:
    """
    Background task to sync SwimRankings data for a single swimmer
    
    Args:
        swimmer_id: Database swimmer ID
        external_link_id: swimmer_external_links table ID
        external_id: SwimRankings athlete ID
        limit_events: Limit number of events to sync (None = all)
    
    Returns:
        Dictionary with sync statistics
    """
    logger.info(f"[SYNC TASK] Starting sync for swimmer {swimmer_id} (athlete_id={external_id})")
    
    supabase = get_supabase_client()
    scraper = SwimRankingsScraper()
    
    stats = {
        'swimmer_id': swimmer_id,
        'external_link_id': external_link_id,
        'events_processed': 0,
        'results_imported': 0,
        'results_skipped': 0,
        'errors': 0,
        'success': False
    }
    
    try:
        # Get all swimming events
        all_events = get_all_events()
        events_to_sync = all_events[:limit_events] if limit_events else all_events
        total_events = len(events_to_sync)
        
        # Update status to in_progress with progress tracking
        supabase.table('swimmer_external_links').update({
            'sync_status': 'in_progress',
            'last_sync_started_at': datetime.utcnow().isoformat(),
            'sync_error': None,
            'sync_progress': 0,
            'sync_total': total_events
        }).eq('id', external_link_id).execute()
        
        logger.info(f"[SYNC TASK] Syncing {total_events} events")
        
        # Sync each event
        for event_name in events_to_sync:
            try:
                # Check if sync was cancelled
                status_check = supabase.table('swimmer_external_links').select('sync_status').eq('id', external_link_id).single().execute()
                if status_check.data and status_check.data.get('sync_status') == 'cancelled':
                    logger.info(f"[SYNC TASK] Sync cancelled by user")
                    stats['success'] = False
                    return stats
                
                stats['events_processed'] += 1
                
                # Parse event (e.g., "100m Freestyle")
                parts = event_name.split('m ')
                if len(parts) != 2:
                    continue
                
                distance = int(parts[0])
                stroke_name = parts[1]
                
                # Map stroke name to database enum
                stroke_map = {
                    'Freestyle': 'free',
                    'Backstroke': 'back',
                    'Breaststroke': 'breast',
                    'Butterfly': 'fly',
                    'Individual Medley': 'im'
                }
                stroke_enum = stroke_map.get(stroke_name)
                
                if not stroke_enum:
                    logger.warning(f"[SYNC TASK] Unknown stroke: {stroke_name}")
                    continue
                
                # Get style_id for this event
                from swimrankings_scraper import get_style_id
                style_id = get_style_id(event_name)
                
                if not style_id:
                    logger.warning(f"[SYNC TASK] No style_id found for {event_name}")
                    continue
                
                logger.info(f"[SYNC TASK] Fetching {event_name} (style_id={style_id})")
                
                # Smart fetching: Check most recent result for EACH course
                # Since fetch_event_attempts returns both LCM and SCM mixed together,
                # we need to check both courses to determine the right fetch limit
                most_recent_lcm = None
                most_recent_scm = None
                
                existing_lcm = supabase.table('workout_result').select(
                    'performed_on'
                ).eq('swimmer_id', swimmer_id).eq('distance', distance).eq(
                    'stroke', stroke_enum
                ).eq('result_units', 'LCM').eq('source', 'swimrankings').order(
                    'performed_on', desc=True
                ).limit(1).execute()
                
                existing_scm = supabase.table('workout_result').select(
                    'performed_on'
                ).eq('swimmer_id', swimmer_id).eq('distance', distance).eq(
                    'stroke', stroke_enum
                ).eq('result_units', 'SCM').eq('source', 'swimrankings').order(
                    'performed_on', desc=True
                ).limit(1).execute()
                
                if existing_lcm.data:
                    most_recent_lcm = existing_lcm.data[0].get('performed_on')
                    logger.info(f"[SYNC TASK]   Most recent LCM result in DB: {most_recent_lcm}")
                
                if existing_scm.data:
                    most_recent_scm = existing_scm.data[0].get('performed_on')
                    logger.info(f"[SYNC TASK]   Most recent SCM result in DB: {most_recent_scm}")
                
                # Fetch with smart limit - start with small limit and check both courses
                initial_limit = 10
                needs_more_lcm = not most_recent_lcm
                needs_more_scm = not most_recent_scm
                
                all_attempts = []
                current_limit = initial_limit
                
                try:
                    while current_limit <= 200:  # Max 200 results to prevent infinite loops
                        attempts_batch = await scraper.fetch_event_attempts(
                            athlete_id=external_id,
                            style_id=style_id,
                            limit=current_limit,
                            skip_no_splits=False
                        )
                        
                        if not attempts_batch:
                            break
                        
                        all_attempts = attempts_batch
                        logger.info(f"[SYNC TASK]   Fetched {len(all_attempts)} results with limit={current_limit}")
                        
                        # Check if we have enough results for both courses
                        lcm_count = 0
                        scm_count = 0
                        
                        for attempt in all_attempts:
                            attempt_data = attempt.get('attempt', {})
                            course_text = attempt_data.get('course', '')
                            
                            if 'Long Course' in course_text or '50m' in course_text:
                                lcm_count += 1
                            elif 'Short Course' in course_text or '25m' in course_text:
                                scm_count += 1
                        
                        # Check if we have enough for each course
                        has_enough_lcm = lcm_count >= 10 or not needs_more_lcm
                        has_enough_scm = scm_count >= 10 or not needs_more_scm
                        
                        logger.info(f"[SYNC TASK]   Found {lcm_count} LCM, {scm_count} SCM results")
                        
                        if has_enough_lcm and has_enough_scm:
                            logger.info(f"[SYNC TASK]   Have enough results for both courses")
                            break
                        
                        # Need more results, double the limit
                        if current_limit >= 200:
                            logger.warning(f"[SYNC TASK]   Reached max limit (200) but still need more results")
                            break
                        
                        current_limit = min(current_limit * 2, 200)
                        logger.info(f"[SYNC TASK]   Need more results, trying limit={current_limit}")
                    
                    if not all_attempts:
                        continue
                    
                    # Group results by course
                    results_by_course = {'LCM': [], 'SCM': []}
                    for attempt in all_attempts:
                        attempt_data = attempt.get('attempt', {})
                        course_text = attempt_data.get('course', '')
                        
                        if 'Long Course' in course_text or '50m' in course_text:
                            results_by_course['LCM'].append(attempt)
                        elif 'Short Course' in course_text or '25m' in course_text:
                            results_by_course['SCM'].append(attempt)
                        else:
                            logger.warning(f"[SYNC TASK]   Unknown course format: '{course_text}' - skipping result")
                    
                    logger.info(f"[SYNC TASK]   Final count: {len(results_by_course['LCM'])} LCM, {len(results_by_course['SCM'])} SCM")
                    
                    # Import results for each course
                    for course, attempts in results_by_course.items():
                        if not attempts:
                            logger.debug(f"[SYNC TASK]   No {course} results to process")
                            continue
                        
                        logger.info(f"[SYNC TASK]   Processing {len(attempts)} {course} results")
                        
                        # Prepare bulk data for upsert (optimization)
                        workout_results_to_upsert = []
                        splits_to_insert = []
                        
                        # Import each attempt
                        for attempt in attempts:
                            try:
                                # Extract the actual attempt data (nested structure)
                                attempt_data = attempt.get('attempt', {})
                                
                                # Generate unique result ID
                                swimrankings_result_id = f"{external_id}_{attempt_data.get('date')}_{distance}_{stroke_name}_{course}_{attempt_data.get('time')}"
                                
                                # Convert time string to interval
                                time_parts = attempt_data.get('time', '').split(':')
                                if len(time_parts) == 2:
                                    # mm:ss.ms format
                                    minutes, seconds = time_parts
                                    time_interval = f"00:{minutes.zfill(2)}:{seconds.zfill(5)}"
                                elif len(time_parts) == 3:
                                    # hh:mm:ss.ms format
                                    time_interval = ':'.join(time_parts)
                                else:
                                    # ss.ms format
                                    time_interval = f"00:00:{time_parts[0].zfill(5)}"
                                
                                # Parse date from various formats
                                performed_on = None
                                date_str = attempt_data.get('date')
                                if date_str and date_str.strip():
                                    date_str = date_str.strip()
                                    # Remove non-breaking spaces
                                    date_str = date_str.replace('\xa0', ' ')
                                    # Try common date formats
                                    date_parsed = False
                                    for fmt in ['%d/%m/%Y', '%d-%m-%Y', '%d.%m.%Y', '%Y-%m-%d', '%d %b %Y', '%d %B %Y']:
                                        try:
                                            parsed_date = datetime.strptime(date_str, fmt)
                                            performed_on = parsed_date.strftime('%Y-%m-%d')
                                            date_parsed = True
                                            break
                                        except ValueError:
                                            continue
                                    
                                    if not date_parsed:
                                        logger.debug(f"[SYNC TASK]   Could not parse date: '{date_str}'")
                                
                                # Skip if we don't have a valid date
                                if not performed_on:
                                    logger.debug(f"[SYNC TASK]   Skipping result without valid date")
                                    stats['errors'] += 1
                                    continue
                                
                                # Parse city and nation from location
                                location = attempt_data.get('location', '')
                                city, nation = None, None
                                if '(' in location:
                                    parts = location.split('(')
                                    city = parts[0].strip()
                                    nation = parts[1].replace(')', '').strip()
                                else:
                                    city = location.strip() if location else None
                                
                                # Prepare workout_result data
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
                                    'equipment': 'none'
                                }
                                
                                workout_results_to_upsert.append(result_data)
                                
                                # Store splits for later insertion
                                if 'splits' in attempt and attempt['splits']:
                                    splits_to_insert.append({
                                        'swimrankings_result_id': swimrankings_result_id,
                                        'splits': attempt['splits']
                                    })
                                
                            except Exception as e:
                                import traceback
                                logger.warning(f"[SYNC TASK]   Error preparing result: {type(e).__name__}: {str(e)}")
                                logger.warning(f"[SYNC TASK]   Failed attempt data: {attempt}")
                                logger.warning(f"[SYNC TASK]   Traceback: {traceback.format_exc()}")
                                stats['errors'] += 1
                                continue
                        
                        # Bulk upsert workout_results (optimization)
                        if workout_results_to_upsert:
                            try:
                                logger.info(f"[SYNC TASK]   Performing bulk upsert of {len(workout_results_to_upsert)} results...")
                                
                                # Fetch existing records to determine updates vs inserts
                                result_ids = [w['swimrankings_result_id'] for w in workout_results_to_upsert]
                                existing_results = supabase.table('workout_result').select('id, swimrankings_result_id').in_(
                                    'swimrankings_result_id', result_ids
                                ).execute()
                                
                                existing_map = {row['swimrankings_result_id']: row['id'] for row in existing_results.data} if existing_results.data else {}
                                
                                # Separate into updates and inserts
                                updates = []
                                inserts = []
                                
                                for workout_data in workout_results_to_upsert:
                                    result_id = workout_data['swimrankings_result_id']
                                    if result_id in existing_map:
                                        updates.append({
                                            'id': existing_map[result_id],
                                            **workout_data
                                        })
                                        stats['results_skipped'] += 1
                                    else:
                                        inserts.append(workout_data)
                                
                                all_result_ids = {}
                                
                                # Bulk update existing records
                                if updates:
                                    logger.info(f"[SYNC TASK]   Updating {len(updates)} existing records...")
                                    for update_data in updates:
                                        update_id = update_data.pop('id')
                                        result = supabase.table('workout_result').update(update_data).eq('id', update_id).execute()
                                        if result.data:
                                            all_result_ids[update_data['swimrankings_result_id']] = update_id
                                
                                # Bulk insert new records
                                if inserts:
                                    logger.info(f"[SYNC TASK]   Inserting {len(inserts)} new records...")
                                    insert_result = supabase.table('workout_result').insert(inserts).execute()
                                    if insert_result.data:
                                        for row in insert_result.data:
                                            all_result_ids[row['swimrankings_result_id']] = row['id']
                                        stats['results_imported'] += len(insert_result.data)
                                
                                # Bulk insert splits
                                if all_result_ids and splits_to_insert:
                                    # First, collect all workout_result_ids that need split updates
                                    workout_ids_needing_splits = []
                                    all_splits_data = []
                                    
                                    for split_info in splits_to_insert:
                                        workout_result_id = all_result_ids.get(split_info['swimrankings_result_id'])
                                        if workout_result_id:
                                            workout_ids_needing_splits.append(workout_result_id)
                                            for split in split_info['splits']:
                                                split_data = {
                                                    'workout_result_id': workout_result_id,
                                                    'split_distance': split['split_distance'],
                                                    'split_time': split['split_time'],
                                                    'cumulative_time': split['cumulative_time'],
                                                    'split_order': split['split_order']
                                                }
                                                all_splits_data.append(split_data)
                                    
                                    if all_splits_data:
                                        logger.info(f"[SYNC TASK]   Processing {len(all_splits_data)} splits for {len(set(workout_ids_needing_splits))} results...")
                                        
                                        # Delete old splits for these specific results first
                                        if workout_ids_needing_splits:
                                            unique_workout_ids = list(set(workout_ids_needing_splits))
                                            logger.info(f"[SYNC TASK]   Deleting old splits for {len(unique_workout_ids)} results...")
                                            
                                            # Delete splits one workout_result at a time to ensure it works
                                            for workout_id in unique_workout_ids:
                                                try:
                                                    supabase.table('race_splits').delete().eq('workout_result_id', workout_id).execute()
                                                except Exception as delete_error:
                                                    logger.warning(f"[SYNC TASK]   Error deleting splits for {workout_id}: {delete_error}")
                                            
                                            logger.info(f"[SYNC TASK]   Deleted old splits")
                                        
                                        # Now bulk insert new splits
                                        logger.info(f"[SYNC TASK]   Inserting {len(all_splits_data)} new splits...")
                                        supabase.table('race_splits').insert(all_splits_data).execute()
                                        logger.info(f"[SYNC TASK]   Successfully inserted splits")
                                
                            except Exception as e:
                                import traceback
                                logger.error(f"[SYNC TASK]   Error during bulk upsert: {e}")
                                logger.error(f"[SYNC TASK]   Traceback: {traceback.format_exc()}")
                                stats['errors'] += len(workout_results_to_upsert)
                
                except Exception as e:
                    logger.warning(f"[SYNC TASK]   Error fetching event results: {e}")
                    stats['errors'] += 1
                    continue
                
                # Update progress after each event
                supabase.table('swimmer_external_links').update({
                    'sync_progress': stats['events_processed'],
                    'results_count': stats['results_imported']
                }).eq('id', external_link_id).execute()
                
                # Small delay between events to be polite
                await asyncio.sleep(0.5)
                
            except Exception as e:
                logger.warning(f"[SYNC TASK] Error processing event {event_name}: {e}")
                stats['errors'] += 1
                
                # Update progress even on error
                supabase.table('swimmer_external_links').update({
                    'sync_progress': stats['events_processed']
                }).eq('id', external_link_id).execute()
                
                continue
        
        # Check final status before marking as completed
        final_status_check = supabase.table('swimmer_external_links').select('sync_status').eq('id', external_link_id).single().execute()
        
        if final_status_check.data and final_status_check.data.get('sync_status') == 'cancelled':
            logger.info(f"[SYNC TASK] Sync was cancelled, not marking as completed")
            stats['success'] = False
            supabase.table('swimmer_external_links').update({
                'last_sync_completed_at': datetime.utcnow().isoformat()
            }).eq('id', external_link_id).execute()
        else:
            # Mark as completed
            stats['success'] = True
            supabase.table('swimmer_external_links').update({
                'sync_status': 'completed',
                'last_sync_at': datetime.utcnow().isoformat(),
                'last_sync_completed_at': datetime.utcnow().isoformat(),
                'results_count': stats['results_imported'],
                'sync_error': None
            }).eq('id', external_link_id).execute()
        
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
        
        # Mark as failed
        try:
            supabase.table('swimmer_external_links').update({
                'sync_status': 'failed',
                'last_sync_completed_at': datetime.utcnow().isoformat(),
                'sync_error': error_msg[:500]  # Limit error message length
            }).eq('id', external_link_id).execute()
        except Exception as update_error:
            logger.error(f"[SYNC TASK] Failed to update error status: {update_error}")
    
    return stats


def start_swimmer_sync(
    swimmer_id: str,
    external_link_id: str,
    external_id: str,
    limit_events: Optional[int] = None
) -> None:
    """
    Synchronous wrapper to start async swimmer sync
    Called from FastAPI BackgroundTasks
    
    Args:
        swimmer_id: Database swimmer ID
        external_link_id: swimmer_external_links table ID
        external_id: SwimRankings athlete ID
        limit_events: Limit number of events to sync
    """
    asyncio.run(sync_swimmer_data(swimmer_id, external_link_id, external_id, limit_events))
