"""
Test script for ScraperAPI + SwimRankings integration.
Tests a single event page to verify we can get through Cloudflare and parse results.

Usage:
    python scripts/test_scraperapi.py
    python scripts/test_scraperapi.py --athlete 5595315 --style 2
    python scripts/test_scraperapi.py --no-render
    python scripts/test_scraperapi.py --concurrent 3
"""

import os
import sys
import time
import asyncio
import argparse
import urllib.parse
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)-8s %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger('test_scraperapi')

# Default test athletes (known SwimRankings IDs)
TEST_ATHLETES = [
    {'id': '5595315', 'name': 'Athlete 5595315'},
    {'id': '5395554', 'name': 'Athlete 5395554'},
    {'id': '5607417', 'name': 'Athlete 5607417'},
]

# Common events to test
TEST_EVENTS = [
    {'style_id': '2', 'name': '100m Freestyle'},
    {'style_id': '10', 'name': '100m Backstroke'},
    {'style_id': '18', 'name': '200m IM'},
]

SCRAPERAPI_ENDPOINT = 'https://api.scraperapi.com'
SWIMRANKINGS_BASE = 'https://www.swimrankings.net'


async def fetch_page(api_key: str, url: str, render: bool = True) -> dict:
    """Fetch a single page via ScraperAPI and return stats."""
    import httpx

    params = {
        'api_key': api_key,
        'url': url,
    }
    if render:
        params['render'] = 'true'

    api_url = f"{SCRAPERAPI_ENDPOINT}?{urllib.parse.urlencode(params)}"

    start = time.time()
    try:
        async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as client:
            response = await client.get(api_url)
            elapsed = time.time() - start

            return {
                'url': url,
                'status': response.status_code,
                'size': len(response.text),
                'elapsed': elapsed,
                'html': response.text,
                'error': None,
            }
    except Exception as e:
        elapsed = time.time() - start
        return {
            'url': url,
            'status': 0,
            'size': 0,
            'elapsed': elapsed,
            'html': '',
            'error': str(e),
        }


def check_html_content(html: str) -> dict:
    """Analyze the HTML to see what we got."""
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, 'html.parser')

    title = soup.title.string if soup.title else 'NO TITLE'
    ranking_tables = soup.find_all('table', class_='athleteRanking')

    # Count result rows across all tables
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
            # Count data rows (skip header)
            data_rows = [r for r in rows[1:] if len(r.find_all('td')) >= 4]
            total_results += len(data_rows)

    # Check for Cloudflare challenge
    is_cf_challenge = 'just a moment' in title.lower() or 'checking your browser' in html.lower()

    # Check for empty/shell page
    has_content = len(html) > 15000  # Real pages with results are usually >15KB

    return {
        'title': title,
        'tables_found': len(ranking_tables),
        'total_results': total_results,
        'courses': courses,
        'is_cf_challenge': is_cf_challenge,
        'has_content': has_content,
    }


async def run_single_test(api_key: str, athlete_id: str, style_id: str, event_name: str, render: bool):
    """Run a single test and print results."""
    url = f"{SWIMRANKINGS_BASE}/index.php?page=athleteDetail&athleteId={athlete_id}&styleId={style_id}"

    logger.info(f"Testing: {event_name} (athlete={athlete_id}, style={style_id}, render={render})")

    result = await fetch_page(api_key, url, render=render)

    if result['error']:
        logger.error(f"  FAILED: {result['error']} ({result['elapsed']:.1f}s)")
        return False

    if result['status'] != 200:
        logger.error(f"  HTTP {result['status']} ({result['elapsed']:.1f}s, {result['size']} bytes)")
        return False

    analysis = check_html_content(result['html'])

    if analysis['is_cf_challenge']:
        logger.warning(f"  CLOUDFLARE BLOCKED ({result['elapsed']:.1f}s, {result['size']} bytes)")
        return False

    if analysis['tables_found'] > 0:
        logger.info(
            f"  SUCCESS: {analysis['total_results']} results in {analysis['tables_found']} table(s) "
            f"[{', '.join(analysis['courses'])}] ({result['elapsed']:.1f}s, {result['size']} bytes)"
        )
        return True
    else:
        logger.warning(
            f"  NO TABLES: page loaded but no athleteRanking tables found "
            f"({result['elapsed']:.1f}s, {result['size']} bytes, title='{analysis['title']}')"
        )
        # Dump a snippet if small page
        if result['size'] < 12000:
            logger.info(f"  HTML snippet: {result['html'][:500]}...")
        return False


async def run_concurrent_test(api_key: str, athlete_id: str, render: bool, max_concurrent: int):
    """Test multiple events concurrently to find the right concurrency level."""
    semaphore = asyncio.Semaphore(max_concurrent)

    logger.info(f"\n{'='*60}")
    logger.info(f"Concurrent test: {len(TEST_EVENTS)} events, max_concurrent={max_concurrent}, render={render}")
    logger.info(f"{'='*60}")

    async def limited_test(event):
        async with semaphore:
            return await run_single_test(api_key, athlete_id, event['style_id'], event['name'], render)

    start = time.time()
    results = await asyncio.gather(*[limited_test(e) for e in TEST_EVENTS])
    total_time = time.time() - start

    success = sum(1 for r in results if r)
    logger.info(f"\nResults: {success}/{len(results)} successful in {total_time:.1f}s")
    return success


async def run_all_tests(api_key: str, athlete_id: str, render: bool, max_concurrent: int):
    """Run the full test suite."""
    logger.info(f"ScraperAPI Test Suite")
    logger.info(f"  API Key: {api_key[:8]}...")
    logger.info(f"  Athlete: {athlete_id}")
    logger.info(f"  Render:  {render}")
    logger.info(f"  Concurrency: {max_concurrent}")

    # Test 1: Single request
    logger.info(f"\n{'='*60}")
    logger.info("Test 1: Single request")
    logger.info(f"{'='*60}")
    event = TEST_EVENTS[0]
    single_ok = await run_single_test(api_key, athlete_id, event['style_id'], event['name'], render)

    if not single_ok:
        logger.error("\nSingle request failed. Skipping concurrent tests.")
        logger.info("\nTroubleshooting:")
        logger.info("  - If CLOUDFLARE BLOCKED: render=true is needed")
        logger.info("  - If NO TABLES with render=false: try --render (JS required)")
        logger.info("  - If HTTP 500: ScraperAPI can't handle this site")
        logger.info("  - If HTTP 429: rate limited, lower concurrency")
        return

    # Test 2: Concurrent requests
    await run_concurrent_test(api_key, athlete_id, render, max_concurrent)

    # Test 3: Compare render vs no-render if render was requested
    if render:
        logger.info(f"\n{'='*60}")
        logger.info("Test 3: Comparing render=true vs render=false")
        logger.info(f"{'='*60}")
        no_render_ok = await run_single_test(api_key, athlete_id, event['style_id'], f"{event['name']} (no render)", False)
        if no_render_ok:
            logger.info("  render=false ALSO works! You can save 9 credits per request.")
        else:
            logger.info("  render=true is required for this site.")


def main():
    parser = argparse.ArgumentParser(description='Test ScraperAPI with SwimRankings')
    parser.add_argument('--key', default=os.getenv('SCRAPERAPI_KEY'), help='ScraperAPI key (or set SCRAPERAPI_KEY env var)')
    parser.add_argument('--athlete', default='5595315', help='SwimRankings athlete ID')
    parser.add_argument('--style', default=None, help='Single style ID to test (default: test multiple)')
    parser.add_argument('--render', action='store_true', default=True, help='Use render=true (default)')
    parser.add_argument('--no-render', action='store_true', help='Disable render')
    parser.add_argument('--concurrent', type=int, default=1, help='Max concurrent requests')
    parser.add_argument('--loop', type=int, default=1, help='Number of times to repeat the test')
    parser.add_argument('--delay', type=float, default=5.0, help='Delay between loop iterations (seconds)')
    args = parser.parse_args()

    if not args.key:
        logger.error("No API key. Set SCRAPERAPI_KEY env var or use --key")
        sys.exit(1)

    render = not args.no_render

    for i in range(args.loop):
        if args.loop > 1:
            logger.info(f"\n{'#'*60}")
            logger.info(f"# Iteration {i+1}/{args.loop}")
            logger.info(f"{'#'*60}")

        if args.style:
            asyncio.run(run_single_test(args.key, args.athlete, args.style, f"Style {args.style}", render))
        else:
            asyncio.run(run_all_tests(args.key, args.athlete, render, args.concurrent))

        if args.loop > 1 and i < args.loop - 1:
            logger.info(f"Waiting {args.delay}s before next iteration...")
            time.sleep(args.delay)


if __name__ == '__main__':
    main()
