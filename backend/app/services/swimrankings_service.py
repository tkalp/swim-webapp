"""
SwimRankings.net integration service - Search only
Result scraping has been moved to the jobs folder (sync_swimrankings.py)
"""

import httpx
import brotli
from bs4 import BeautifulSoup
from typing import List, Dict, Optional
import random
import asyncio
import os
from app.utils import logger, log_error


class SwimRankingsScraper:
    """Service for searching SwimRankings.net (result scraping in jobs folder)"""
    
    BASE_URL = "https://www.swimrankings.net"
    
    def __init__(self):
        """Initialize scraper with optional proxy configuration"""
        self.use_proxy = os.getenv("USE_OXYLABS_PROXY", "false").lower() == "true"
        self.proxy_username = os.getenv("OXYLABS_USERNAME")
        self.proxy_password = os.getenv("OXYLABS_PASSWORD")
        self.proxy_country = os.getenv("OXYLABS_COUNTRY", "US")
        
        logger.info(f"Proxy config - USE_OXYLABS_PROXY: {self.use_proxy}")
        logger.info(f"Proxy config - Username present: {bool(self.proxy_username)}")
        logger.info(f"Proxy config - Password present: {bool(self.proxy_password)}")
        logger.info(f"Proxy config - Country: {self.proxy_country}")
        
    def _get_proxy_url(self) -> Optional[str]:
        """Build Oxylabs proxy URL if credentials are configured"""
        if not self.use_proxy or not self.proxy_username or not self.proxy_password:
            return None
            
        # Oxylabs format: http://user:pass@host:port
        proxy_url = f"http://customer-{self.proxy_username}-cc-{self.proxy_country}:{self.proxy_password}@pr.oxylabs.io:7777"
        logger.info(f"Using Oxylabs proxy with country: {self.proxy_country}")
        logger.info(f"Proxy URL format: http://customer-{self.proxy_username}-cc-{self.proxy_country}:***@pr.oxylabs.io:7777")
        return proxy_url
    
    async def search_swimmer(self, firstname: str, lastname: str) -> List[Dict]:
        """
        Search for swimmers on SwimRankings using httpx with realistic patterns
        
        Args:
            firstname: Swimmer's first name
            lastname: Swimmer's last name
            
        Returns:
            List of matching swimmers
        """
        logger.info(f"Searching SwimRankings for: {firstname} {lastname}")
        
        search_url = f"{self.BASE_URL}/index.php"
        params = {
            'internalRequest': 'athleteFind',
            'athlete_clubId': '-1',  # Worldwide
            'athlete_gender': '-1',  # All genders
            'athlete_lastname': lastname,
            'athlete_firstname': firstname,
        }
        
        # More realistic headers with varied user agents
        user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
        ]
        
        headers = {
            'User-Agent': random.choice(user_agents),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0',
            'Referer': self.BASE_URL,
        }
        
        try:
            # Add random delay to appear more human-like (0.5-2 seconds)
            await asyncio.sleep(random.uniform(0.5, 2.0))
            
            # Configure proxy if enabled
            proxy_url = self._get_proxy_url()
            
            # httpx automatically handles basic auth from URL (user:pass@host:port)
            async with httpx.AsyncClient(
                timeout=30.0, 
                follow_redirects=True,
                proxy=proxy_url  # None if no proxy, or full URL with embedded credentials
            ) as client:
                # First, visit the homepage to get cookies
                logger.info("Visiting homepage to establish session...")
                await client.get(self.BASE_URL, headers=headers)
                
                # Small delay before search
                await asyncio.sleep(random.uniform(0.3, 1.0))
                
                logger.info(f"Making search request with params: {params}")
                response = await client.get(search_url, params=params, headers=headers)
                logger.info(f"Response status: {response.status_code}")
                logger.info(f"Response headers: {dict(response.headers)}")
                
                if response.status_code == 503:
                    logger.error("Received 503 - SwimRankings is blocking the request")
                    return []
                
                response.raise_for_status()
                
                # Manually handle brotli decompression if needed
                html_text = response.text
                if response.headers.get('content-encoding') == 'br' and len(html_text) < 1000:
                    # Response might not be properly decompressed
                    try:
                        logger.info("Attempting manual brotli decompression...")
                        decompressed = brotli.decompress(response.content)
                        html_text = decompressed.decode('utf-8')
                        logger.info(f"Successfully decompressed brotli content")
                    except Exception as decomp_err:
                        logger.error(f"Brotli decompression failed: {decomp_err}")
                        # Fall back to original text
                        pass
                
                logger.info(f"Decoded text length: {len(html_text)} chars")
                logger.info(f"First 500 chars: {html_text[:500]}")
                
                soup = BeautifulSoup(html_text, 'lxml')
                results = self._parse_search_results(soup)
                
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
