"""
Test Playwright + Oxylabs residential proxy against SwimRankings.
This combo uses a real browser (solves JS challenges) + residential IP (avoids IP blocks).

Usage:
    python scripts/test_playwright_oxylabs.py
"""

import asyncio
import time
import logging
from bs4 import BeautifulSoup

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)-8s %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger('test_pw_oxylabs')

PROXY_SERVER = 'http://pr.oxylabs.io:7777'
PROXY_USERNAME = 'customer-teddy_kalp_YZOpR-cc-US'
PROXY_PASSWORD = 'HhFZUoV+xkbC4'

SWIMRANKINGS_BASE = 'https://www.swimrankings.net'

TEST_EVENTS = [
    {'style_id': '2', 'name': '100m Freestyle'},
    {'style_id': '10', 'name': '100m Backstroke'},
    {'style_id': '18', 'name': '200m IM'},
]


async def fetch_with_playwright(url: str) -> dict:
    """Fetch a page using Playwright with Oxylabs proxy."""
    from playwright.async_api import async_playwright

    start = time.time()
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    '--disable-blink-features=AutomationControlled',
                    '--no-sandbox',
                ]
            )

            context = await browser.new_context(
                proxy={
                    'server': PROXY_SERVER,
                    'username': PROXY_USERNAME,
                    'password': PROXY_PASSWORD,
                },
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                viewport={'width': 1920, 'height': 1080},
                locale='en-US',
                timezone_id='America/New_York',
            )

            page = await context.new_page()

            # Stealth: hide webdriver
            await page.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
                window.chrome = { runtime: {} };
            """)

            logger.info(f"  Navigating to: {url}")
            response = await page.goto(url, wait_until='domcontentloaded', timeout=60000)

            # Check for Cloudflare challenge
            title = await page.title()
            if 'just a moment' in title.lower():
                logger.info(f"  Cloudflare challenge detected, waiting up to 15s...")
                try:
                    await page.wait_for_function(
                        "document.title !== 'Just a moment...'",
                        timeout=15000
                    )
                    await page.wait_for_load_state('networkidle', timeout=10000)
                    title = await page.title()
                    logger.info(f"  Challenge resolved! Title: {title}")
                except Exception:
                    logger.warning(f"  Challenge did NOT resolve in 15s")

            html = await page.content()
            elapsed = time.time() - start

            await context.close()
            await browser.close()

            return {
                'status': response.status if response else 0,
                'size': len(html),
                'elapsed': elapsed,
                'html': html,
                'error': None,
            }

    except Exception as e:
        elapsed = time.time() - start
        return {
            'status': 0,
            'size': 0,
            'elapsed': elapsed,
            'html': '',
            'error': str(e),
        }


def analyze_html(html: str) -> dict:
    """Check what we got."""
    soup = BeautifulSoup(html, 'html.parser')
    title = soup.title.string if soup.title else 'NO TITLE'
    ranking_tables = soup.find_all('table', class_='athleteRanking')

    total_results = 0
    courses = []
    for table in ranking_tables:
        rows = table.find_all('tr')
        if rows:
            header_text = rows[0].get_text(strip=True)
            if 'Long Course' in header_text:
                courses.append('LCM')
            elif 'Short Course' in header_text:
                courses.append('SCM')
            data_rows = [r for r in rows[1:] if len(r.find_all('td')) >= 4]
            total_results += len(data_rows)

    return {
        'title': title,
        'tables_found': len(ranking_tables),
        'total_results': total_results,
        'courses': courses,
        'is_cf_challenge': 'just a moment' in title.lower(),
    }


async def run_test(athlete_id: str, style_id: str, event_name: str) -> bool:
    url = f"{SWIMRANKINGS_BASE}/index.php?page=athleteDetail&athleteId={athlete_id}&styleId={style_id}"
    logger.info(f"Testing: {event_name} (athlete={athlete_id})")

    result = await fetch_with_playwright(url)

    if result['error']:
        logger.error(f"  FAILED: {result['error']} ({result['elapsed']:.1f}s)")
        return False

    analysis = analyze_html(result['html'])

    if analysis['is_cf_challenge']:
        logger.warning(f"  CLOUDFLARE BLOCKED even after waiting ({result['elapsed']:.1f}s)")
        return False

    if analysis['tables_found'] > 0:
        logger.info(
            f"  SUCCESS: {analysis['total_results']} results in {analysis['tables_found']} table(s) "
            f"[{', '.join(analysis['courses'])}] ({result['elapsed']:.1f}s, {result['size']} bytes)"
        )
        return True
    else:
        logger.warning(
            f"  NO TABLES: page loaded but no results ({result['elapsed']:.1f}s, {result['size']} bytes)")
        return False


async def main():
    logger.info("Playwright + Oxylabs Residential Proxy Test")
    logger.info(f"Proxy: {PROXY_SERVER} (user: {PROXY_USERNAME})\n")

    for event in TEST_EVENTS:
        ok = await run_test('5595315', event['style_id'], event['name'])
        if ok:
            logger.info("")
        else:
            logger.info("")
        await asyncio.sleep(2)

    logger.info("Done!")


if __name__ == '__main__':
    asyncio.run(main())
