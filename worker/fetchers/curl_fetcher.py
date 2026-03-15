"""
Curl-based HTTP fetcher
Single Responsibility: Fetch HTML using subprocess curl
"""

import os
import random
import asyncio
import logging
from typing import Optional

from worker.fetchers.base_fetcher import BaseFetcher

logger = logging.getLogger('curl_fetcher')


class CurlFetcher(BaseFetcher):
    """Fetcher using curl subprocess with global concurrency control"""

    MAX_RETRIES = 3
    BASE_RETRY_DELAY = 1.0

    # Class-level concurrency control — shared across all instances.
    # Must be reset when the event loop changes (Celery creates a new loop per task).
    _concurrency_semaphore: Optional[asyncio.Semaphore] = None
    _bound_loop: Optional[asyncio.AbstractEventLoop] = None
    MAX_CONCURRENT_REQUESTS = int(os.getenv('MAX_CONCURRENT_REQUESTS', '15'))

    def get_name(self) -> str:
        return "curl"

    @classmethod
    def _ensure_semaphore(cls):
        """Create/reset semaphore if event loop changed (Celery creates new loops)"""
        try:
            current_loop = asyncio.get_running_loop()
        except RuntimeError:
            current_loop = None

        if cls._bound_loop is not current_loop:
            if cls._bound_loop is not None:
                logger.info("Event loop changed, resetting concurrency semaphore")
            cls._concurrency_semaphore = asyncio.Semaphore(cls.MAX_CONCURRENT_REQUESTS)
            cls._bound_loop = current_loop

    def _calculate_retry_delay(self, retry_count: int) -> float:
        """Calculate exponential backoff delay with jitter"""
        delay = self.BASE_RETRY_DELAY * (2 ** retry_count)
        jitter = random.uniform(0, 1)
        return delay + jitter

    async def fetch(self, url: str, retry_count: int = 0) -> str:
        """
        Fetch HTML content using curl subprocess with concurrency limiting.

        Args:
            url: URL to fetch
            retry_count: Current retry attempt

        Returns:
            HTML content as string
        """
        self._ensure_semaphore()

        async with self._concurrency_semaphore:
            return await self._do_fetch(url, retry_count)

    async def _do_fetch(self, url: str, retry_count: int = 0) -> str:
        """Execute the actual curl fetch"""
        try:
            user_agent = self.get_random_user_agent()

            # Build curl command
            cmd = ['curl', '-s', '-L', '--compressed']  # silent, follow redirects, accept compression

            # Add proxy if configured
            proxy_config = self.get_proxy_config()
            if proxy_config:
                cmd.extend(['-x', proxy_config['server']])
                cmd.extend(['-U', f"{proxy_config['username']}:{proxy_config['password']}"])

            # Add headers
            cmd.extend([
                '-H', f'User-Agent: {user_agent}',
                '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                '-H', 'Accept-Language: en-US,en;q=0.9',
                '-H', 'DNT: 1',
                '-H', 'Connection: keep-alive',
                '-H', 'Upgrade-Insecure-Requests: 1',
                '--max-time', '15'
            ])

            # Add URL
            cmd.append(url)

            # Execute curl asynchronously (non-blocking)
            logger.debug(f"Fetching: {url}")
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await process.communicate()

            if process.returncode != 0:
                error_msg = stderr.decode('utf-8', errors='ignore')
                raise Exception(f"Curl failed with return code {process.returncode}: {error_msg}")

            html = stdout.decode('utf-8', errors='ignore')
            html_size = len(html)
            logger.debug(f"Fetched {html_size} bytes from {url}")

            # Check for suspiciously small response (likely a block page)
            if html_size < 500:
                logger.warning(f"Suspiciously small HTML response ({html_size} bytes) from {url}")
                if retry_count < self.MAX_RETRIES:
                    raise Exception("Possible block page detected")

            return html

        except Exception as e:
            logger.warning(f"Curl fetch error (attempt {retry_count + 1}/{self.MAX_RETRIES}): {e}")

            if retry_count < self.MAX_RETRIES:
                delay = self._calculate_retry_delay(retry_count)
                logger.info(f"Retrying in {delay:.2f}s...")
                await asyncio.sleep(delay)
                return await self._do_fetch(url, retry_count + 1)
            else:
                logger.error(f"Curl fetch failed after {self.MAX_RETRIES} attempts: {url}")
                raise
