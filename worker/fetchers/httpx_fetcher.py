"""
Httpx-based HTTP fetcher
Single Responsibility: Fetch HTML using httpx library
"""

import asyncio
import random
import logging
from typing import Optional

from worker.fetchers.base_fetcher import BaseFetcher

logger = logging.getLogger('httpx_fetcher')


class HttpxFetcher(BaseFetcher):
    """Fetcher using httpx library"""
    
    MAX_RETRIES = 3
    BASE_RETRY_DELAY = 1.0
    
    def get_name(self) -> str:
        return "httpx"
    
    def _calculate_retry_delay(self, retry_count: int) -> float:
        """Calculate exponential backoff delay with jitter"""
        delay = self.BASE_RETRY_DELAY * (2 ** retry_count)
        jitter = random.uniform(0, 1)
        return delay + jitter
    
    async def fetch(self, url: str, retry_count: int = 0) -> str:
        """
        Fetch HTML content using httpx
        
        Args:
            url: URL to fetch
            retry_count: Current retry attempt
            
        Returns:
            HTML content as string
        """
        try:
            import httpx
            
            user_agent = self.get_random_user_agent()
            
            headers = {
                'User-Agent': user_agent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'DNT': '1',
                'Connection': 'keep-alive'
            }
            
            # Build proxy configuration
            proxies = None
            proxy_config = self.get_proxy_config()
            if proxy_config:
                proxy_url = f"http://{proxy_config['username']}:{proxy_config['password']}@{proxy_config['server'].replace('http://', '')}"
                proxies = {
                    'http://': proxy_url,
                    'https://': proxy_url
                }
                logger.debug(f"Using Oxylabs proxy with country: {proxy_config['country'].upper()}")
            
            # Execute httpx request
            logger.debug(f"Executing httpx for: {url}")
            async with httpx.AsyncClient(proxies=proxies, timeout=30.0, follow_redirects=True) as client:
                response = await client.get(url, headers=headers)
                response.raise_for_status()
                
                # Handle brotli compression
                html = response.text
                html_size = len(html)
                logger.debug(f"Httpx fetch successful, HTML size: {html_size} bytes")
                
                # Check for suspiciously small response
                if html_size < 500:
                    logger.warning(f"Suspiciously small HTML response ({html_size} bytes)")
                    if retry_count < self.MAX_RETRIES:
                        raise Exception("Possible block page detected")
                
                return html
            
        except Exception as e:
            logger.warning(f"Httpx fetch error (attempt {retry_count + 1}/{self.MAX_RETRIES}): {e}")
            
            if retry_count < self.MAX_RETRIES:
                delay = self._calculate_retry_delay(retry_count)
                logger.info(f"Retrying in {delay:.2f}s...")
                await asyncio.sleep(delay)
                return await self.fetch(url, retry_count + 1)
            else:
                logger.error(f"Httpx fetch failed after {self.MAX_RETRIES} attempts")
                raise
