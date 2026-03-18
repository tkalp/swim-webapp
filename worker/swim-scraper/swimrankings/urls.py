"""URL endpoint builders for swimrankings.net.

Each function returns a complete URL string. No side effects.
"""

BASE = "https://www.swimrankings.net/index.php"


def athlete_search(nation_id: int = 0) -> str:
    """Search page for finding athletes by name."""
    return f"{BASE}?page=athleteSelect&nationId={nation_id}&selectPage=SEARCH"


def athlete_detail(athlete_id: str) -> str:
    """Athlete profile / personal bests page."""
    return f"{BASE}?page=athleteDetail&athleteId={athlete_id}"


def athlete_event(athlete_id: str, style_id: str) -> str:
    """Athlete event history (all results for one event)."""
    return f"{BASE}?page=athleteDetail&athleteId={athlete_id}&styleId={style_id}"


def athlete_event_season(athlete_id: str, style_id: str, season: str) -> str:
    """Athlete event history filtered to a specific season."""
    return (
        f"{BASE}?page=athleteDetail&athleteId={athlete_id}"
        f"&styleId={style_id}&resultSeason={season}"
    )


def meet_detail(meet_id: str) -> str:
    """Meet overview page."""
    return f"{BASE}?page=meetDetail&meetId={meet_id}"


def meet_results(meet_id: str, gender: str | None = None, style_id: str | None = None) -> str:
    """Meet results page with optional gender/event filters."""
    url = f"{BASE}?page=meetDetail&meetId={meet_id}"
    if gender:
        url += f"&gender={gender}"
    if style_id:
        url += f"&styleId={style_id}"
    return url


def meet_search(nation_id: int = 0) -> str:
    """Meet search/browse page."""
    return f"{BASE}?page=meetSelect&nationId={nation_id}"


def recent_meets() -> str:
    """Recent meets listing page."""
    return f"{BASE}?page=meetSelect&selectPage=RECENT"


def rankings(style_id: str, gender: str, nation_id: int = 0, season: str | None = None) -> str:
    """Rankings/leaderboard page for a specific event."""
    url = f"{BASE}?page=rankingDetail&styleId={style_id}&gender={gender}&nationId={nation_id}"
    if season:
        url += f"&season={season}"
    return url
