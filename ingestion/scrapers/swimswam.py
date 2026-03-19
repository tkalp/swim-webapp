"""SwimSwam 'Workout of the Week' scraper."""

from __future__ import annotations

import logging
import re
from typing import Optional

import httpx
from bs4 import BeautifulSoup, Tag

from ingestion.models import RawWorkout
from ingestion.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_BASE_URL = "https://swimswam.com/tag/workout-of-the-week/page/{page}/"
_USER_AGENT = (
    "AquilusBot/1.0 (+https://github.com/aquilus; swim-workout-research)"
)
_TIMEOUT_S = 20
_MAX_PAGES = 30

# Regex to detect swim-set notation like "4 x 100", "8x50", "10 X 200"
_SET_NOTATION_RE = re.compile(r"\d+\s*[xX]\s*\d+")

# Markers that indicate the end of the workout content — everything after
# the first match (case-insensitive) is trimmed.
_STOP_MARKERS = [
    "about the author",
    "courtesy of",
    "courtesy:",
    "about ",
    "swimswam.com",
    "for more workouts",
    "all swimming drills",
    "related articles",
    "subscribe to",
]


# ---------------------------------------------------------------------------
# Scraper
# ---------------------------------------------------------------------------


class SwimSwamScraper(BaseScraper):
    """Scrape 'Workout of the Week' articles from SwimSwam."""

    def __init__(self, *, max_pages: int = _MAX_PAGES) -> None:
        self._max_pages = max_pages
        self._client = httpx.Client(
            headers={"User-Agent": _USER_AGENT},
            timeout=_TIMEOUT_S,
            follow_redirects=True,
        )

    # -- public interface ---------------------------------------------------

    @property
    def source_name(self) -> str:
        return "SwimSwam"

    def scrape(self) -> list[RawWorkout]:
        """Discover workout articles and scrape each one."""
        urls = self._discover_articles()
        logger.info("Discovered %d candidate article URLs", len(urls))

        workouts: list[RawWorkout] = []
        for url in urls:
            try:
                raw = self._scrape_article(url)
                if raw is not None:
                    workouts.append(raw)
            except Exception:
                logger.exception("Failed to scrape article: %s", url)
        logger.info(
            "Scraped %d workouts from %d articles", len(workouts), len(urls)
        )
        return workouts

    # -- discovery ----------------------------------------------------------

    def _discover_articles(self) -> list[str]:
        """Paginate the WotW tag archive and collect article URLs."""
        urls: list[str] = []
        for page in range(1, self._max_pages + 1):
            page_url = _BASE_URL.format(page=page)
            try:
                resp = self._client.get(page_url)
                if resp.status_code == 404:
                    logger.debug("Page %d returned 404 — stopping", page)
                    break
                resp.raise_for_status()
            except httpx.HTTPError:
                logger.exception(
                    "HTTP error fetching page %d (%s)", page, page_url
                )
                break

            soup = BeautifulSoup(resp.text, "html.parser")
            links = soup.select("h2 a[href]")
            if not links:
                logger.debug("No article links on page %d — stopping", page)
                break

            for tag in links:
                href = tag.get("href", "")
                if isinstance(href, list):
                    href = href[0]
                if href and "workout" in href.lower():
                    urls.append(href)

            logger.debug("Page %d: found %d links", page, len(links))
        return urls

    # -- article scraping ---------------------------------------------------

    def _scrape_article(self, url: str) -> Optional[RawWorkout]:
        """Fetch a single article and extract the workout text."""
        resp = self._client.get(url)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        # Title
        h1 = soup.select_one("h1.entry-title") or soup.find("h1")
        title = h1.get_text(strip=True) if h1 else url.split("/")[-2]

        # Body
        body = self._extract_body(soup)
        if body is None:
            logger.debug("No article body found: %s", url)
            return None

        text = self._clean_body(body)

        # Must contain set notation to qualify as a real workout
        if not _SET_NOTATION_RE.search(text):
            logger.debug("No set notation found, skipping: %s", url)
            return None

        return RawWorkout(
            title=title,
            text=text,
            source="swimswam",
            source_url=url,
            source_name=self.source_name,
        )

    # -- helpers ------------------------------------------------------------

    @staticmethod
    def _extract_body(soup: BeautifulSoup) -> Optional[Tag]:
        """Find the main article body container."""
        for selector in (
            "div.entry-content",
            "article .entry-content",
            "div.post-content",
            "article",
        ):
            el = soup.select_one(selector)
            if el is not None:
                return el
        return None

    @staticmethod
    def _clean_body(body: Tag) -> str:
        """Extract text from the body, truncating at stop markers."""
        # Remove scripts, styles, and share widgets
        for tag in body.select("script, style, .sharedaddy, .jp-relatedposts"):
            tag.decompose()

        text = body.get_text(separator="\n")

        # Truncate at the first stop marker
        lower = text.lower()
        earliest_idx = len(text)
        for marker in _STOP_MARKERS:
            idx = lower.find(marker)
            if idx != -1 and idx < earliest_idx:
                earliest_idx = idx

        text = text[:earliest_idx]

        # Collapse excessive blank lines
        text = re.sub(r"\n{3,}", "\n\n", text).strip()
        return text
