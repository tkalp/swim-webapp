"""
Test clicking the Cloudflare Turnstile checkbox with Playwright + Oxylabs.
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
            headless=False,  # Visible browser — Turnstile often blocks headless
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
            logger.info("Cloudflare Turnstile detected")

            # Wait a moment for the widget to fully render
            await asyncio.sleep(3)

            # Try to find and click the Turnstile widget
            # The checkbox is inside an iframe from challenges.cloudflare.com
            try:
                # Method 1: Find the Turnstile iframe
                turnstile_frame = None
                for frame in page.frames:
                    if 'challenges.cloudflare.com' in frame.url:
                        turnstile_frame = frame
                        logger.info(f"Found Turnstile iframe: {frame.url[:80]}")
                        break

                if turnstile_frame:
                    # Try clicking the checkbox inside the iframe
                    try:
                        checkbox = await turnstile_frame.wait_for_selector('[type="checkbox"]', timeout=5000)
                        await checkbox.click()
                        logger.info("Clicked Turnstile checkbox!")
                    except Exception:
                        logger.info("No checkbox found in iframe, trying to click body...")
                        try:
                            await turnstile_frame.click('body')
                        except Exception:
                            pass
                else:
                    logger.info("No Turnstile iframe found, trying direct click on widget area...")

                # Method 2: Click on the known position of the widget (from screenshot)
                # The widget was at roughly x=500, y=255 in a 1920x1080 viewport
                await page.mouse.click(500, 255)
                logger.info("Clicked at widget position (500, 255)")

            except Exception as e:
                logger.warning(f"Click attempts failed: {e}")

            # Wait for challenge to resolve (page will navigate)
            logger.info("Waiting up to 30s for challenge to resolve...")
            try:
                await page.wait_for_load_state('networkidle', timeout=30000)
            except Exception:
                pass
            await asyncio.sleep(2)

            try:
                title = await page.title()
                if 'just a moment' not in title.lower():
                    elapsed = time.time() - start
                    logger.info(f"Challenge resolved! Title: '{title}' ({elapsed:.1f}s)")
                else:
                    logger.warning("Challenge still showing after wait")
                    await page.screenshot(path='cf_turnstile_debug.png')
                    logger.info("Screenshot saved to cf_turnstile_debug.png")
            except Exception as e:
                logger.info(f"Page navigated (expected): {e}")
                await asyncio.sleep(3)

        # Check results
        html = await page.content()
        elapsed = time.time() - start
        soup = BeautifulSoup(html, 'html.parser')
        title = soup.title.string if soup.title else 'NO TITLE'
        tables = soup.find_all('table', class_='athleteRanking')

        if tables:
            total = sum(len([r for r in t.find_all('tr')[1:] if len(r.find_all('td')) >= 4]) for t in tables)
            logger.info(f"SUCCESS: {total} results in {len(tables)} tables ({elapsed:.1f}s)")
        else:
            logger.warning(f"NO TABLES: title='{title}' ({elapsed:.1f}s, {len(html)} bytes)")

        await context.close()
        await browser.close()


if __name__ == '__main__':
    asyncio.run(main())
