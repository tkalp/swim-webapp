"""
Test Playwright against SwimRankings Cloudflare Turnstile.
Tries clicking the Turnstile checkbox and waiting longer.
"""

import asyncio
import time
import logging
from bs4 import BeautifulSoup

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)-8s %(message)s', datefmt='%H:%M:%S')
logger = logging.getLogger('test_turnstile')

PROXY_SERVER = 'http://pr.oxylabs.io:7777'
PROXY_USERNAME = 'customer-teddy_kalp_YZOpR-cc-US'
PROXY_PASSWORD = 'HhFZUoV+xkbC4'
URL = 'https://www.swimrankings.net/index.php?page=athleteDetail&athleteId=5595315&styleId=2'


async def main():
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=['--disable-blink-features=AutomationControlled', '--no-sandbox']
        )

        context = await browser.new_context(
            proxy={'server': PROXY_SERVER, 'username': PROXY_USERNAME, 'password': PROXY_PASSWORD},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            viewport={'width': 1920, 'height': 1080},
            locale='en-US',
            timezone_id='America/New_York',
        )

        page = await context.new_page()
        await page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            window.chrome = { runtime: {} };
        """)

        logger.info(f"Navigating to: {URL}")
        start = time.time()
        await page.goto(URL, wait_until='domcontentloaded', timeout=60000)

        title = await page.title()
        logger.info(f"Initial title: '{title}'")

        if 'just a moment' in title.lower():
            logger.info("Cloudflare challenge detected")

            # Try to find and click Turnstile iframe checkbox
            try:
                frames = page.frames
                logger.info(f"Found {len(frames)} frames on page")
                for i, frame in enumerate(frames):
                    frame_url = frame.url
                    logger.info(f"  Frame {i}: {frame_url[:80]}")
                    if 'challenges.cloudflare.com' in frame_url or 'turnstile' in frame_url:
                        logger.info(f"  Found Turnstile frame! Attempting to click checkbox...")
                        try:
                            checkbox = await frame.wait_for_selector('input[type="checkbox"]', timeout=5000)
                            if checkbox:
                                await checkbox.click()
                                logger.info("  Clicked checkbox!")
                        except Exception as e:
                            logger.info(f"  No checkbox found: {e}")
                        try:
                            body = await frame.wait_for_selector('body', timeout=2000)
                            if body:
                                await body.click()
                                logger.info("  Clicked frame body!")
                        except Exception:
                            pass
            except Exception as e:
                logger.info(f"Frame inspection failed: {e}")

            # Wait longer for challenge to resolve
            logger.info("Waiting up to 30s for challenge to resolve...")
            for i in range(30):
                await asyncio.sleep(1)
                title = await page.title()
                if 'just a moment' not in title.lower():
                    logger.info(f"Challenge resolved after {i+1}s! Title: '{title}'")
                    await page.wait_for_load_state('networkidle', timeout=10000)
                    break
            else:
                logger.warning("Challenge did NOT resolve after 30s")

                # Dump page content for debugging
                html = await page.content()
                logger.info(f"Page size: {len(html)} bytes")
                # Check what's on the page
                soup = BeautifulSoup(html, 'html.parser')
                iframes = soup.find_all('iframe')
                logger.info(f"IFrames on page: {len(iframes)}")
                for iframe in iframes:
                    logger.info(f"  iframe src: {iframe.get('src', 'none')[:100]}")

                # Screenshot for debugging
                await page.screenshot(path='cf_challenge.png')
                logger.info("Screenshot saved to cf_challenge.png")

        html = await page.content()
        elapsed = time.time() - start

        soup = BeautifulSoup(html, 'html.parser')
        title = soup.title.string if soup.title else 'NO TITLE'
        tables = soup.find_all('table', class_='athleteRanking')

        if tables:
            total = sum(len([r for r in t.find_all('tr')[1:] if len(r.find_all('td')) >= 4]) for t in tables)
            logger.info(f"SUCCESS: {total} results in {len(tables)} tables ({elapsed:.1f}s, {len(html)} bytes)")
        else:
            logger.warning(f"NO TABLES: title='{title}' ({elapsed:.1f}s, {len(html)} bytes)")

        await context.close()
        await browser.close()


if __name__ == '__main__':
    asyncio.run(main())
