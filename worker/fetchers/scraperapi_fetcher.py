"""
ScraperAPI-based HTTP fetcher
Single Responsibility: Fetch HTML via ScraperAPI (handles Cloudflare bypass)
"""

import asyncio
import random
import logging
import urllib.parse
from typing import Optional

from worker.fetchers.base_fetcher import BaseFetcher
from worker.config import WorkerConfig

logger = logging.getLogger('scraperapi_fetcher')

SCRAPERAPI_ENDPOINT = 'https://api.scraperapi.com'

# ScraperAPI trial plan allows very limited concurrency.
# Default to 2 to be safe; configurable via SCRAPERAPI_MAX_CONCURRENT env var.
SCRAPERAPI_MAX_CONCURRENT = int(WorkerConfig.SCRAPERAPI_MAX_CONCURRENT or '2')


class ScraperApiFetcher(BaseFetcher):
    """Fetcher using ScraperAPI to bypass Cloudflare and anti-bot protection"""

    MAX_RETRIES = 3
    BASE_RETRY_DELAY = 3.0

    # Class-level concurrency control.
    # Must be reset when the event loop changes (Celery creates a new loop per task).
    _concurrency_semaphore: Optional[asyncio.Semaphore] = None
    _bound_loop: Optional[asyncio.AbstractEventLoop] = None

    def __init__(self, api_key: str, **kwargs):
        super().__init__(**kwargs)
        self.api_key = api_key
        if not self.api_key:
            raise ValueError("SCRAPERAPI_KEY is required for ScraperAPI fetcher")
        logger.info(f"ScraperApiFetcher initialized (max concurrent: {SCRAPERAPI_MAX_CONCURRENT})")

    def get_name(self) -> str:
        return "scraperapi"

    @classmethod
    def _ensure_semaphore(cls):
        """Create/reset semaphore if event loop changed (Celery creates new loops)"""
        try:
            current_loop = asyncio.get_running_loop()
        except RuntimeError:
            current_loop = None

        if cls._bound_loop is not current_loop:
            if cls._bound_loop is not None:
                logger.info("Event loop changed, resetting ScraperAPI concurrency semaphore")
            cls._concurrency_semaphore = asyncio.Semaphore(SCRAPERAPI_MAX_CONCURRENT)
            cls._bound_loop = current_loop
            logger.info(f"ScraperAPI semaphore created with limit={SCRAPERAPI_MAX_CONCURRENT}")

    def _calculate_retry_delay(self, retry_count: int) -> float:
        """Calculate exponential backoff delay with jitter"""
        delay = self.BASE_RETRY_DELAY * (2 ** retry_count)
        jitter = random.uniform(0, 1)
        return delay + jitter

    async def fetch(self, url: str, retry_count: int = 0) -> str:
        """
        Fetch HTML content via ScraperAPI with concurrency limiting.

        Args:
            url: URL to fetch
            retry_count: Current retry attempt

        Returns:
            HTML content as string
        """
        self._ensure_semaphore()

        logger.info(f"Waiting for semaphore slot ({SCRAPERAPI_MAX_CONCURRENT} max concurrent)...")
        async with self._concurrency_semaphore:
            logger.info(f"Semaphore acquired, fetching: {url}")
            result = await self._do_fetch(url, retry_count)
            logger.info(f"Semaphore releasing for: {url}")
            return result

    async def _do_fetch(self, url: str, retry_count: int = 0) -> str:
        """Execute the actual ScraperAPI fetch"""
        try:
            import httpx

            params = {
                'api_key': self.api_key,
                'url': url,
                'render': 'true',  # Required: SwimRankings loads results via JS
            }

            api_url = f"{SCRAPERAPI_ENDPOINT}?{urllib.parse.urlencode(params)}"

            async with httpx.AsyncClient(timeout=90.0, follow_redirects=True) as client:
                response = await client.get(api_url)

                if response.status_code == 403:
                    raise Exception("ScraperAPI returned 403 — target site blocked the request")
                if response.status_code == 429:
                    raise Exception("ScraperAPI rate limit reached — too many concurrent requests")
                if response.status_code == 500:
                    raise Exception("ScraperAPI internal error — retrying")

                response.raise_for_status()

                html = response.text
                html_size = len(html)
                logger.info(f"ScraperAPI fetch OK: {html_size} bytes from {url}")

                if html_size < 500:
                    logger.warning(f"Suspiciously small response ({html_size} bytes) from {url}")
                    if retry_count < self.MAX_RETRIES:
                        raise Exception("Possible block page detected")

                return html

        except Exception as e:
            logger.warning(f"ScraperAPI error (attempt {retry_count + 1}/{self.MAX_RETRIES}): {e}")

            if retry_count < self.MAX_RETRIES:
                delay = self._calculate_retry_delay(retry_count)
                logger.info(f"Retrying in {delay:.1f}s...")
                await asyncio.sleep(delay)
                return await self._do_fetch(url, retry_count + 1)
            else:
                logger.error(f"ScraperAPI failed after {self.MAX_RETRIES} attempts: {url}")
                raise
