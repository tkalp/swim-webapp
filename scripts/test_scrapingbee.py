"""
Test script for ScrapingBee + SwimRankings integration.

Usage:
    python scripts/test_scrapingbee.py --key YOUR_KEY
    python scripts/test_scrapingbee.py --key YOUR_KEY --no-render
    python scripts/test_scrapingbee.py --key YOUR_KEY --stealth
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
logger = logging.getLogger('test_scrapingbee')

SCRAPINGBEE_ENDPOINT = 'https://app.scrapingbee.com/api/v1/'
SWIMRANKINGS_BASE = 'https://www.swimrankings.net'

TEST_EVENTS = [
    {'style_id': '2', 'name': '100m Freestyle'},
    {'style_id': '10', 'name': '100m Backstroke'},
    {'style_id': '18', 'name': '200m IM'},
]


async def fetch_page(api_key: str, url: str, render: bool = True, stealth: bool = False) -> dict:
    """Fetch a single page via ScrapingBee."""
    import httpx

    params = {
        'api_key': api_key,
        'url': url,
        'render_js': 'true' if render else 'false',
    }
    if stealth:
        params['stealth_proxy'] = 'true'

    api_url = f"{SCRAPINGBEE_ENDPOINT}?{urllib.parse.urlencode(params)}"

    start = time.time()
    try:
        async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as client:
            response = await client.get(api_url)
            elapsed = time.time() - start

            # ScrapingBee returns remaining credits in header
            credits_remaining = response.headers.get('Spb-cost', '?')

            return {
                'url': url,
                'status': response.status_code,
                'size': len(response.text),
                'elapsed': elapsed,
                'html': response.text,
                'error': None,
                'credits_used': credits_remaining,
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
            'credits_used': '?',
        }


def check_html_content(html: str) -> dict:
    """Analyze the HTML to see what we got."""
    from bs4 import BeautifulSoup
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

    is_cf_challenge = 'just a moment' in title.lower() or 'checking your browser' in html.lower()

    return {
        'title': title,
        'tables_found': len(ranking_tables),
        'total_results': total_results,
        'courses': courses,
        'is_cf_challenge': is_cf_challenge,
    }


async def run_test(api_key: str, athlete_id: str, style_id: str, event_name: str, render: bool, stealth: bool):
    """Run a single test and print results."""
    url = f"{SWIMRANKINGS_BASE}/index.php?page=athleteDetail&athleteId={athlete_id}&styleId={style_id}"

    mode = []
    if render:
        mode.append('render_js')
    if stealth:
        mode.append('stealth_proxy')
    mode_str = '+'.join(mode) if mode else 'basic'

    logger.info(f"Testing: {event_name} (athlete={athlete_id}, mode={mode_str})")

    result = await fetch_page(api_key, url, render=render, stealth=stealth)

    if result['error']:
        logger.error(f"  FAILED: {result['error']} ({result['elapsed']:.1f}s)")
        return False

    if result['status'] != 200:
        logger.error(f"  HTTP {result['status']} ({result['elapsed']:.1f}s, {result['size']} bytes)")
        if result['size'] < 1000:
            logger.error(f"  Response: {result['html'][:500]}")
        return False

    analysis = check_html_content(result['html'])

    if analysis['is_cf_challenge']:
        logger.warning(f"  CLOUDFLARE BLOCKED ({result['elapsed']:.1f}s)")
        return False

    if analysis['tables_found'] > 0:
        logger.info(
            f"  SUCCESS: {analysis['total_results']} results in {analysis['tables_found']} table(s) "
            f"[{', '.join(analysis['courses'])}] "
            f"({result['elapsed']:.1f}s, {result['size']} bytes, cost={result['credits_used']} credits)"
        )
        return True
    else:
        logger.warning(
            f"  NO TABLES: got page but no results "
            f"({result['elapsed']:.1f}s, {result['size']} bytes, title='{analysis['title']}')"
        )
        if result['size'] < 12000:
            logger.info(f"  HTML snippet: {result['html'][:300]}...")
        return False


async def run_all_tests(api_key: str, athlete_id: str):
    """Test all combinations to find what works."""
    event = TEST_EVENTS[0]

    configs = [
        {'render': False, 'stealth': False, 'label': '1. Basic (no render, no stealth)'},
        {'render': True, 'stealth': False, 'label': '2. JS Render only'},
        {'render': False, 'stealth': True, 'label': '3. Stealth proxy only'},
        {'render': True, 'stealth': True, 'label': '4. JS Render + Stealth proxy'},
    ]

    logger.info(f"ScrapingBee Test Suite — Athlete {athlete_id}, Event: {event['name']}")
    logger.info(f"Testing 4 configurations to find what works...\n")

    results = {}
    for cfg in configs:
        logger.info(f"{'='*60}")
        logger.info(cfg['label'])
        logger.info(f"{'='*60}")
        ok = await run_test(api_key, athlete_id, event['style_id'], event['name'], cfg['render'], cfg['stealth'])
        results[cfg['label']] = ok
        # Small delay between tests
        await asyncio.sleep(2)

    # Summary
    logger.info(f"\n{'='*60}")
    logger.info("SUMMARY")
    logger.info(f"{'='*60}")
    for label, ok in results.items():
        status = "PASS" if ok else "FAIL"
        logger.info(f"  [{status}] {label}")

    working = [l for l, ok in results.items() if ok]
    if working:
        logger.info(f"\nRecommendation: Use '{working[0]}' (cheapest working option)")
    else:
        logger.info(f"\nNo configuration worked. SwimRankings may need a different service.")


def main():
    parser = argparse.ArgumentParser(description='Test ScrapingBee with SwimRankings')
    parser.add_argument('--key', required=True, help='ScrapingBee API key')
    parser.add_argument('--athlete', default='5595315', help='SwimRankings athlete ID')
    parser.add_argument('--style', default=None, help='Single style ID to test')
    parser.add_argument('--render', action='store_true', default=False)
    parser.add_argument('--no-render', action='store_true', default=False)
    parser.add_argument('--stealth', action='store_true', default=False)
    parser.add_argument('--all', action='store_true', default=True, help='Test all configurations')
    args = parser.parse_args()

    if args.style:
        render = not args.no_render
        asyncio.run(run_test(args.key, args.athlete, args.style, f"Style {args.style}", render, args.stealth))
    else:
        asyncio.run(run_all_tests(args.key, args.athlete))


if __name__ == '__main__':
    main()
