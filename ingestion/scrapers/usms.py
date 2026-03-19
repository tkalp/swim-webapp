"""USMS workout library scraper.

Paginates through https://www.usms.org/workout-library, extracts
workout detail URLs, scrapes each for title + structured workout text,
and filters to only workouts that contain set notation (e.g. 4 x 100).
"""

from __future__ import annotations

import logging
import re
import time
from typing import Optional

import httpx
from bs4 import BeautifulSoup, Tag

from ingestion.models import RawWorkout
from ingestion.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

_SET_NOTATION_RE = re.compile(r"\d+\s*x\s*\d+", re.IGNORECASE)

_USER_AGENT = (
    "AquilusBot/1.0 (+https://github.com/aquilus; swim workout research)"
)
_REQUEST_TIMEOUT = 30.0
_POLITE_DELAY = 1.0  # seconds between requests
_BASE_URL = "https://www.usms.org"
_LIBRARY_URL = f"{_BASE_URL}/workout-library"


class USMSScraper(BaseScraper):
    """Scrape workouts from the USMS workout library."""

    @property
    def source_name(self) -> str:
        return "USMS"

    def __init__(self, *, max_pages: int = 50, delay: float = _POLITE_DELAY) -> None:
        self._max_pages = max_pages
        self._delay = delay

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def scrape(self) -> list[RawWorkout]:
        """Discover workout URLs and scrape each one.

        Returns a list of RawWorkout objects for workouts that pass
        the set-notation filter.
        """
        workouts: list[RawWorkout] = []

        with httpx.Client(
            headers={"User-Agent": _USER_AGENT},
            timeout=_REQUEST_TIMEOUT,
            follow_redirects=True,
        ) as client:
            urls = self._discover_workouts(client)
            logger.info("Discovered %d workout URLs from USMS", len(urls))

            for i, url in enumerate(urls):
                raw = self._scrape_workout(client, url)
                if raw is not None:
                    workouts.append(raw)

                if i < len(urls) - 1:
                    time.sleep(self._delay)

        logger.info(
            "USMS scrape complete: %d workouts collected from %d URLs",
            len(workouts),
            len(urls),
        )
        return workouts

    # ------------------------------------------------------------------
    # Discovery
    # ------------------------------------------------------------------

    def _discover_workouts(self, client: httpx.Client) -> list[str]:
        """Paginate through the USMS workout library and collect detail URLs."""
        urls: list[str] = []
        seen: set[str] = set()

        for page in range(1, self._max_pages + 1):
            params = {"page": page} if page > 1 else {}
            try:
                resp = client.get(_LIBRARY_URL, params=params)
                resp.raise_for_status()
            except httpx.HTTPError as exc:
                logger.warning(
                    "Failed to fetch USMS listing page %d: %s", page, exc
                )
                break

            soup = BeautifulSoup(resp.text, "html.parser")
            page_urls = self._extract_workout_urls(soup)

            if not page_urls:
                logger.debug("No workout links on page %d — stopping", page)
                break

            new_count = 0
            for url in page_urls:
                if url not in seen:
                    seen.add(url)
                    urls.append(url)
                    new_count += 1

            logger.debug(
                "Page %d: found %d links (%d new)", page, len(page_urls), new_count
            )

            # If every link was already seen, we've looped
            if new_count == 0:
                break

            time.sleep(self._delay)

        return urls

    def _extract_workout_urls(self, soup: BeautifulSoup) -> list[str]:
        """Pull workout detail URLs from a listing page."""
        urls: list[str] = []
        for anchor in soup.find_all("a", href=True):
            href: str = anchor["href"]
            # USMS workout detail paths look like /workout-library/…
            if "/workout-library/" in href and href != "/workout-library/":
                full_url = href if href.startswith("http") else f"{_BASE_URL}{href}"
                # Avoid query strings that are pagination / filters
                if "?" not in full_url:
                    urls.append(full_url)
        return urls

    # ------------------------------------------------------------------
    # Individual workout scraping
    # ------------------------------------------------------------------

    def _scrape_workout(self, client: httpx.Client, url: str) -> Optional[RawWorkout]:
        """Fetch a single workout page and extract a RawWorkout.

        Returns None if the page can't be fetched, parsed, or if the
        workout text lacks set notation.
        """
        try:
            resp = client.get(url)
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            logger.warning("Failed to fetch workout at %s: %s", url, exc)
            return None

        try:
            return self._parse_workout_page(resp.text, url)
        except Exception:
            logger.exception("Error parsing workout page %s", url)
            return None

    def _parse_workout_page(self, html: str, url: str) -> Optional[RawWorkout]:
        """Parse workout HTML into a RawWorkout, or None if unsuitable."""
        soup = BeautifulSoup(html, "html.parser")

        title = self._extract_title(soup)
        if not title:
            logger.debug("No title found at %s", url)
            return None

        text = self._extract_workout_text(soup)
        if not text:
            logger.debug("No workout text found at %s", url)
            return None

        # Filter: must contain set notation like "4 x 100"
        if not _SET_NOTATION_RE.search(text):
            logger.debug("No set notation in workout at %s — skipping", url)
            return None

        return RawWorkout(
            title=title.strip(),
            text=text.strip(),
            source="scraped",
            source_url=url,
            source_name=self.source_name,
        )

    def _extract_title(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract the workout title from the page."""
        # Try <h1> first, then fall back to <title>
        h1 = soup.find("h1")
        if h1 and h1.get_text(strip=True):
            return h1.get_text(strip=True)

        title_tag = soup.find("title")
        if title_tag and title_tag.get_text(strip=True):
            raw = title_tag.get_text(strip=True)
            # Strip common suffixes like " | U.S. Masters Swimming"
            return raw.split("|")[0].strip()

        return None

    def _extract_workout_text(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract the workout body text from the page.

        Tries several common USMS page structures:
        1. A container with class containing 'workout' (e.g. 'workout-body')
        2. The <article> or main content area
        3. Falling back to the largest text block on the page
        """
        # Strategy 1: look for a div/section whose class suggests workout content
        for tag in soup.find_all(["div", "section"], class_=True):
            classes = " ".join(tag.get("class", []))
            if "workout" in classes.lower() and "library" not in classes.lower():
                text = tag.get_text("\n", strip=True)
                if len(text) > 40:
                    return text

        # Strategy 2: <article> tag
        article = soup.find("article")
        if isinstance(article, Tag):
            text = article.get_text("\n", strip=True)
            if len(text) > 40:
                return text

        # Strategy 3: main content area
        main = soup.find("main") or soup.find(id="content") or soup.find(
            class_=re.compile(r"content|main", re.IGNORECASE)
        )
        if isinstance(main, Tag):
            text = main.get_text("\n", strip=True)
            if len(text) > 40:
                return text

        return None
