"""HTML parser for rankings/leaderboard pages on swimrankings.net.

All functions are pure: HTML string in, model objects out.
"""

import re
from ..models import Athlete, Ranking


def parse_rankings_page(html: str) -> list[Ranking]:
    """Parse the rankings table into Ranking objects."""
    rankings: list[Ranking] = []

    rows = re.findall(
        r'<tr[^>]*class="(?:rankingList|athleteRanking)\d*"[^>]*>(.*?)</tr>',
        html,
        re.DOTALL,
    )
    for row in rows:
        rank_match = re.search(r'class="rank"[^>]*>(\d+)', row)
        rank = rank_match.group(1) if rank_match else ""

        athlete_match = re.search(r'athleteId=(\d+)[^>]*>([^<]+)</a>', row)
        if not athlete_match:
            continue
        athlete_id = athlete_match.group(1)
        athlete_name = athlete_match.group(2).strip()

        nation_match = re.search(r'alt="([A-Z]{3})"', row)
        nation = nation_match.group(1) if nation_match else ""

        athlete = Athlete(id=athlete_id, name=athlete_name, nation=nation)

        time_match = re.search(r'class="time"[^>]*>([\d:\.]+)', row)
        time_val = time_match.group(1) if time_match else ""

        points_match = re.search(r'class="code"[^>]*>(\d+)', row)
        points = points_match.group(1) if points_match else ""

        city_match = re.search(r'class="city"[^>]*>.*?title="([^"]*)"', row, re.DOTALL)
        meet = city_match.group(1) if city_match else ""

        date_match = re.search(r'class="date"[^>]*>([^<]+)', row)
        date = date_match.group(1).strip().replace('\xa0', ' ').replace('&nbsp;', ' ') if date_match else ""

        if time_val:
            rankings.append(Ranking(
                rank=rank, athlete=athlete, time=time_val,
                points=points, meet=meet, date=date,
            ))

    return rankings
