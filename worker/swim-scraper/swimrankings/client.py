"""High-level client for scraping swimrankings.net."""

import time
import logging

from .models import Athlete, RaceResult, Meet, AthleteHistory
from .parsers import (
    parse_athlete_search_results,
    parse_event_list,
    parse_season_list,
    parse_event_history,
    parse_meet_list,
    parse_athlete_name,
    parse_athlete_details,
)
from .browser import create_browser, fetch_page, warm_up
from .auth import login, is_logged_in, load_credentials, save_credentials
from . import urls
from .rate_limit import RateLimiter

log = logging.getLogger(__name__)


class SwimRankings:
    """Client for scraping swimrankings.net.

    Usage:
        with SwimRankings(email="x", password="y") as sr:
            athletes = sr.search("Adam Peaty")
            history = sr.history("4636962")
    """

    def __init__(
        self,
        email=None,
        password=None,
        rate_limit_min=2.0,
        rate_limit_max=5.0,
        browser_path="/usr/bin/chromium",
        profile_dir="/tmp/swimrankings_profile",
        cf_timeout=90,
        cache=None,
        refresh=False,
    ):
        self.email = email
        self.password = password
        self.browser_path = browser_path
        self.profile_dir = profile_dir
        self.cf_timeout = cf_timeout
        self.rate_limiter = RateLimiter(min_delay=rate_limit_min, max_delay=rate_limit_max)
        self.page = None
        self.started = False
        self.cache = cache
        self.refresh = refresh

    def start(self) -> "SwimRankings":
        """Create browser, warm up the session, and auto-login."""
        log.info("Starting SwimRankings client...")
        self.page = create_browser(
            browser_path=self.browser_path,
            profile_dir=self.profile_dir,
        )
        warm_up(self.page)
        self._auto_login()
        self.started = True
        return self

    def close(self):
        """Shut down the browser."""
        if self.page is not None:
            try:
                self.page.quit()
            except Exception:
                pass
            self.page = None
        self.started = False
        log.info("SwimRankings client closed.")

    def __enter__(self):
        return self.start()

    def __exit__(self, *args):
        self.close()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _auto_login(self):
        """Attempt login using stored or provided credentials."""
        if is_logged_in(self.page):
            log.info("Already logged in.")
            return

        email, password = self.email, self.password
        if not email or not password:
            creds = load_credentials()
            if creds:
                email, password = creds
            else:
                log.warning("No credentials available — skipping login.")
                return

        login(self.page, email, password)

    def _fetch(self, url: str) -> str:
        """Fetch a page through the browser with rate limiting."""
        return fetch_page(self.page, url, rate_limiter=self.rate_limiter)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def search(self, name: str, nation: str | None = None) -> list[Athlete]:
        """Search for athletes by name, optionally filtered by nation."""
        parts = name.strip().split(None, 1)
        lastname = parts[-1] if parts else name
        firstname = parts[0] if len(parts) > 1 else ""

        html = self._fetch(urls.athlete_search())

        try:
            if nation:
                nation_dropdown = self.page.ele("css:select[name='nationId']", timeout=5)
                if nation_dropdown:
                    nation_dropdown.select.by_text(nation, timeout=3)
                    time.sleep(0.5)

            lastname_input = self.page.ele("#athlete_lastname", timeout=5)
            if lastname_input:
                lastname_input.clear()
                lastname_input.input(lastname)
                time.sleep(0.5)

            if firstname:
                firstname_input = self.page.ele("#athlete_firstname", timeout=5)
                if firstname_input:
                    firstname_input.clear()
                    firstname_input.input(firstname)
                    time.sleep(0.5)

            search_btn = self.page.ele("css:input[type='submit']", timeout=5)
            if search_btn:
                search_btn.click()
                time.sleep(3)

            html = self.page.html or ""
        except Exception as e:
            log.error(f"Search interaction failed: {e}")
            return []

        athletes = parse_athlete_search_results(html)
        log.info(f"Search '{name}' returned {len(athletes)} athlete(s).")

        if self.cache:
            for athlete in athletes:
                self.cache.put_athlete(athlete)

        return athletes

    def personal_bests(self, athlete_id: str) -> list[RaceResult]:
        """Get personal best times for an athlete (first result per event/course)."""
        if self.cache and not self.refresh:
            cached = self.cache.get_bests(athlete_id)
            if cached is not None:
                log.info(f"Cache hit: personal bests for {athlete_id}")
                return cached

        html = self._fetch(urls.athlete_detail(athlete_id))
        events = parse_event_list(html)
        log.info(f"Found {len(events)} events for athlete {athlete_id}.")

        bests: list[RaceResult] = []
        for ev in events:
            ev_html = self._fetch(urls.athlete_event(athlete_id, ev["style_id"]))
            results = parse_event_history(ev_html, ev["name"])
            seen_courses: set[str] = set()
            for r in results:
                if r.course not in seen_courses:
                    seen_courses.add(r.course)
                    bests.append(r)

        log.info(f"Collected {len(bests)} personal best(s) for athlete {athlete_id}.")

        if self.cache:
            self.cache.put_bests(athlete_id, bests)
        return bests

    def history(self, athlete_id: str) -> AthleteHistory:
        """Get full race history for an athlete across all events and seasons."""
        if self.cache and not self.refresh:
            cached_results = self.cache.get_results(athlete_id)
            if cached_results is not None:
                log.info(f"Cache hit: history for {athlete_id}")
                cached_athlete = self.cache.get_athlete(athlete_id)
                athlete_name = cached_athlete.name if cached_athlete else ""
                events = sorted(set(r.event for r in cached_results))
                seasons = sorted(set(r.date.split()[-1] for r in cached_results if r.date), reverse=True)
                return AthleteHistory(
                    athlete_id=athlete_id,
                    athlete_name=athlete_name,
                    events=events,
                    seasons=seasons,
                    results=cached_results,
                )

        html = self._fetch(urls.athlete_detail(athlete_id))
        athlete_name = parse_athlete_name(html)
        events = parse_event_list(html)
        seasons = parse_season_list(html)
        log.info(
            f"Athlete {athlete_id} ({athlete_name}): "
            f"{len(events)} event(s), {len(seasons)} season(s)."
        )

        all_results: list[RaceResult] = []
        for ev in events:
            ev_html = self._fetch(urls.athlete_event(athlete_id, ev["style_id"]))
            results = parse_event_history(ev_html, ev["name"])
            all_results.extend(results)
            log.debug(f"  {ev['name']}: {len(results)} result(s)")

        log.info(f"Total history: {len(all_results)} result(s) for athlete {athlete_id}.")

        if self.cache:
            self.cache.put_results(athlete_id, all_results)
            self.cache.put_athlete(Athlete(id=athlete_id, name=athlete_name))

        return AthleteHistory(
            athlete_id=athlete_id,
            athlete_name=athlete_name,
            events=[ev["name"] for ev in events],
            seasons=seasons,
            results=all_results,
        )

    def recent_meets(self) -> list[Meet]:
        """Fetch the list of recent meets."""
        html = self._fetch(urls.recent_meets())
        meets = parse_meet_list(html)
        log.info(f"Found {len(meets)} recent meet(s).")
        return meets

    def login(self, email: str, password: str):
        """Manually log in and persist credentials."""
        save_credentials(email, password)
        login(self.page, email, password)

    def dump(self, url: str) -> str:
        """Fetch raw HTML from any URL. Dev tool for parser development."""
        return self._fetch(url)

    def athlete_details(self, athlete_id: str) -> Athlete:
        """Get enriched athlete profile with nation, YoB, gender, club."""
        if self.cache and not self.refresh:
            cached = self.cache.get_athlete(athlete_id)
            if cached is not None:
                log.info(f"Cache hit: athlete details for {athlete_id}")
                return cached

        html = self._fetch(urls.athlete_detail(athlete_id))
        name = parse_athlete_name(html)
        details = parse_athlete_details(html)
        athlete = Athlete(
            id=athlete_id,
            name=name,
            nation=details.get("nation", ""),
            year_of_birth=details.get("year_of_birth", ""),
            gender=details.get("gender", ""),
            club=details.get("club", ""),
        )

        if self.cache:
            self.cache.put_athlete(athlete)
        return athlete

    def compare(self, id1: str, id2: str) -> "Comparison":
        """Compare personal bests of two athletes side-by-side."""
        from .models import Comparison, ComparisonRow, parse_time

        bests_a = self.personal_bests(id1)
        bests_b = self.personal_bests(id2)
        details_a = self.athlete_details(id1)
        details_b = self.athlete_details(id2)

        index_b = {}
        for r in bests_b:
            index_b[(r.event, r.course)] = r

        rows = []
        for r_a in bests_a:
            key = (r_a.event, r_a.course)
            r_b = index_b.get(key)
            if r_b:
                time_a = parse_time(r_a.time)
                time_b = parse_time(r_b.time)
                diff = time_a - time_b
                rows.append(ComparisonRow(
                    event=r_a.event,
                    course=r_a.course,
                    time_a=r_a.time,
                    time_b=r_b.time,
                    points_a=r_a.points,
                    points_b=r_b.points,
                    diff=f"{diff:+.2f}",
                ))

        return Comparison(athlete_a=details_a, athlete_b=details_b, events=rows)

    def progression(self, athlete_id: str, event_query: str = "", style_id: str = "") -> list[RaceResult]:
        """Get all results for one event, sorted chronologically (oldest first).

        Args:
            athlete_id: Athlete ID.
            event_query: Human-readable event name substring (e.g. "100m Breast").
            style_id: Direct style_id (overrides event_query if both given).
        """
        from .parsers import resolve_style_id

        html = self._fetch(urls.athlete_detail(athlete_id))
        events = parse_event_list(html)

        if not style_id:
            match = resolve_style_id(events, event_query)
            style_id = match["style_id"]
            event_name = match["name"]
        else:
            event_name = ""
            for ev in events:
                if ev["style_id"] == style_id:
                    event_name = ev["name"]
                    break

        ev_html = self._fetch(urls.athlete_event(athlete_id, style_id))
        results = parse_event_history(ev_html, event_name)
        results.reverse()
        return results

    def meet_search(self, nation: str | None = None) -> list[Meet]:
        """Search meets, optionally filtered by nation."""
        html = self._fetch(urls.meet_search())
        if nation:
            try:
                nation_dropdown = self.page.ele("css:select[name='nationId']", timeout=5)
                if nation_dropdown:
                    nation_dropdown.select.by_text(nation, timeout=3)
                    time.sleep(0.5)
                submit = self.page.ele("css:input[type='submit']", timeout=5)
                if submit:
                    submit.click()
                    time.sleep(3)
                html = self.page.html or ""
            except Exception as e:
                log.error(f"Meet search interaction failed: {e}")
        return parse_meet_list(html)

    def meet_results(self, meet_id: str, gender: str | None = None, style_id: str | None = None) -> list:
        """Get results from a specific meet."""
        if self.cache and not self.refresh:
            cached = self.cache.get_meet_results(meet_id)
            if cached is not None:
                log.info(f"Cache hit: meet results for {meet_id}")
                return cached

        from .parsers import parse_meet_results
        html = self._fetch(urls.meet_results(meet_id, gender=gender, style_id=style_id))
        results = parse_meet_results(html)

        if self.cache:
            self.cache.put_meet_results(meet_id, results)
        return results

    def meet_details(self, meet_id: str) -> Meet:
        """Get enriched meet details."""
        if self.cache and not self.refresh:
            cached = self.cache.get_meet(meet_id)
            if cached is not None:
                log.info(f"Cache hit: meet details for {meet_id}")
                return cached

        from .parsers import parse_meet_details
        html = self._fetch(urls.meet_detail(meet_id))
        meets = parse_meet_list(html)
        details = parse_meet_details(html)
        name = meets[0].name if meets else ""
        meet = Meet(
            id=meet_id, name=name,
            date=details.get("date", ""),
            city=details.get("city", ""),
            nation=details.get("nation", ""),
            course=details.get("course", ""),
        )

        if self.cache:
            self.cache.put_meet(meet)
        return meet

    def rankings(self, style_id: str, gender: str, nation_id: int = 0, season: str | None = None) -> list:
        """Get rankings for a specific event."""
        from .parsers import parse_rankings_page
        html = self._fetch(urls.rankings(style_id, gender, nation_id, season))
        return parse_rankings_page(html)
