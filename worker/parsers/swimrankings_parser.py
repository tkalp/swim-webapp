"""
SwimRankings HTML parsing functions
"""

import logging
from typing import List, Dict, Optional, Tuple
from bs4 import BeautifulSoup

from worker.models import AttemptData, RaceSplit, ResultWithSplits


logger = logging.getLogger('swimrankings_parser')


class SwimRankingsParser:
    """Parser for SwimRankings.net HTML pages"""
    
    @staticmethod
    def parse_event_attempts(soup: BeautifulSoup) -> List[AttemptData]:
        """
        Parse attempts from athlete detail page
        
        Args:
            soup: BeautifulSoup object of athlete detail page
            
        Returns:
            List of AttemptData objects
        """
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
                    
                    # Skip if doesn't look like a valid result
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
                    
                    attempt = AttemptData(
                        time=time_text,
                        points=int(points_clean) if points_clean else 0,
                        date=date_text,
                        location=location_text,
                        meet_name=location_text,
                        course=current_course,
                        result_id=result_id,
                        meet_link=meet_link
                    )
                    
                    attempts.append(attempt)
                    parsed_count += 1
                    
                except (ValueError, IndexError) as e:
                    logger.debug(f"Failed to parse attempt row: {e}")
                    skipped_count += 1
                    continue
            
            logger.info(f"Table {table_idx}: Successfully parsed {parsed_count} attempt(s), skipped {skipped_count} row(s)")
        
        return attempts
    
    @staticmethod
    def parse_result_splits(soup: BeautifulSoup) -> Dict:
        """
        Parse splits from result detail page
        
        Args:
            soup: BeautifulSoup object of result detail page
            
        Returns:
            Dictionary with 'reaction_time' and 'splits' keys
        """
        reaction_time = None
        splits: List[RaceSplit] = []
        
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
                        
                        split_seconds = SwimRankingsParser._time_to_seconds(split_time_text)
                        cumulative_seconds = SwimRankingsParser._time_to_seconds(cumulative_time_text)
                        
                        if split_seconds > 0:
                            split_order += 1
                            splits.append(RaceSplit(
                                split_distance=distance,
                                split_time=split_seconds,
                                cumulative_time=cumulative_seconds,
                                split_order=split_order
                            ))
                        
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
    
    @staticmethod
    def _time_to_seconds(time_str: str) -> float:
        """
        Convert time string to seconds
        
        Args:
            time_str: Time string (e.g., '1:23.45')
            
        Returns:
            Time in seconds (e.g., 83.45)
        """
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
    
    @staticmethod
    def parse_city_nation(location: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Parse location string into city and nation
        
        Args:
            location: Location string (e.g., "Paris (FRA)")
            
        Returns:
            Tuple of (city, nation)
        """
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
