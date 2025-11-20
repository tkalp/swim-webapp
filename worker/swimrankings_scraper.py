"""
SwimRankings.net scraping service
Handles all data fetching from SwimRankings
"""

import requests
from bs4 import BeautifulSoup # type: ignore
from typing import List, Dict, Optional, Tuple
from datetime import datetime
import re
import asyncio
import random
import time
from concurrent.futures import ThreadPoolExecutor
import logging

try:
    from worker.database import get_supabase_client
except ImportError:
    get_supabase_client = None

logger = logging.getLogger('swimrankings_scraper')


class SwimRankingsScraper:
    """Service for scraping SwimRankings.net"""
    
    BASE_URL = "https://www.swimrankings.net"
    
    def __init__(self, max_workers: Optional[int] = None):
        """Initialize scraper with dynamic worker count"""
        # Limit to 4 workers to reduce memory usage (each worker uses ~150-200 MB)
        import multiprocessing
        if max_workers is None:
            cpu_count = multiprocessing.cpu_count()
            max_workers = min(cpu_count * 2, 4)  # Cap at 4 workers instead of 10
        
        self.MAX_WORKERS = max_workers
        print(f"[SCRAPER] Using {self.MAX_WORKERS} parallel workers")
        
        # Rate limiting configuration - optimized for speed while being respectful
        self.MIN_DELAY = 0.1  # Reduced minimum delay between requests
        self.MAX_DELAY = 0.5  # Reduced maximum delay between requests
        self.BASE_RETRY_DELAY = 1.0  # Reduced retry delay
        self.MAX_RETRIES = 3  # Maximum retry attempts for failed requests
        
        self.session = requests.Session()
        # Rotate between different realistic user agents
        self.user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
        ]
        self.request_count = 0
        self.last_request_time = 0
        # Set initial user agent
        user_agent = random.choice(self.user_agents)
        self.session.headers.update({'User-Agent': user_agent})
    
    def _set_random_user_agent(self):
        """Rotate to a random user agent to appear more human-like"""
        user_agent = random.choice(self.user_agents)
        self.session.headers.update({'User-Agent': user_agent})
        logger.debug(f"Using user agent: {user_agent[:50]}...")
    
    async def _rate_limit_delay(self):
        """Apply intelligent rate limiting with random jitter"""
        # Add random delay between MIN_DELAY and MAX_DELAY
        delay = random.uniform(self.MIN_DELAY, self.MAX_DELAY)
        
        # Occasionally add a longer pause to simulate human browsing behavior
        if random.random() < 0.1:  # 10% chance of longer pause
            delay += random.uniform(1.0, 3.0)
            logger.debug(f"Adding extended pause: {delay:.2f}s (simulating human behavior)")
        
        # Ensure minimum time between requests
        if self.last_request_time > 0:
            elapsed = time.time() - self.last_request_time
            if elapsed < delay:
                wait_time = delay - elapsed
                logger.debug(f"Rate limiting: waiting {wait_time:.2f}s")
                await asyncio.sleep(wait_time)
        
        self.last_request_time = time.time()
        self.request_count += 1
        
        # Rotate user agent every 10-20 requests to appear more natural
        if self.request_count % random.randint(10, 20) == 0:
            self._set_random_user_agent()
    
    async def fetch_event_attempts(
        self,
        athlete_id: str,
        style_id: str,
        limit: Optional[int] = None,
        skip_no_splits: bool = False,
        external_link_id: Optional[str] = None
    ) -> List[Dict]:
        """
        Fetch all attempts for a specific event using Playwright
        
        Args:
            athlete_id: SwimRankings athlete ID
            style_id: Event style ID
            limit: Maximum number of results to fetch (None = all)
            skip_no_splits: If True, only include results that have splits
            external_link_id: Optional external link ID to check for cancellation
            
        Returns:
            List of event results with attempts and splits
        """
        logger.info(f"Starting event attempts fetch: athlete_id={athlete_id}, style_id={style_id}, limit={limit}, skip_no_splits={skip_no_splits}")
        
        # Check for cancellation BEFORE any expensive operations
        if external_link_id and get_supabase_client:
            try:
                supabase = get_supabase_client()
                status_check = supabase.table('swimmer_external_links').select('sync_status').eq('id', external_link_id).maybe_single().execute()
                if not status_check.data or status_check.data.get('sync_status') == 'cancelled':
                    logger.info(f"Sync cancelled before fetching event attempts")
                    raise asyncio.CancelledError("Sync cancelled by user")
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.debug(f"Error checking cancellation: {e}")
        
        url = f"{self.BASE_URL}/index.php?page=athleteDetail&athleteId={athlete_id}&styleId={style_id}"
        
        try:
            # Run Playwright in a separate thread to avoid Windows asyncio subprocess issues
            loop = asyncio.get_event_loop()
            
            with ThreadPoolExecutor(max_workers=self.MAX_WORKERS) as executor:
                # Fetch main page
                logger.info(f"Fetching athlete detail page: {url}")
                html = await loop.run_in_executor(
                    executor,
                    self._fetch_page_sync,
                    url
                )
                logger.info(f"Successfully fetched page, HTML size: {len(html)} bytes")
                
                soup = BeautifulSoup(html, 'html.parser')
                
                # Parse attempts
                logger.info("Parsing event attempts from page...")
                attempts = self._parse_event_attempts(soup)
                logger.info(f"Found {len(attempts)} total attempt(s) on page")
                
                if limit:
                    original_count = len(attempts)
                    attempts = attempts[:limit]
                    logger.info(f"Limiting results from {original_count} to {len(attempts)} attempt(s)")
                
                # Conditionally fetch splits based on skip_no_splits flag
                if skip_no_splits:
                    logger.info(f"Skipping splits fetch for {len(attempts)} attempt(s) (skip_no_splits=True)")
                    # Return results without splits for maximum speed
                    all_results = [
                        {
                            'attempt': attempt,
                            'reaction_time': None,
                            'splits': []
                        }
                        for attempt in attempts
                    ]
                else:
                    # Fetch splits for all attempts in parallel with semaphore for rate limiting
                    logger.info(f"Fetching splits for {len(attempts)} attempt(s) using {self.MAX_WORKERS} parallel workers...")
                    semaphore = asyncio.Semaphore(self.MAX_WORKERS)
                    
                    async def fetch_splits_with_semaphore(idx: int, attempt: Dict) -> Dict:
                        """Fetch splits for a single attempt with rate limiting"""
                        async with semaphore:
                            # Check for cancellation before fetching each split
                            if external_link_id and get_supabase_client:
                                try:
                                    supabase = get_supabase_client()
                                    status_check = supabase.table('swimmer_external_links').select('sync_status').eq('id', external_link_id).maybe_single().execute()
                                    if not status_check.data or status_check.data.get('sync_status') == 'cancelled':
                                        logger.info(f"[{idx}/{len(attempts)}] Sync cancelled, stopping splits fetch")
                                        # Return empty result to stop gracefully
                                        raise asyncio.CancelledError("Sync cancelled by user")
                                except asyncio.CancelledError:
                                    raise
                                except Exception as e:
                                    logger.debug(f"Error checking cancellation: {e}")
                            
                            logger.info(f"[{idx}/{len(attempts)}] Processing attempt: {attempt.get('time')} on {attempt.get('date')} at {attempt.get('location')}")
                            
                            result = {
                                'attempt': attempt,
                                'reaction_time': None,
                                'splits': []
                            }
                            
                            if attempt.get('result_id'):
                                # Apply intelligent rate limiting
                                await self._rate_limit_delay()
                                
                                logger.info(f"[{idx}/{len(attempts)}] Fetching splits for result_id={attempt['result_id']}")
                                splits_data = await loop.run_in_executor(
                                    executor,
                                    self._fetch_splits_sync,
                                    attempt['result_id']
                                )
                                result['reaction_time'] = splits_data.get('reaction_time')
                                result['splits'] = splits_data.get('splits', [])
                                
                                if result['splits']:
                                    logger.info(f"[{idx}/{len(attempts)}] Found {len(result['splits'])} split(s)" + 
                                              (f" (reaction time: {result['reaction_time']}s)" if result['reaction_time'] else ""))
                                else:
                                    logger.debug(f"[{idx}/{len(attempts)}] No splits found for this result")
                            else:
                                logger.debug(f"[{idx}/{len(attempts)}] No result_id available, skipping splits fetch")
                            
                            return result
                    
                    # Fetch all splits in parallel
                    tasks = [fetch_splits_with_semaphore(idx + 1, attempt) for idx, attempt in enumerate(attempts)]
                    all_results = await asyncio.gather(*tasks)
                
                # Count results without result_id for logging
                results = all_results
                skipped_no_result_id = sum(1 for r in results if not r['attempt'].get('result_id'))
            
            logger.info(f"Event attempts fetch complete: {len(results)} result(s) returned" +
                       (f", {skipped_no_result_id} without result_id" if skipped_no_result_id > 0 else ""))
            return results
            
        except Exception as e:
            logger.error(f"Failed to fetch event attempts: {str(e)}", exc_info=True)
            raise
    
    def _fetch_page_sync(self, url: str, retry_count: int = 0) -> str:
        """Fetch page content using Playwright (runs in thread) with retry logic"""
        from playwright.sync_api import sync_playwright, TimeoutError # type: ignore
        
        try:
            logger.debug(f"Launching Playwright browser for: {url}")
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(
                    # Add realistic browser context
                    viewport={'width': 1920, 'height': 1080},
                    user_agent=random.choice(self.user_agents)
                )
                page = context.new_page()
                
                logger.debug("Navigating to page and waiting for network idle...")
                page.goto(url, wait_until="networkidle", timeout=30000)
                
                # Simulate human-like behavior: small random delay before reading content
                time.sleep(random.uniform(0.1, 0.3))
                
                html = page.content()
                browser.close()
                logger.debug("Browser closed, page content retrieved")
            
            return html
            
        except (TimeoutError, Exception) as e:
            logger.warning(f"Error fetching page (attempt {retry_count + 1}/{self.MAX_RETRIES}): {e}")
            
            if retry_count < self.MAX_RETRIES:
                # Exponential backoff with jitter
                delay = self.BASE_RETRY_DELAY * (2 ** retry_count) + random.uniform(0, 1)
                logger.info(f"Retrying in {delay:.2f}s...")
                time.sleep(delay)
                return self._fetch_page_sync(url, retry_count + 1)
            else:
                logger.error(f"Failed to fetch page after {self.MAX_RETRIES} attempts")
                raise
    
    def _fetch_splits_sync(self, result_id: str, retry_count: int = 0) -> Dict:
        """Fetch splits using Playwright (runs in thread) with retry logic"""
        from playwright.sync_api import sync_playwright, TimeoutError # type: ignore
        
        url = f"{self.BASE_URL}/index.php?page=resultDetail&id={result_id}"
        
        try:
            logger.debug(f"Fetching splits page for result_id={result_id}")
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(
                    viewport={'width': 1920, 'height': 1080},
                    user_agent=random.choice(self.user_agents)
                )
                page = context.new_page()
                page.goto(url, wait_until="networkidle", timeout=30000)
                
                # Small random delay to simulate human reading
                time.sleep(random.uniform(0.1, 0.3))
                
                html = page.content()
                browser.close()
            
            soup = BeautifulSoup(html, 'html.parser')
            splits_data = self._parse_result_splits(soup)
            
            split_count = len(splits_data.get('splits', []))
            reaction = splits_data.get('reaction_time')
            logger.debug(f"Parsed splits for result_id={result_id}: {split_count} split(s), reaction_time={reaction}")
            
            return splits_data
            
        except (TimeoutError, Exception) as e:
            logger.warning(f"Error fetching splits (attempt {retry_count + 1}/{self.MAX_RETRIES}): {e}")
            
            if retry_count < self.MAX_RETRIES:
                delay = self.BASE_RETRY_DELAY * (2 ** retry_count) + random.uniform(0, 1)
                logger.info(f"Retrying in {delay:.2f}s...")
                time.sleep(delay)
                return self._fetch_splits_sync(result_id, retry_count + 1)
            else:
                logger.error(f"Failed to fetch splits for result {result_id} after {self.MAX_RETRIES} attempts")
                return {'reaction_time': None, 'splits': []}
    
    def _parse_event_attempts(self, soup: BeautifulSoup) -> List[Dict]:
        """Parse attempts from athlete detail page"""
        attempts = []
        
        # Find tables with class="athleteRanking"
        ranking_tables = soup.find_all('table', class_='athleteRanking')
        
        if not ranking_tables:
            logger.warning("No athleteRanking tables found on page")
            return attempts
        
        logger.info(f"Found {len(ranking_tables)} athleteRanking table(s)")
        
        for table_idx, table in enumerate(ranking_tables, 1):
            rows = table.find_all('tr')
            if not rows:
                logger.debug(f"Table {table_idx}: No rows found")
                continue
            
            # Get course from first row
            course_row = rows[0]
            course_text = course_row.get_text(strip=True)
            
            if 'Long Course' in course_text:
                current_course = 'Long Course (50m)'
            elif 'Short Course' in course_text:
                current_course = 'Short Course (25m)'
            else:
                logger.debug(f"Table {table_idx}: Skipping table with unknown course: {course_text}")
                continue
            
            logger.info(f"Table {table_idx}: Parsing {current_course} results ({len(rows)-1} data row(s))")
            
            # Parse data rows (skip first row which is the header)
            parsed_count = 0
            skipped_count = 0
            for row in rows[1:]:
                cells = row.find_all('td')
                if len(cells) < 4:
                    skipped_count += 1
                    continue
                
                try:
                    # Column indices: 0=time, 1=points, 2=date, 3=location
                    time_text = cells[0].get_text(strip=True)
                    points_text = cells[1].get_text(strip=True)
                    date_text = cells[2].get_text(strip=True)
                    location_text = cells[3].get_text(strip=True)
                    
                    # Skip if doesn't look like a valid result (should have time with numbers and possibly :)
                    if not time_text or not any(c.isdigit() for c in time_text):
                        logger.debug(f"Skipping row - invalid time format: '{time_text}'")
                        skipped_count += 1
                        continue
                    
                    # Extract result ID from link in time cell
                    result_id = None
                    result_link = cells[0].find('a')
                    if result_link and 'href' in result_link.attrs:
                        href = result_link['href']
                        if 'id=' in href:
                            result_id = href.split('id=')[1].split('&')[0]
                    
                    # Extract meet link from date cell
                    meet_link = None
                    meet_cell_link = cells[2].find('a')
                    if meet_cell_link and 'href' in meet_cell_link.attrs:
                        meet_link = meet_cell_link['href']
                    
                    # Clean up points
                    points_clean = ''.join(filter(str.isdigit, points_text))
                    
                    attempt = {
                        'time': time_text,
                        'points': int(points_clean) if points_clean else 0,
                        'date': date_text,
                        'location': location_text,
                        'meet_name': location_text,
                        'course': current_course,
                        'result_id': result_id,
                        'meet_link': meet_link
                    }
                    
                    attempts.append(attempt)
                    parsed_count += 1
                    
                except (ValueError, IndexError) as e:
                    logger.debug(f"Failed to parse attempt row: {e}")
                    skipped_count += 1
                    continue
            
            logger.info(f"Table {table_idx}: Successfully parsed {parsed_count} attempt(s), skipped {skipped_count} row(s)")
        
        return attempts
    
    def _parse_result_splits(self, soup: BeautifulSoup) -> Dict:
        """Parse splits from result detail page"""
        reaction_time = None
        splits = []
        
        # Find all table cells
        all_cells = soup.find_all(['td', 'th'])
        
        # Look for "Split times" label
        split_section_start = None
        for idx, cell in enumerate(all_cells):
            if 'Split times' in cell.get_text(strip=True):
                split_section_start = idx
                break
        
        if split_section_start is None:
            return {'reaction_time': None, 'splits': []}
        
        # Look for reaction time
        for i in range(split_section_start + 1, min(split_section_start + 5, len(all_cells))):
            cell_text = all_cells[i].get_text(strip=True)
            if 'Reaction time:' in cell_text:
                try:
                    parts = cell_text.split(':')
                    if len(parts) > 1:
                        time_str = parts[1].strip().replace('+', '')
                        if '--' not in time_str:
                            reaction_time = float(time_str)
                except (ValueError, IndexError):
                    pass
                break
        
        # Parse splits
        i = split_section_start + 1
        split_order = 0
        
        while i < len(all_cells):
            cell_text = all_cells[i].get_text(strip=True)
            
            # Check for distance marker (e.g., "50m", "100m")
            if 'm' in cell_text and len(cell_text) <= 10:
                try:
                    distance = int(''.join(filter(str.isdigit, cell_text)))
                    
                    if distance > 0 and i + 3 < len(all_cells):
                        split_time_text = all_cells[i + 1].get_text(strip=True)
                        cumulative_time_text = all_cells[i + 3].get_text(strip=True)
                        
                        split_seconds = self._time_to_seconds(split_time_text)
                        cumulative_seconds = self._time_to_seconds(cumulative_time_text)
                        
                        if split_seconds > 0:
                            split_order += 1
                            splits.append({
                                'split_distance': distance,
                                'split_time': split_seconds,
                                'cumulative_time': cumulative_seconds,
                                'split_order': split_order
                            })
                        
                        i += 4
                        continue
                        
                except (ValueError, IndexError):
                    pass
            
            # Stop if we hit "Places in rankings"
            if 'Places in rankings' in cell_text or 'ranking' in cell_text.lower():
                break
            
            i += 1
        
        return {
            'reaction_time': reaction_time,
            'splits': splits
        }
    
    def _time_to_seconds(self, time_str: str) -> float:
        """Convert time string to seconds (e.g., '1:23.45' -> 83.45)"""
        time_str = time_str.strip()
        
        try:
            if ':' in time_str:
                parts = time_str.split(':')
                if len(parts) == 2:
                    minutes = int(parts[0])
                    seconds = float(parts[1])
                    return minutes * 60 + seconds
                elif len(parts) == 3:
                    hours = int(parts[0])
                    minutes = int(parts[1])
                    seconds = float(parts[2])
                    return hours * 3600 + minutes * 60 + seconds
                else:
                    return 0.0
            else:
                return float(time_str)
        except ValueError:
            return 0.0
    
    def _parse_city_nation(self, location: str) -> Tuple[Optional[str], Optional[str]]:
        """Parse location string into city and nation"""
        if not location:
            return None, None
        
        # Format is typically "City (NATION)"
        if '(' in location:
            parts = location.split('(')
            city = parts[0].strip()
            nation = parts[1].replace(')', '').strip()
            return city, nation
        else:
            # No nation in parentheses, treat whole thing as city
            return location.strip(), None


# Event name to styleId mapping (from SwimRankings)
SWIMRANKINGS_STYLE_IDS = {
    # Freestyle
    '50m Freestyle': '1',
    '100m Freestyle': '2',
    '200m Freestyle': '3',
    '400m Freestyle': '5',
    '800m Freestyle': '6',
    '1500m Freestyle': '8',
    
    # Backstroke
    '50m Backstroke': '9',
    '100m Backstroke': '10',
    '200m Backstroke': '11',
    
    # Breaststroke
    '50m Breaststroke': '12',
    '100m Breaststroke': '13',
    '200m Breaststroke': '14',
    
    # Butterfly
    '50m Butterfly': '15',
    '100m Butterfly': '16',
    '200m Butterfly': '17',
    
    # Individual Medley
    '100m Individual Medley': '20',
    '200m Individual Medley': '18',
    '400m Individual Medley': '19',
    
    # 25m events
    '25m Freestyle': '47',
    '25m Backstroke': '48',
    '25m Breaststroke': '49',
    '25m Butterfly': '50',
    
    # Lap events
    # '50m Freestyle Lap': '57',
    # '100m Freestyle Lap': '58',
    # '200m Freestyle Lap': '59',
    # '50m Breaststroke Lap': '62',
    # '50m Butterfly Lap': '64',
    # '100m Butterfly Lap': '65',
}

# Reverse mapping for looking up event names
EVENT_TO_STYLE_ID = SWIMRANKINGS_STYLE_IDS
STYLE_ID_TO_EVENT = {v: k for k, v in SWIMRANKINGS_STYLE_IDS.items()}


def get_event_name(style_id: str) -> Optional[str]:
    """Get event name from styleId"""
    return STYLE_ID_TO_EVENT.get(style_id)


def get_style_id(event_name: str) -> Optional[str]:
    """Get styleId from event name"""
    return EVENT_TO_STYLE_ID.get(event_name)


def get_all_events() -> List[str]:
    """Get list of all supported event names"""
    return list(SWIMRANKINGS_STYLE_IDS.keys())
