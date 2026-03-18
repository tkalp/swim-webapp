"""HTML parsers for meet-related pages on swimrankings.net.

All functions are pure: HTML string in, model objects out.
No side effects, no browser dependency, no logging.
"""

import re
from ..models import Meet, MeetResult


def parse_meet_list(html: str) -> list[Meet]:
    """Find meetId links and return deduplicated Meet objects."""
    meets: list[Meet] = []
    links = re.findall(
        r'<a[^>]*meetId=(\d+)[^>]*>([^<]+)</a>', html, re.IGNORECASE
    )
    seen: set[str] = set()
    for meet_id, name in links:
        name = name.strip()
        if name and meet_id not in seen:
            seen.add(meet_id)
            meets.append(Meet(id=meet_id, name=name))
    return meets


def parse_meet_details(html: str) -> dict:
    """Extract meet metadata from the meet detail page.

    Returns dict with keys: date, city, nation, course.
    """
    details = {"date": "", "city": "", "nation": "", "course": ""}

    date_match = re.search(
        r'(\d{1,2}\s+\w+\s+\d{4})\s*-\s*(\d{1,2}\s+\w+\s+\d{4})', html
    )
    if date_match:
        details["date"] = f"{date_match.group(1)} - {date_match.group(2)}"
    else:
        date_match = re.search(r'(\d{1,2}\s+\w+\s+\d{4})', html)
        if date_match:
            details["date"] = date_match.group(1)

    city_match = re.search(r'class="city"[^>]*>([^<]+)', html)
    if city_match:
        details["city"] = city_match.group(1).strip()

    nation_match = re.search(r'class="flag"\s+alt="([A-Z]{3})"', html)
    if nation_match:
        details["nation"] = nation_match.group(1)

    if re.search(r'\b50\s*m\b|Long Course|LCM', html):
        details["course"] = "LCM"
    elif re.search(r'\b25\s*m\b|Short Course|SCM', html):
        details["course"] = "SCM"

    return details


def parse_meet_results(html: str) -> list[MeetResult]:
    """Parse meet results table into MeetResult objects."""
    results: list[MeetResult] = []

    rows = re.findall(
        r'<tr[^>]*class="(?:meetResult|rankingList)\d*"[^>]*>(.*?)</tr>',
        html,
        re.DOTALL,
    )
    for row in rows:
        cells = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
        if len(cells) < 4:
            continue

        athlete_match = re.search(r'athleteId=(\d+)[^>]*>([^<]+)</a>', row)
        athlete_id = athlete_match.group(1) if athlete_match else ""
        athlete_name = athlete_match.group(2).strip() if athlete_match else ""

        nation_match = re.search(r'alt="([A-Z]{3})"', row)
        nation = nation_match.group(1) if nation_match else ""

        time_val = ""
        points = ""
        rank = ""
        for cell in cells:
            clean = re.sub(r'<[^>]+>', '', cell).strip().replace('\xa0', ' ').replace('&nbsp;', ' ')
            if re.search(r'class="time"', cell):
                time_val = clean
            elif re.search(r'class="code"', cell):
                points = clean
            elif re.search(r'class="rank"', cell):
                rank = clean

        if athlete_id and time_val:
            results.append(MeetResult(
                rank=rank,
                athlete_name=athlete_name,
                athlete_id=athlete_id,
                nation=nation,
                time=time_val,
                points=points,
                event="",
                gender="",
            ))

    return results
