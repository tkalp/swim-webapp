"""HTML parsers for athlete-related pages on swimrankings.net.

All functions are pure: HTML string in, model objects out.
No side effects, no browser dependency, no logging.
"""

import re
from ..models import Athlete, RaceResult
from ..exceptions import EventNotFoundError


def parse_athlete_search_results(html: str) -> list[Athlete]:
    """Find athleteId links and return deduplicated Athlete objects."""
    athletes: list[Athlete] = []
    links = re.findall(
        r'<a[^>]*(?:&amp;|&|\?)athleteId=(\d+)[^>]*>(.*?)</a>', html, re.IGNORECASE | re.DOTALL
    )
    seen: set[str] = set()
    for athlete_id, raw_name in links:
        name = re.sub(r'<[^>]+>', '', raw_name).strip()
        if name and athlete_id not in seen:
            seen.add(athlete_id)
            athletes.append(Athlete(id=athlete_id, name=name))
    return athletes


def parse_event_list(html: str) -> list[dict]:
    """Extract events from the rankingStyleId dropdown.

    Returns list of {"style_id": str, "name": str}, skipping value="0".
    """
    events: list[dict] = []
    dropdown = re.search(
        r'name="rankingStyleId"(.*?)</select>', html, re.DOTALL
    )
    if dropdown:
        options = re.findall(
            r'<option\s+value="(\d+)"[^>]*>([^<]+)</option>',
            dropdown.group(1),
        )
        for style_id, name in options:
            if style_id != "0":
                events.append({"style_id": style_id, "name": name.strip()})
    return events


def parse_season_list(html: str) -> list[str]:
    """Extract years from the resultSeason dropdown, sorted descending."""
    seasons: list[str] = []
    dropdown = re.search(
        r'name="resultSeason"(.*?)</select>', html, re.DOTALL
    )
    if dropdown:
        options = re.findall(r'<option\s+value="(\d{4})"', dropdown.group(1))
        seasons = sorted(options, reverse=True)
    return seasons


def parse_event_history(html: str, event_name: str) -> list[RaceResult]:
    """Parse LCM and SCM sections into RaceResult objects."""
    results: list[RaceResult] = []

    for course_label, course_code in [
        ("Long Course (50m)", "LCM"),
        ("Short Course (25m)", "SCM"),
    ]:
        section_start = html.find(course_label)
        if section_start == -1:
            continue

        table_end = html.find("</table>", section_start)
        section_html = (
            html[section_start:table_end]
            if table_end != -1
            else html[section_start:]
        )

        rows = re.findall(
            r'<tr[^>]*class="athleteRanking\d+"[^>]*>(.*?)</tr>',
            section_html,
            re.DOTALL,
        )
        for row in rows:
            cells = re.findall(
                r'<td[^>]*class="(\w+)"[^>]*>(.*?)</td>', row, re.DOTALL
            )
            time_val = ""
            points = ""
            date = ""
            city = ""
            meet = ""
            for css_class, content in cells:
                clean = (
                    re.sub(r'<[^>]+>', '', content)
                    .strip()
                    .replace('\xa0', ' ')
                    .replace('&nbsp;', ' ')
                )
                if css_class == "time":
                    time_val = clean
                elif css_class == "code":
                    points = clean
                elif css_class == "date":
                    date = clean
                elif css_class == "city":
                    title_match = re.search(r'title="([^"]+)"', content)
                    city = clean
                    if title_match:
                        meet = title_match.group(1)
            if time_val:
                results.append(
                    RaceResult(
                        event=event_name,
                        course=course_code,
                        time=time_val,
                        points=points,
                        date=date,
                        city=city,
                        meet=meet,
                    )
                )

    return results


def parse_athlete_name(html: str) -> str:
    """Extract athlete name from <div id="name"> tag."""
    match = re.search(r'<div id="name">([^<]+)', html)
    return match.group(1).strip() if match else ""


def parse_athlete_details(html: str) -> dict:
    """Extract athlete profile info from the detail page.

    Returns dict with keys: nation, year_of_birth, gender, club.
    Values are empty strings if not found.
    """
    details = {"nation": "", "year_of_birth": "", "gender": "", "club": ""}

    nation_match = re.search(r'class="flag"\s+alt="([A-Z]{3})"', html)
    if not nation_match:
        nation_match = re.search(r'nationId=\d+[^>]*>([A-Z]{3})</a>', html)
    if nation_match:
        details["nation"] = nation_match.group(1)

    yob_match = re.search(r'(?:Born|born|YoB|Year of Birth)[:\s]*(\d{4})', html)
    if yob_match:
        details["year_of_birth"] = yob_match.group(1)

    if re.search(r'\bMale\b|\bgender=M\b|\bMen\b', html, re.IGNORECASE):
        details["gender"] = "M"
    elif re.search(r'\bFemale\b|\bgender=F\b|\bWomen\b', html, re.IGNORECASE):
        details["gender"] = "F"

    club_match = re.search(r'clubId=\d+[^>]*>([^<]+)</a>', html)
    if club_match:
        details["club"] = club_match.group(1).strip()

    return details


def resolve_style_id(events: list[dict], query: str) -> dict:
    """Find a matching event by case-insensitive substring match.

    Args:
        events: List of {"style_id": str, "name": str} from parse_event_list.
        query: User-provided event name substring.

    Returns:
        The first matching event dict.

    Raises:
        EventNotFoundError: If no event matches the query.
    """
    query_lower = query.lower()
    matches = [e for e in events if query_lower in e["name"].lower()]
    if matches:
        return matches[0]
    raise EventNotFoundError(query, [e["name"] for e in events])
