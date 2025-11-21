"""
Base scraper with shared functionality
"""

import asyncio
import random
import time
import logging
from typing import Optional
from abc import ABC, abstractmethod

from worker.config import WorkerConfig


logger = logging.getLogger('base_scraper')


class BaseScraper(ABC):
    """Base class for web scrapers with rate limiting and retry logic"""
    
    def __init__(self, max_workers: Optional[int] = None):
        """
        Initialize scraper
        
        Args:
            max_workers: Maximum number of parallel workers (None = use config default)
        """
        self.MAX_WORKERS = WorkerConfig.get_max_workers(max_workers)
        self.MIN_DELAY = WorkerConfig.MIN_DELAY
        self.MAX_DELAY = WorkerConfig.MAX_DELAY
        self.BASE_RETRY_DELAY = WorkerConfig.BASE_RETRY_DELAY
        self.MAX_RETRIES = WorkerConfig.MAX_RETRIES
        
        self.request_count = 0
        self.last_request_time = 0.0
        
        # User agents for rotation
        self.user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
        ]
        
        logger.info(f"Scraper initialized with {self.MAX_WORKERS} parallel workers")
    
    def get_random_user_agent(self) -> str:
        """Get a random user agent"""
        return random.choice(self.user_agents)
    
    async def rate_limit_delay(self) -> None:
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
        
        logger.debug(f"Request #{self.request_count}")
    
    def calculate_retry_delay(self, retry_count: int) -> float:
        """
        Calculate exponential backoff delay with jitter
        
        Args:
            retry_count: Current retry attempt (0-indexed)
            
        Returns:
            Delay in seconds
        """
        delay = self.BASE_RETRY_DELAY * (2 ** retry_count)
        jitter = random.uniform(0, 1)
        return delay + jitter
    
    async def fetch_page(self, url: str, retry_count: int = 0) -> str:
        """
        Fetch page content using Playwright async API with retry logic
        
        Args:
            url: URL to fetch
            retry_count: Current retry attempt
            
        Returns:
            HTML content
        """
        from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError
        
        try:
            # Get fresh proxy configuration for each attempt (generates new session ID)
            proxy_config = WorkerConfig.get_proxy_config()
            
            logger.debug(f"Launching Playwright browser for: {url}")
            async with async_playwright() as p:
                # Configure browser launch options
                launch_options = {'headless': True}
                
                if proxy_config:
                    logger.info(f"Using Oxylabs proxy for request")
                    # Set proxy at browser launch with separate username/password
                    launch_options['proxy'] = {
                        "server": "http://pr.oxylabs.io:7777",
                        "username": proxy_config["username"],
                        "password": proxy_config["password"]
                    }
                else:
                    logger.debug("No proxy configured, using direct connection")
                
                browser = await p.chromium.launch(**launch_options)
                
                context = await browser.new_context(
                    viewport={'width': 1920, 'height': 1080},
                    user_agent=self.get_random_user_agent()
                )
                page = await context.new_page()
                
                logger.debug("Navigating to page and waiting for network idle...")
                await page.goto(url, wait_until="networkidle", timeout=30000)
                
                # Simulate human-like behavior: small random delay before reading content
                await asyncio.sleep(random.uniform(0.1, 0.3))
                
                html = await page.content()
                html_size = len(html)
                await browser.close()
                logger.debug(f"Browser closed, page content retrieved (size: {html_size} bytes)")
                
                # Log and retry if we got a suspiciously small response (likely blocked)
                if html_size < 500:
                    logger.warning(f"Suspiciously small HTML response ({html_size} bytes). Content:\n{html}")
                    
                    # If this was a block page and we haven't retried too many times, retry
                    if retry_count < self.MAX_RETRIES:
                        logger.warning(f"Detected block page, retrying with new session...")
                        delay = self.calculate_retry_delay(retry_count) + random.uniform(2.0, 5.0)
                        logger.info(f"Waiting {delay:.2f}s before retry...")
                        await asyncio.sleep(delay)
                        return await self.fetch_page(url, retry_count + 1)
                
            return html
            
        except (PlaywrightTimeoutError, Exception) as e:
            logger.warning(f"Error fetching page (attempt {retry_count + 1}/{self.MAX_RETRIES}): {e}")
            
            if retry_count < self.MAX_RETRIES:
                delay = self.calculate_retry_delay(retry_count)
                logger.info(f"Retrying in {delay:.2f}s...")
                await asyncio.sleep(delay)
                return await self.fetch_page(url, retry_count + 1)
            else:
                logger.error(f"Failed to fetch page after {self.MAX_RETRIES} attempts")
                raise
