"""
Sync service orchestration layer
Coordinates swimmer data synchronization
"""

import asyncio
import logging
from typing import Optional, Dict, List
from datetime import datetime

from worker.models import (
    SyncResult, 
    SyncProgress, 
    SyncStatusUpdate,
    WorkoutResult,
    RaceSplit,
    StrokeType,
    CourseType
)
from worker.services.database_service import DatabaseService
from worker.scrapers.swimrankings_scraper import SwimRankingsScraper
from worker.constants import (
    get_all_events,
    get_style_id,
    get_stroke_enum
)


logger = logging.getLogger('sync_service')


class SwimmerSyncService:
    """Service for orchestrating swimmer data synchronization"""
    
    def __init__(
        self, 
        db_service: DatabaseService,
        scraper: SwimRankingsScraper
    ):
        """
        Initialize sync service
        
        Args:
            db_service: Database service instance
            scraper: SwimRankings scraper instance
        """
        self.db = db_service
        self.scraper = scraper
    
    async def sync_swimmer(
        self,
        swimmer_id: str,
        external_link_id: str,
        external_id: str,
        limit_events: Optional[int] = None
    ) -> SyncResult:
        """
        Synchronize SwimRankings data for a single swimmer
        
        Args:
            swimmer_id: Database swimmer ID
            external_link_id: swimmer_external_links table ID
            external_id: SwimRankings athlete ID
            limit_events: Limit number of events to sync (None = all)
            
        Returns:
            SyncResult with statistics
        """
        logger.info(f"Starting sync for swimmer {swimmer_id} (athlete_id={external_id})")
        
        progress = SyncProgress()
        result = SyncResult(
            swimmer_id=swimmer_id,
            external_link_id=external_link_id,
            events_processed=0,
            results_imported=0,
            results_skipped=0,
            errors=0,
            success=False
        )
        
        try:
            # Get all swimming events
            all_events = get_all_events()
            events_to_sync = all_events[:limit_events] if limit_events else all_events
            total_events = len(events_to_sync)
            
            # Update status to in_progress with progress tracking
            self.db.update_sync_status(
                external_link_id,
                SyncStatusUpdate(
                    sync_status='in_progress',
                    last_sync_started_at=datetime.utcnow().isoformat(),
                    sync_error=None,
                    sync_progress=0,
                    sync_total=total_events
                )
            )
            
            logger.info(f"Syncing {total_events} events")
            
            # Sync each event
            for event_name in events_to_sync:
                try:
                    # Check if sync was cancelled
                    if await self._check_cancellation(external_link_id):
                        logger.info("Sync cancelled by user")
                        result.success = False
                        return result
                    
                    event_result = await self._sync_event(
                        swimmer_id=swimmer_id,
                        external_link_id=external_link_id,
                        external_id=external_id,
                        event_name=event_name
                    )
                    
                    progress.events_processed += 1
                    progress.results_imported += event_result['results_imported']
                    progress.results_skipped += event_result['results_skipped']
                    progress.errors += event_result['errors']
                    
                    # Update progress after each event for real-time feedback
                    self.db.update_sync_status(
                        external_link_id,
                        SyncStatusUpdate(
                            sync_status='in_progress',
                            sync_progress=progress.events_processed,
                            results_count=progress.results_imported
                        )
                    )
                    
                except Exception as e:
                    logger.error(f"Error processing event {event_name}: {e}")
                    progress.errors += 1
                    progress.events_processed += 1
                    
                    # Update progress even on error
                    self.db.update_sync_status(
                        external_link_id,
                        SyncStatusUpdate(
                            sync_status='in_progress',
                            sync_progress=progress.events_processed
                        )
                    )
                    continue
            
            # Check final status before marking as completed
            final_status = self.db.check_sync_status(external_link_id)
            
            if not final_status or final_status == 'cancelled':
                logger.info("Sync was cancelled")
                result.success = False
                self.db.update_sync_status(
                    external_link_id,
                    SyncStatusUpdate(
                        sync_status='cancelled',
                        last_sync_completed_at=datetime.utcnow().isoformat()
                    )
                )
            else:
                # Mark as completed
                result.success = True
                self.db.update_sync_status(
                    external_link_id,
                    SyncStatusUpdate(
                        sync_status='completed',
                        last_sync_completed_at=datetime.utcnow().isoformat(),
                        results_count=progress.results_imported,
                        sync_error=None
                    )
                )
            
            # Set final statistics
            result.events_processed = progress.events_processed
            result.results_imported = progress.results_imported
            result.results_skipped = progress.results_skipped
            result.errors = progress.errors
            
            logger.info(
                f"Completed sync for swimmer {swimmer_id}: "
                f"{result.results_imported} imported, {result.results_skipped} skipped, "
                f"{result.errors} errors"
            )
            
        except Exception as e:
            result.success = False
            result.error_message = f"{type(e).__name__}: {str(e)}"
            
            logger.error(f"Failed to sync swimmer {swimmer_id}: {result.error_message}")
            
            # Mark as failed
            self.db.update_sync_status(
                external_link_id,
                SyncStatusUpdate(
                    sync_status='failed',
                    last_sync_completed_at=datetime.utcnow().isoformat(),
                    sync_error=result.error_message[:500] if result.error_message else None
                )
            )
        
        return result
    
    async def _sync_event(
        self,
        swimmer_id: str,
        external_link_id: str,
        external_id: str,
        event_name: str
    ) -> Dict:
        """
        Sync a single event for a swimmer
        
        Args:
            swimmer_id: Database swimmer ID
            external_link_id: External link ID
            external_id: SwimRankings athlete ID
            event_name: Event name (e.g., "100m Freestyle")
            
        Returns:
            Dictionary with sync statistics for this event
        """
        stats = {
            'results_imported': 0,
            'results_skipped': 0,
            'errors': 0
        }
        
        # Parse event (e.g., "100m Freestyle")
        parts = event_name.split('m ')
        if len(parts) != 2:
            return stats
        
        distance = int(parts[0])
        stroke_name = parts[1]
        
        # Map stroke name to database enum
        stroke_enum = get_stroke_enum(stroke_name)
        if not stroke_enum:
            logger.warning(f"Unknown stroke: {stroke_name}")
            return stats
        
        # Get style_id for this event
        style_id = get_style_id(event_name)
        if not style_id:
            logger.warning(f"No style_id found for {event_name}")
            return stats
        
        logger.info(f"Fetching {event_name} (style_id={style_id})")
        
        # Check if we have ANY results for this event already
        existing_count = self.db.get_existing_result_count(swimmer_id, distance, stroke_enum)
        has_existing_data = existing_count > 0
        
        if has_existing_data:
            logger.info(f"  Found {existing_count} existing results, will check for updates")
        
        # PHASE 1: Fetch WITHOUT splits first to check what exists
        check_cancellation = lambda: self._check_cancellation(external_link_id)
        
        all_attempts = await self.scraper.fetch_event_attempts(
            athlete_id=external_id,
            style_id=style_id,
            limit=None,
            skip_no_splits=True,
            external_link_id=external_link_id,
            check_cancellation_fn=check_cancellation
        )
        
        logger.info(f"  Fetched {len(all_attempts)} total results (without splits)")
        
        if not all_attempts:
            return stats
        
        # Group results by course and process
        results_by_course = self._group_results_by_course(all_attempts)
        
        for course, attempts in results_by_course.items():
            if not attempts:
                continue
            
            event_stats = await self._process_course_results(
                swimmer_id=swimmer_id,
                external_link_id=external_link_id,
                external_id=external_id,
                attempts=attempts,
                distance=distance,
                stroke_name=stroke_name,
                stroke_enum=stroke_enum,
                course=course
            )
            
            stats['results_imported'] += event_stats['results_imported']
            stats['results_skipped'] += event_stats['results_skipped']
            stats['errors'] += event_stats['errors']
        
        return stats
    
    def _group_results_by_course(self, attempts: List) -> Dict[CourseType, List]:
        """Group results by course type (LCM/SCM)"""
        results_by_course: Dict[CourseType, List] = {'LCM': [], 'SCM': []}
        
        for attempt in attempts:
            course_text = attempt.attempt.course
            
            if 'Long Course' in course_text or '50m' in course_text:
                results_by_course['LCM'].append(attempt)
            elif 'Short Course' in course_text or '25m' in course_text:
                results_by_course['SCM'].append(attempt)
            else:
                logger.warning(f"Unknown course format: '{course_text}'")
        
        logger.info(f"  Final count: {len(results_by_course['LCM'])} LCM, {len(results_by_course['SCM'])} SCM")
        return results_by_course
    
    async def _process_course_results(
        self,
        swimmer_id: str,
        external_link_id: str,
        external_id: str,
        attempts: List,
        distance: int,
        stroke_name: str,
        stroke_enum: StrokeType,
        course: CourseType
    ) -> Dict:
        """Process results for a specific course"""
        stats = {
            'results_imported': 0,
            'results_skipped': 0,
            'errors': 0
        }
        
        logger.info(f"  Processing {len(attempts)} {course} results")
        
        # Build list of result IDs to check
        result_ids_to_check = []
        for attempt in attempts:
            attempt_data = attempt.attempt
            swimrankings_result_id = (
                f"{external_id}_{attempt_data.date}_{distance}_"
                f"{stroke_name}_{course}_{attempt_data.time}"
            )
            result_ids_to_check.append(swimrankings_result_id)
        
        # Check which ones already exist
        existing_results = self.db.check_existing_results(result_ids_to_check)
        new_result_ids = set(result_ids_to_check) - set(existing_results.keys())
        
        logger.info(f"  Found {len(existing_results)} existing, {len(new_result_ids)} new results")
        
        # Skip if no new results
        if not new_result_ids:
            logger.info(f"  All {len(attempts)} {course} results already exist")
            stats['results_skipped'] = len(attempts)
            return stats
        
        # Check for cancellation before fetching splits
        if await self._check_cancellation(external_link_id):
            logger.info("Sync cancelled, stopping")
            return stats
        
        # PHASE 2: For NEW results >50m, fetch WITH splits
        splits_map = {}
        if new_result_ids and distance > 50:
            logger.info(f"  Re-fetching {len(new_result_ids)} new results WITH splits...")
            
            check_cancellation = lambda: self._check_cancellation(external_link_id)
            attempts_with_splits = await self.scraper.fetch_event_attempts(
                athlete_id=external_id,
                style_id=get_style_id(f"{distance}m {stroke_name}"),
                limit=None,
                skip_no_splits=False,
                external_link_id=external_link_id,
                check_cancellation_fn=check_cancellation
            )
            
            # Extract splits only for NEW results
            for attempt in attempts_with_splits:
                attempt_data = attempt.attempt
                result_id = (
                    f"{external_id}_{attempt_data.date}_{distance}_"
                    f"{stroke_name}_{course}_{attempt_data.time}"
                )
                
                if result_id in new_result_ids and attempt.splits:
                    splits_map[result_id] = attempt.splits
            
            logger.info(f"  Collected splits for {len(splits_map)} new results")
        
        # Prepare and insert new results
        imported_count = await self._insert_new_results(
            swimmer_id=swimmer_id,
            attempts=attempts,
            existing_results=existing_results,
            distance=distance,
            stroke_enum=stroke_enum,
            stroke_name=stroke_name,
            course=course,
            external_id=external_id,
            splits_map=splits_map
        )
        
        stats['results_imported'] = imported_count
        return stats
    
    async def _insert_new_results(
        self,
        swimmer_id: str,
        attempts: List,
        existing_results: Dict,
        distance: int,
        stroke_enum: StrokeType,
        stroke_name: str,
        course: CourseType,
        external_id: str,
        splits_map: Dict
    ) -> int:
        """Insert new workout results with splits"""
        workout_results_to_insert = []
        splits_for_new_results = []
        
        # Prepare data for new results only
        for attempt in attempts:
            try:
                attempt_data = attempt.attempt
                
                # Generate unique result ID
                swimrankings_result_id = (
                    f"{external_id}_{attempt_data.date}_{distance}_"
                    f"{stroke_name}_{course}_{attempt_data.time}"
                )
                
                # Skip if already exists
                if swimrankings_result_id in existing_results:
                    continue
                
                # Convert time string to interval
                time_interval = self._convert_time_to_interval(attempt_data.time)
                
                # Parse date
                performed_on = self._parse_date(attempt_data.date)
                if not performed_on:
                    logger.warning(f"Could not parse date: {attempt_data.date}")
                    continue
                
                # Parse location
                city, nation = self._parse_location(attempt_data.location)
                
                # Create workout result
                workout_result = WorkoutResult(
                    swimmer_id=swimmer_id,
                    distance=distance,
                    stroke=stroke_enum,
                    time_result=time_interval,
                    result_units=course,
                    performed_on=performed_on,
                    meet_name=attempt_data.meet_name,
                    meet_city=city,
                    meet_nation=nation,
                    source='swimrankings',
                    swimrankings_result_id=swimrankings_result_id,
                    reaction_time=attempt.reaction_time,
                    activity='swim',
                    equipment='none'
                )
                
                workout_results_to_insert.append(workout_result)
                
                # Store splits info if available
                if swimrankings_result_id in splits_map:
                    splits_for_new_results.append({
                        'swimrankings_result_id': swimrankings_result_id,
                        'splits': splits_map[swimrankings_result_id]
                    })
                
            except Exception as e:
                logger.error(f"Error preparing result: {type(e).__name__}: {str(e)}")
                continue
        
        # Bulk insert workout results
        if not workout_results_to_insert:
            return 0
        
        logger.info(f"  Inserting {len(workout_results_to_insert)} new results...")
        
        inserted_records = self.db.bulk_insert_workout_results(workout_results_to_insert)
        
        if not inserted_records:
            return 0
        
        # Map inserted results to their IDs
        newly_inserted_ids = {}
        for row in inserted_records:
            newly_inserted_ids[row['swimrankings_result_id']] = row['id']
        
        # Insert splits for newly inserted results
        if splits_for_new_results:
            splits_to_insert = {}
            for split_info in splits_for_new_results:
                swimrankings_id = split_info['swimrankings_result_id']
                if swimrankings_id in newly_inserted_ids:
                    workout_result_id = newly_inserted_ids[swimrankings_id]
                    splits_to_insert[workout_result_id] = split_info['splits']
            
            if splits_to_insert:
                logger.info(f"  Bulk inserting splits for {len(splits_to_insert)} new results...")
                self.db.bulk_insert_splits_for_multiple_results(splits_to_insert)
                logger.info(f"  Successfully inserted splits")
        
        return len(inserted_records)
    
    async def _check_cancellation(self, external_link_id: str) -> bool:
        """Check if sync was cancelled"""
        status = self.db.check_sync_status(external_link_id)
        return status is None or status == 'cancelled'
    
    def _convert_time_to_interval(self, time_str: str) -> str:
        """Convert time string to PostgreSQL interval format"""
        time_parts = time_str.split(':')
        if len(time_parts) == 2:
            minutes, seconds = time_parts
            return f"00:{minutes.zfill(2)}:{seconds.zfill(5)}"
        elif len(time_parts) == 3:
            return ':'.join(time_parts)
        else:
            return f"00:00:{time_parts[0].zfill(5)}"
    
    def _parse_date(self, date_str: str) -> Optional[str]:
        """Parse date string to YYYY-MM-DD format"""
        if not date_str or not date_str.strip():
            return None
        
        date_str = date_str.strip().replace('\xa0', ' ')
        
        for fmt in ['%d/%m/%Y', '%d-%m-%Y', '%d.%m.%Y', '%Y-%m-%d', '%d %b %Y', '%d %B %Y']:
            try:
                parsed_date = datetime.strptime(date_str, fmt)
                return parsed_date.strftime('%Y-%m-%d')
            except ValueError:
                continue
        
        return None
    
    def _parse_location(self, location: str) -> tuple[Optional[str], Optional[str]]:
        """Parse location into city and nation"""
        if not location:
            return None, None
        
        if '(' in location:
            parts = location.split('(')
            city = parts[0].strip()
            nation = parts[1].replace(')', '').strip()
            return city, nation
        else:
            return location.strip() if location else None, None
