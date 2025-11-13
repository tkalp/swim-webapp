"""
SwimRankings.net integration service - Search only
Result scraping has been moved to the jobs folder (sync_swimrankings.py)
"""

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup
from typing import List, Dict
import asyncio
from concurrent.futures import ThreadPoolExecutor
from app.utils import logger, log_error


class SwimRankingsScraper:
    """Service for searching SwimRankings.net (result scraping in jobs folder)"""
    
    BASE_URL = "https://www.swimrankings.net"
    
    def _search_swimmer_sync(self, firstname: str, lastname: str) -> List[Dict]:
        """
        Synchronous search function to run in thread pool
        """
        search_url = f"{self.BASE_URL}/index.php"
        params = {
            'internalRequest': 'athleteFind',
            'athlete_clubId': '-1',  # Worldwide
            'athlete_gender': '-1',  # All genders
            'athlete_lastname': lastname,
            'athlete_firstname': firstname,
        }
        
        # Build full URL with params
        param_string = '&'.join([f"{k}={v}" for k, v in params.items()])
        full_url = f"{search_url}?{param_string}"
        
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            
            # Navigate to search URL
            page.goto(full_url, wait_until="networkidle", timeout=30000)
            
            # Get the HTML content
            html = page.content()
            browser.close()
            
            soup = BeautifulSoup(html, 'lxml')
            results = self._parse_search_results(soup)
            
            return results
    
    async def search_swimmer(self, firstname: str, lastname: str) -> List[Dict]:
        """
        Search for swimmers on SwimRankings using Playwright in thread pool
        
        Args:
            firstname: Swimmer's first name
            lastname: Swimmer's last name
            
        Returns:
            List of matching swimmers
        """
        logger.info(f"Searching SwimRankings for: {firstname} {lastname}")
        
        try:
            # Run Playwright in thread pool to avoid event loop issues
            loop = asyncio.get_event_loop()
            with ThreadPoolExecutor() as executor:
                results = await loop.run_in_executor(
                    executor,
                    self._search_swimmer_sync,
                    firstname,
                    lastname
                )
            
            logger.info(f"Found {len(results)} swimmer(s) on SwimRankings")
            return results
            
        except Exception as e:
            log_error(e, context="swimrankings_search", firstname=firstname, lastname=lastname)
            return []
    
    def _parse_search_results(self, soup: BeautifulSoup) -> List[Dict]:
        """Parse SwimRankings search results"""
        swimmers = []
        
        search_table = soup.find('table', class_='athleteSearch')
        if not search_table:
            return swimmers
        
        rows = search_table.find_all('tr', class_=lambda c: c and c.startswith('athleteSearch') and c != 'athleteSearchHead')
        
        for row in rows:
            cells = row.find_all('td')
            if len(cells) < 5:
                continue
            
            try:
                # Extract athlete link and ID
                name_cell = cells[1] if len(cells) > 1 else None
                name_link = name_cell.find('a') if name_cell else None
                
                if not name_link:
                    continue
                
                href = name_link.get('href', '')
                athlete_id = None
                if 'athleteId=' in href:
                    athlete_id = href.split('athleteId=')[1].split('&')[0]
                
                if not athlete_id:
                    continue
                
                # Extract data
                name = name_link.get_text(strip=True)
                birth_year = cells[2].get_text(strip=True) if len(cells) > 2 else None
                
                # Gender from image
                gender_img = cells[3].find('img') if len(cells) > 3 else None
                gender = None
                if gender_img:
                    if 'gender2.png' in gender_img.get('src', ''):
                        gender = 'F'
                    elif 'gender1.png' in gender_img.get('src', ''):
                        gender = 'M'
                
                nation = cells[4].get_text(strip=True) if len(cells) > 4 else None
                club = cells[5].get_text(strip=True) if len(cells) > 5 else None
                last_result = name_link.get('title', '')
                
                swimmer_data = {
                    'athlete_id': athlete_id,
                    'name': name,
                    'birth_year': birth_year,
                    'gender': gender,
                    'nation': nation,
                    'club': club,
                    'last_result': last_result,
                    'url': f"{self.BASE_URL}/{href}" if not href.startswith('http') else href
                }
                
                swimmers.append(swimmer_data)
                
            except Exception as e:
                logger.warning(f"Error parsing SwimRankings row: {e}")
                continue
        
        return swimmers
