"""
Celery tasks for SwimRankings data synchronization
"""

import asyncio
from datetime import datetime
from typing import Optional
from celery import Task

# Import database from local worker directory
from worker.database import get_supabase_client

# Import scraper from local worker directory
from worker.swimrankings_scraper import SwimRankingsScraper, get_all_events, get_style_id

from worker.celery_app import celery_app


async def _fetch_splits_for_results(supabase, swimmer_id: str, external_id: str, scraper):
    """Phase 2: Fetch splits for results that don't have them yet"""
    # Get results without splits
    results_without_splits = supabase.table('workout_result').select(
        'id, swimrankings_result_id, distance, stroke, result_units'
    ).eq('swimmer_id', swimmer_id).eq('source', 'swimrankings').is_('reaction_time', 'null').limit(100).execute()
    
    if not results_without_splits.data:
        print("[SYNC TASK] No results need splits")
        return
    
    print(f"[SYNC TASK] Fetching splits for {len(results_without_splits.data)} results...")
    
    # Group by event to batch fetch
    events_map = {}
    for result in results_without_splits.data:
        event_key = f"{result['distance']}_{result['stroke']}_{result['result_units']}"
        if event_key not in events_map:
            events_map[event_key] = []
        events_map[event_key].append(result)
    
    # Fetch splits for each event group
    for event_key, results in events_map.items():
        distance, stroke, course = event_key.split('_')
        
        # Map stroke to event name
        stroke_map = {'free': 'Freestyle', 'back': 'Backstroke', 'breast': 'Breaststroke', 'fly': 'Butterfly', 'im': 'Individual Medley'}
        event_name = f"{distance}m {stroke_map.get(stroke, stroke)}"
        style_id = get_style_id(event_name)
        
        if not style_id:
            continue
        
        # Fetch with splits this time
        attempts = await scraper.fetch_event_attempts(
            athlete_id=external_id,
            style_id=style_id,
            limit=50,
            skip_no_splits=False  # Get splits now
        )
        
        # Update results with splits
        for attempt in attempts:
            if attempt.get('splits'):
                attempt_data = attempt.get('attempt', {})
                # Match by date and time
                for result in results:
                    # Simple matching - you might want to improve this
                    if attempt.get('reaction_time'):
                        try:
                            supabase.table('workout_result').update({
                                'reaction_time': attempt['reaction_time']
                            }).eq('id', result['id']).execute()
                        except:
                            pass
                    
                    # Upsert splits (insert new, ignore existing)
                    for split in attempt['splits']:
                        try:
                            supabase.table('race_splits').upsert({
                                'workout_result_id': result['id'],
                                'split_distance': split['split_distance'],
                                'split_time': split['split_time'],
                                'cumulative_time': split['cumulative_time'],
                                'split_order': split['split_order']
                            }, on_conflict='workout_result_id,split_distance', ignore_duplicates=True).execute()
                        except:
                            pass


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
                error_msg = f"{type(exc).__name__}: {str(exc)}"
                supabase.table('swimmer_external_links').update({
                    'sync_status': 'failed',
                    'last_sync_completed_at': datetime.utcnow().isoformat(),
                    'sync_error': error_msg[:500]
                }).eq('id', external_link_id).execute()
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
    # Run the async sync function
    return asyncio.run(_sync_swimmer_data(
        swimmer_id=swimmer_id,
        external_link_id=external_link_id,
        external_id=external_id,
        limit_events=limit_events
    ))


async def _sync_swimmer_data(
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
    print(f"[SYNC TASK] Starting sync for swimmer {swimmer_id} (athlete_id={external_id})")
    
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
        
        print(f"[SYNC TASK] Syncing {total_events} events")
        
        # Sync each event
        for event_name in events_to_sync:
            try:
                # Check if sync was cancelled or swimmer deleted
                try:
                    status_check = supabase.table('swimmer_external_links').select('sync_status').eq('id', external_link_id).maybe_single().execute()
                    if not status_check.data:
                        print(f"[SYNC TASK] Swimmer external link deleted, stopping sync")
                        stats['success'] = False
                        return stats
                    if status_check.data.get('sync_status') == 'cancelled':
                        print(f"[SYNC TASK] Sync cancelled by user")
                        stats['success'] = False
                        return stats
                except Exception as check_error:
                    print(f"[SYNC TASK] Error checking sync status (swimmer may be deleted): {check_error}")
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
                    print(f"[SYNC TASK] Unknown stroke: {stroke_name}")
                    continue
                
                # Get style_id for this event
                style_id = get_style_id(event_name)
                
                if not style_id:
                    print(f"[SYNC TASK] No style_id found for {event_name}")
                    continue
                
                print(f"[SYNC TASK] Fetching {event_name} (style_id={style_id})")
                
                # Check if we have ANY results for this event already
                existing_count = supabase.table('workout_result').select(
                    'id', count='exact'
                ).eq('swimmer_id', swimmer_id).eq('distance', distance).eq(
                    'stroke', stroke_enum
                ).eq('source', 'swimrankings').execute()
                
                has_existing_data = existing_count.count and existing_count.count > 0
                
                if has_existing_data:
                    print(f"[SYNC TASK]   Found {existing_count.count} existing results, will check for updates")
                
                # Fetch all results for this event in one request (no limit)
                # This avoids multiple page fetches for the same event
                try:
                    # PHASE 1: Fetch WITHOUT splits first to check what exists
                    all_attempts = await scraper.fetch_event_attempts(
                        athlete_id=external_id,
                        style_id=style_id,
                        limit=None,
                        skip_no_splits=True,  # Always skip splits initially
                        external_link_id=external_link_id
                    )
                    
                    print(f"[SYNC TASK]   Fetched {len(all_attempts)} total results (without splits)")
                    
                    if not all_attempts:
                        continue
                    
                    # Group results by course FIRST to check what exists
                    results_by_course = {'LCM': [], 'SCM': []}
                    for attempt in all_attempts:
                        attempt_data = attempt.get('attempt', {})
                        course_text = attempt_data.get('course', '')
                        
                        if 'Long Course' in course_text or '50m' in course_text:
                            results_by_course['LCM'].append(attempt)
                        elif 'Short Course' in course_text or '25m' in course_text:
                            results_by_course['SCM'].append(attempt)
                        else:
                            print(f"[SYNC TASK]   Unknown course format: '{course_text}'")
                    
                    print(f"[SYNC TASK]   Final count: {len(results_by_course['LCM'])} LCM, {len(results_by_course['SCM'])} SCM")
                    
                    # Import results for each course
                    for course, attempts in results_by_course.items():
                        if not attempts:
                            continue
                        
                        print(f"[SYNC TASK]   Processing {len(attempts)} {course} results")
                        
                        # PRE-CHECK: Build list of result IDs we're about to process
                        result_ids_to_check = []
                        for attempt in attempts:
                            attempt_data = attempt.get('attempt', {})
                            swimrankings_result_id = f"{external_id}_{attempt_data.get('date')}_{distance}_{stroke_name}_{course}_{attempt_data.get('time')}"
                            result_ids_to_check.append(swimrankings_result_id)
                        
                        # Check which ones already exist BEFORE processing
                        existing_check = supabase.table('workout_result').select('id, swimrankings_result_id').in_(
                            'swimrankings_result_id', result_ids_to_check
                        ).execute()
                        
                        existing_results = {row['swimrankings_result_id']: row['id'] for row in existing_check.data} if existing_check.data else {}
                        new_result_ids = set(result_ids_to_check) - set(existing_results.keys())
                        
                        print(f"[SYNC TASK]   Found {len(existing_results)} existing, {len(new_result_ids)} new results")
                        
                        # Check for cancellation before potentially expensive split fetch
                        try:
                            status_check = supabase.table('swimmer_external_links').select('sync_status').eq('id', external_link_id).maybe_single().execute()
                            if not status_check.data or status_check.data.get('sync_status') == 'cancelled':
                                print(f"[SYNC TASK] Sync cancelled, stopping")
                                stats['success'] = False
                                return stats
                        except Exception as e:
                            print(f"[SYNC TASK] Error checking cancellation: {e}")
                        
                        # PHASE 2: For NEW results >50m, fetch WITH splits
                        splits_map = {}
                        if new_result_ids and distance > 50:
                            print(f"[SYNC TASK]   Re-fetching {len(new_result_ids)} new results WITH splits...")
                            
                            # Re-fetch the entire event WITH splits this time
                            attempts_with_splits = await scraper.fetch_event_attempts(
                                athlete_id=external_id,
                                style_id=style_id,
                                limit=None,
                                skip_no_splits=False,
                                external_link_id=external_link_id
                            )
                            
                            # Extract splits only for NEW results
                            for attempt in attempts_with_splits:
                                attempt_data = attempt.get('attempt', {})
                                result_id = f"{external_id}_{attempt_data.get('date')}_{distance}_{stroke_name}_{course}_{attempt_data.get('time')}"
                                
                                if result_id in new_result_ids and attempt.get('splits'):
                                    splits_map[result_id] = attempt['splits']
                            
                            print(f"[SYNC TASK]   Collected splits for {len(splits_map)} new results")
                        
                        # Skip if no new results to insert
                        if not new_result_ids:
                            print(f"[SYNC TASK]   All {len(attempts)} {course} results already exist")
                            stats['results_skipped'] += len(attempts)
                            continue
                        
                        print(f"[SYNC TASK]   Processing {len(new_result_ids)} new results...")
                        
                        # Check for cancellation before processing results
                        try:
                            status_check = supabase.table('swimmer_external_links').select('sync_status').eq('id', external_link_id).maybe_single().execute()
                            if not status_check.data or status_check.data.get('sync_status') == 'cancelled':
                                print(f"[SYNC TASK] Sync cancelled, stopping")
                                stats['success'] = False
                                return stats
                        except Exception as e:
                            print(f"[SYNC TASK] Error checking cancellation: {e}")
                        
                        # Prepare bulk data for new results only
                        workout_results_to_upsert = []
                        splits_for_new_results = []  # Only collect splits for new results
                        
                        # Import each attempt (skip ones that already exist)
                        for attempt in attempts:
                            try:
                                attempt_data = attempt.get('attempt', {})
                                
                                # Generate unique result ID
                                swimrankings_result_id = f"{external_id}_{attempt_data.get('date')}_{distance}_{stroke_name}_{course}_{attempt_data.get('time')}"
                                
                                # Skip if already exists
                                if swimrankings_result_id in existing_results:
                                    continue
                                
                                # Convert time string to interval
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
                                date_str = attempt_data.get('date')
                                if date_str and date_str.strip():
                                    date_str = date_str.strip().replace('\xa0', ' ')
                                    for fmt in ['%d/%m/%Y', '%d-%m-%Y', '%d.%m.%Y', '%Y-%m-%d', '%d %b %Y', '%d %B %Y']:
                                        try:
                                            parsed_date = datetime.strptime(date_str, fmt)
                                            performed_on = parsed_date.strftime('%Y-%m-%d')
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
                                
                                # Store splits info (will use splits_map for actual splits)
                                if swimrankings_result_id in splits_map:
                                    splits_for_new_results.append({
                                        'swimrankings_result_id': swimrankings_result_id,
                                        'splits': splits_map[swimrankings_result_id]
                                    })
                                
                            except Exception as e:
                                print(f"[SYNC TASK]   Error preparing result: {type(e).__name__}: {str(e)}")
                                stats['errors'] += 1
                                continue
                        
                        # Bulk insert workout_results (all are new since we filtered above)
                        if workout_results_to_upsert:
                            # Check for cancellation before database insert
                            try:
                                status_check = supabase.table('swimmer_external_links').select('sync_status').eq('id', external_link_id).maybe_single().execute()
                                if not status_check.data or status_check.data.get('sync_status') == 'cancelled':
                                    print(f"[SYNC TASK] Sync cancelled before insert, stopping")
                                    stats['success'] = False
                                    return stats
                            except Exception as e:
                                print(f"[SYNC TASK] Error checking cancellation: {e}")
                            
                            try:
                                print(f"[SYNC TASK]   Inserting {len(workout_results_to_upsert)} new results...")
                                
                                # Insert all (we already filtered out existing ones)
                                insert_result = supabase.table('workout_result').insert(workout_results_to_upsert).execute()
                                
                                if insert_result.data:
                                    # Map inserted results to their IDs
                                    newly_inserted_ids = {}
                                    for row in insert_result.data:
                                        newly_inserted_ids[row['swimrankings_result_id']] = row['id']
                                    stats['results_imported'] += len(insert_result.data)
                                    
                                    # Only insert splits for NEWLY inserted workout_results
                                    # Skip splits for existing results (they already have splits)
                                    if splits_for_new_results:
                                        all_new_splits = []
                                        
                                        for split_info in splits_for_new_results:
                                            swimrankings_id = split_info['swimrankings_result_id']
                                            # Only process splits for results we just inserted
                                            if swimrankings_id in newly_inserted_ids:
                                                workout_result_id = newly_inserted_ids[swimrankings_id]
                                                for split in split_info['splits']:
                                                    all_new_splits.append({
                                                        'workout_result_id': workout_result_id,
                                                        'split_distance': split['split_distance'],
                                                        'split_time': split['split_time'],
                                                        'cumulative_time': split['cumulative_time'],
                                                        'split_order': split['split_order']
                                                    })
                                        
                                        if all_new_splits:
                                            print(f"[SYNC TASK]   Bulk inserting {len(all_new_splits)} splits for {len(newly_inserted_ids)} new results...")
                                            try:
                                                supabase.table('race_splits').insert(
                                                    all_new_splits,
                                                    returning='minimal'
                                                ).execute()
                                                print(f"[SYNC TASK]   Successfully inserted {len(all_new_splits)} splits")
                                            except Exception as splits_error:
                                                print(f"[SYNC TASK]   Error inserting splits: {splits_error}")
                                
                            except Exception as e:
                                print(f"[SYNC TASK]   Error during bulk upsert: {e}")
                                stats['errors'] += len(workout_results_to_upsert)
                
                except asyncio.CancelledError:
                    # Sync was cancelled, stop immediately
                    print(f"[SYNC TASK]   Sync cancelled during event fetch")
                    stats['success'] = False
                    return stats
                except Exception as e:
                    print(f"[SYNC TASK]   Error fetching event results: {e}")
                    stats['errors'] += 1
                    continue
                
                # Check for cancellation after each event
                try:
                    status_check = supabase.table('swimmer_external_links').select('sync_status').eq('id', external_link_id).maybe_single().execute()
                    if not status_check.data or status_check.data.get('sync_status') == 'cancelled':
                        print(f"[SYNC TASK] Sync cancelled after event {event_name}, stopping")
                        stats['success'] = False
                        return stats
                except Exception as e:
                    print(f"[SYNC TASK] Error checking cancellation: {e}")
                
                # Update progress after each event for real-time feedback
                supabase.table('swimmer_external_links').update({
                    'sync_progress': stats['events_processed'],
                    'results_count': stats['results_imported']
                }).eq('id', external_link_id).execute()
                
            except Exception as e:
                print(f"[SYNC TASK] Error processing event {event_name}: {e}")
                stats['errors'] += 1
                
                # Update progress even on error
                supabase.table('swimmer_external_links').update({
                    'sync_progress': stats['events_processed']
                }).eq('id', external_link_id).execute()
                
                continue
        
        # Check final status before marking as completed
        try:
            final_status_check = supabase.table('swimmer_external_links').select('sync_status').eq('id', external_link_id).maybe_single().execute()
            
            if not final_status_check.data:
                print(f"[SYNC TASK] Swimmer external link deleted during sync")
                stats['success'] = False
                return stats
            
            if final_status_check.data.get('sync_status') == 'cancelled':
                print(f"[SYNC TASK] Sync was cancelled")
                stats['success'] = False
                supabase.table('swimmer_external_links').update({
                    'last_sync_completed_at': datetime.utcnow().isoformat()
                }).eq('id', external_link_id).execute()
        except Exception as status_error:
            print(f"[SYNC TASK] Error checking final status (swimmer may be deleted): {status_error}")
            stats['success'] = False
            return stats
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
            
            # Phase 2 disabled - splits are now inserted in Phase 1
            # No need for separate phase since we're getting splits during initial fetch
        
        print(
            f"[SYNC TASK] Completed sync for swimmer {swimmer_id}: "
            f"{stats['results_imported']} imported, {stats['results_skipped']} skipped, "
            f"{stats['errors']} errors"
        )
        
    except Exception as e:
        stats['success'] = False
        error_msg = f"{type(e).__name__}: {str(e)}"
        
        print(f"[SYNC TASK] Failed to sync swimmer {swimmer_id}: {error_msg}")
        
        # Mark as failed
        try:
            supabase.table('swimmer_external_links').update({
                'sync_status': 'failed',
                'last_sync_completed_at': datetime.utcnow().isoformat(),
                'sync_error': error_msg[:500]
            }).eq('id', external_link_id).execute()
        except Exception as update_error:
            print(f"[SYNC TASK] Failed to update error status: {update_error}")
    
    return stats
