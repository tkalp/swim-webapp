"""
Playwright-based HTTP fetcher
Single Responsibility: Fetch HTML using Playwright browser
"""

import asyncio
import random
import logging
from typing import Optional

from worker.fetchers.base_fetcher import BaseFetcher

logger = logging.getLogger('playwright_fetcher')


class PlaywrightFetcher(BaseFetcher):
    """Fetcher using Playwright browser"""
    
    MAX_RETRIES = 3
    BASE_RETRY_DELAY = 1.0
    
    def get_name(self) -> str:
        return "playwright"
    
    def _calculate_retry_delay(self, retry_count: int) -> float:
        """Calculate exponential backoff delay with jitter"""
        delay = self.BASE_RETRY_DELAY * (2 ** retry_count)
        jitter = random.uniform(0, 1)
        return delay + jitter
    
    async def fetch(self, url: str, retry_count: int = 0) -> str:
        """
        Fetch HTML content using Playwright browser
        
        Args:
            url: URL to fetch
            retry_count: Current retry attempt
            
        Returns:
            HTML content as string
        """
        from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError
        
        try:
            user_agent = self.get_random_user_agent()
            
            logger.debug(f"Launching Playwright browser for: {url}")
            async with async_playwright() as p:
                # Configure browser launch options
                launch_options = {'headless': True}
                
                # Add proxy if configured
                proxy_config = self.get_proxy_config()
                if proxy_config:
                    logger.info(f"Using Oxylabs proxy with country: {proxy_config['country'].upper()}")
                    launch_options['proxy'] = {
                        "server": proxy_config['server'],
                        "username": proxy_config['username'],
                        "password": proxy_config['password']
                    }
                
                browser = await p.chromium.launch(**launch_options)
                
                context = await browser.new_context(
                    viewport={'width': 1920, 'height': 1080},
                    user_agent=user_agent
                )
                page = await context.new_page()
                
                logger.debug("Navigating to page and waiting for network idle...")
                await page.goto(url, wait_until="networkidle", timeout=30000)
                
                # Simulate human-like behavior
                await asyncio.sleep(random.uniform(0.1, 0.3))
                
                html = await page.content()
                html_size = len(html)
                await browser.close()
                logger.debug(f"Browser closed, page content retrieved (size: {html_size} bytes)")
                
                # Check for suspiciously small response
                if html_size < 500:
                    logger.warning(f"Suspiciously small HTML response ({html_size} bytes)")
                    if retry_count < self.MAX_RETRIES:
                        logger.warning("Detected block page, retrying with new session...")
                        delay = self._calculate_retry_delay(retry_count) + random.uniform(2.0, 5.0)
                        await asyncio.sleep(delay)
                        return await self.fetch(url, retry_count + 1)
                
                return html
            
        except (PlaywrightTimeoutError, Exception) as e:
            logger.warning(f"Playwright fetch error (attempt {retry_count + 1}/{self.MAX_RETRIES}): {e}")
            
            if retry_count < self.MAX_RETRIES:
                delay = self._calculate_retry_delay(retry_count)
                logger.info(f"Retrying in {delay:.2f}s...")
                await asyncio.sleep(delay)
                return await self.fetch(url, retry_count + 1)
            else:
                logger.error(f"Playwright fetch failed after {self.MAX_RETRIES} attempts")
                raise
