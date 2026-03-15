"""
Playwright-based HTTP fetcher
Single Responsibility: Fetch HTML using Playwright browser
"""

import asyncio
import os
import random
import time
import logging
from typing import Optional

from worker.fetchers.base_fetcher import BaseFetcher

logger = logging.getLogger('playwright_fetcher')

# Anti-detection init script — injected into every new page
_STEALTH_SCRIPT = """
    // Remove webdriver flag
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

    // Realistic languages
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });

    // Override plugins with realistic PluginArray-like object
    Object.defineProperty(navigator, 'plugins', {
        get: () => {
            const arr = [1, 2, 3, 4, 5];
            arr.item = (i) => arr[i];
            arr.namedItem = () => null;
            arr.refresh = () => {};
            return arr;
        }
    });

    // Override permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
    );

    // Override chrome runtime
    window.chrome = { runtime: {} };
"""


class PlaywrightFetcher(BaseFetcher):
    """
    Fetcher using Playwright browser with stealth, staggered rate limiting, and browser reuse.

    Rate limiting strategy: "staggered starts"
    - A lock ensures request STARTS are spaced ~0.2-0.4s apart (avoids burst detection)
    - A semaphore caps total in-flight requests (prevents memory/resource exhaustion)
    - The lock is released immediately after scheduling, so requests fly in parallel
    - Result: 21 events start over ~5-7s, with ~8-10 in flight at peak
    """

    MAX_RETRIES = 3
    BASE_RETRY_DELAY = 1.0

    # Class-level state — shared across all instances.
    # Must be reset when the event loop changes (Celery creates a new loop per task).
    _last_request_time: float = 0.0
    _rate_limit_lock: Optional[asyncio.Lock] = None
    _concurrency_semaphore: Optional[asyncio.Semaphore] = None
    _playwright = None
    _browser = None
    _browser_lock: Optional[asyncio.Lock] = None
    _bound_loop: Optional[asyncio.AbstractEventLoop] = None

    # Stagger interval: time between request starts (seconds)
    MIN_START_INTERVAL = float(os.getenv('SCRAPER_MIN_DELAY', '0.2'))
    MAX_START_INTERVAL = float(os.getenv('SCRAPER_MAX_DELAY', '0.4'))

    # Max concurrent in-flight requests (browser contexts)
    MAX_CONCURRENT_REQUESTS = int(os.getenv('MAX_CONCURRENT_REQUESTS', '10'))

    # Common viewport sizes to randomize fingerprint
    VIEWPORT_SIZES = [
        (1366, 768), (1440, 900), (1536, 864), (1920, 1080),
    ]

    def get_name(self) -> str:
        return "playwright"

    def _calculate_retry_delay(self, retry_count: int) -> float:
        """Calculate exponential backoff delay with jitter"""
        delay = self.BASE_RETRY_DELAY * (2 ** retry_count)
        jitter = random.uniform(0, 1)
        return delay + jitter

    @classmethod
    def _ensure_current_loop(cls):
        """
        Reset all class-level async state if the event loop has changed.
        Celery creates a new event loop for each task execution, so locks and
        browser instances from a previous loop become invalid.
        """
        try:
            current_loop = asyncio.get_running_loop()
        except RuntimeError:
            current_loop = None

        if cls._bound_loop is not current_loop:
            if cls._bound_loop is not None:
                logger.info("Event loop changed, resetting async state")
                cls._browser = None
                cls._playwright = None
            cls._rate_limit_lock = asyncio.Lock()
            cls._concurrency_semaphore = asyncio.Semaphore(cls.MAX_CONCURRENT_REQUESTS)
            cls._browser_lock = asyncio.Lock()
            cls._last_request_time = 0.0
            cls._bound_loop = current_loop

    @classmethod
    async def _get_browser(cls, proxy_config: dict):
        """
        Get or create a persistent browser instance.
        Launches Chromium once and reuses it for all subsequent requests.
        Each fetch() call creates a fresh BrowserContext for isolation.
        """
        async with cls._browser_lock:
            # Check if browser is still alive
            if cls._browser is not None:
                if cls._browser.is_connected():
                    return cls._browser
                else:
                    logger.warning("Browser disconnected, will relaunch")
                    cls._browser = None

            if cls._browser is None:
                from playwright.async_api import async_playwright

                logger.info("Launching persistent Playwright browser...")
                cls._playwright = await async_playwright().start()

                launch_options = {
                    'headless': True,
                    'args': [
                        '--disable-blink-features=AutomationControlled',
                        '--disable-features=IsolateOrigins,site-per-process',
                        '--no-sandbox',
                    ]
                }

                if proxy_config:
                    logger.info(f"Using Oxylabs proxy with country: {proxy_config['country'].upper()}")
                    launch_options['proxy'] = {
                        "server": proxy_config['server'],
                        "username": proxy_config['username'],
                        "password": proxy_config['password']
                    }

                cls._browser = await cls._playwright.chromium.launch(**launch_options)
                logger.info("Persistent browser launched successfully")

            return cls._browser

    async def _stagger_request_start(self):
        """
        Ensure request starts are spaced apart to avoid burst detection.
        The lock is held only briefly to check/wait the interval, then released
        so the actual fetch runs in parallel with other requests.
        """
        async with self._rate_limit_lock:
            now = time.time()
            if PlaywrightFetcher._last_request_time > 0:
                elapsed = now - PlaywrightFetcher._last_request_time
                interval = random.uniform(self.MIN_START_INTERVAL, self.MAX_START_INTERVAL)
                if elapsed < interval:
                    wait = interval - elapsed
                    await asyncio.sleep(wait)
            PlaywrightFetcher._last_request_time = time.time()

    async def fetch(self, url: str, retry_count: int = 0) -> str:
        """
        Fetch HTML content using a persistent Playwright browser.

        Uses staggered rate limiting:
        1. Semaphore caps total in-flight requests
        2. Rate limit lock spaces out request starts by ~0.2-0.4s
        3. Actual fetch runs in parallel after the lock is released
        """
        # Ensure locks/browser belong to the current event loop
        self._ensure_current_loop()

        # Semaphore: cap total concurrent requests
        async with self._concurrency_semaphore:
            # Stagger: space out request starts
            await self._stagger_request_start()
            return await self._do_fetch(url, retry_count)

    async def _do_fetch(self, url: str, retry_count: int = 0) -> str:
        """Execute the actual Playwright fetch"""
        context = None
        try:
            user_agent = self.get_random_user_agent()
            width, height = random.choice(self.VIEWPORT_SIZES)
            proxy_config = self.get_proxy_config()

            # Reuse persistent browser, create fresh context per request
            browser = await self._get_browser(proxy_config)

            logger.debug(f"Fetching: {url}")
            context = await browser.new_context(
                viewport={'width': width, 'height': height},
                user_agent=user_agent,
                locale='en-US',
                timezone_id='America/New_York',
            )
            page = await context.new_page()

            # Anti-detection: comprehensive browser fingerprint overrides
            await page.add_init_script(_STEALTH_SCRIPT)

            await page.goto(url, wait_until="networkidle", timeout=30000)

            # Check for Cloudflare challenge page and wait for it to resolve
            title = await page.title()
            if 'just a moment' in title.lower():
                logger.info("Cloudflare challenge detected, waiting for resolution...")
                try:
                    await page.wait_for_function(
                        "() => !document.title.toLowerCase().includes('just a moment')",
                        timeout=15000
                    )
                    await page.wait_for_load_state("networkidle", timeout=15000)
                    logger.info("Cloudflare challenge resolved")
                except Exception as cf_err:
                    logger.warning(f"Cloudflare challenge did not resolve: {cf_err}")

            # Brief pause to let any dynamic content render
            await asyncio.sleep(random.uniform(0.1, 0.3))

            html = await page.content()
            html_size = len(html)
            await context.close()
            context = None
            logger.debug(f"Fetched {html_size} bytes from {url}")

            # Check for suspiciously small response
            if html_size < 500:
                logger.warning(f"Suspiciously small HTML response ({html_size} bytes)")
                if retry_count < self.MAX_RETRIES:
                    logger.warning("Detected block page, retrying with new session...")
                    delay = self._calculate_retry_delay(retry_count) + random.uniform(2.0, 5.0)
                    await asyncio.sleep(delay)
                    return await self._do_fetch(url, retry_count + 1)

            return html

        except Exception as e:
            # Clean up context on error
            if context is not None:
                try:
                    await context.close()
                except Exception:
                    pass

            # If browser crashed, reset it so next call relaunches
            if self._browser is not None and not self._browser.is_connected():
                logger.warning("Browser crashed, resetting for relaunch")
                self.__class__._browser = None
                self.__class__._playwright = None

            logger.warning(f"Playwright fetch error (attempt {retry_count + 1}/{self.MAX_RETRIES}): {e}")

            if retry_count < self.MAX_RETRIES:
                delay = self._calculate_retry_delay(retry_count)
                logger.info(f"Retrying in {delay:.2f}s...")
                await asyncio.sleep(delay)
                return await self._do_fetch(url, retry_count + 1)
            else:
                logger.error(f"Playwright fetch failed after {self.MAX_RETRIES} attempts")
                raise
