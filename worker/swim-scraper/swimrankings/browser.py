"""Browser management and Cloudflare challenge handling."""

import time
import logging
from DrissionPage import ChromiumPage, ChromiumOptions

log = logging.getLogger(__name__)


def create_browser(
    browser_path: str = "/usr/bin/chromium",
    profile_dir: str = "/tmp/swimrankings_profile",
) -> ChromiumPage:
    opts = ChromiumOptions()
    opts.set_browser_path(browser_path)
    opts.set_argument("--no-sandbox")
    opts.set_argument("--disable-blink-features=AutomationControlled")
    opts.set_argument("--window-size", "1920,1080")
    opts.set_argument("--user-data-dir", profile_dir)
    return ChromiumPage(addr_or_opts=opts)


def wait_for_cloudflare(page: ChromiumPage, timeout: int = 90) -> bool:
    log.info("Waiting for Cloudflare challenge to clear...")
    start = time.time()
    consecutive_errors = 0

    while time.time() - start < timeout:
        elapsed = int(time.time() - start)
        try:
            title = page.title or ""
            url = page.url or ""
            consecutive_errors = 0
        except Exception:
            consecutive_errors += 1
            if consecutive_errors > 15:
                log.error(f"Browser connection lost after {elapsed}s")
                return False
            time.sleep(2)
            continue

        is_cf = "Just a moment" in title

        if not is_cf and "swimrankings" in url:
            log.info(f"Cloudflare cleared (took ~{elapsed}s)")
            time.sleep(2)
            return True

        if is_cf:
            try:
                cf_iframe = page.ele("css:iframe[src*='challenges.cloudflare.com']", timeout=1)
                if cf_iframe:
                    log.debug(f"[{elapsed}s] Clicking Turnstile iframe")
                    cf_iframe.click()
                    time.sleep(5)
                    continue
            except Exception:
                pass

        if elapsed % 10 == 0 and elapsed > 0:
            log.debug(f"[{elapsed}s] Still waiting (title: {title[:50]})")

        time.sleep(1)

    log.error("Timed out waiting for Cloudflare")
    return False


def fetch_page(page: ChromiumPage, url: str, rate_limiter=None) -> str:
    if rate_limiter:
        rate_limiter.wait()
    page.get(url)
    if not wait_for_cloudflare(page):
        return ""
    time.sleep(2)
    return page.html or ""


def warm_up(page: ChromiumPage) -> bool:
    log.info("Warming up session on homepage...")
    page.get("https://www.swimrankings.net/")
    return wait_for_cloudflare(page)
