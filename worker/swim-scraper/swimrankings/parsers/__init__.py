"""Parser subpackage — re-exports all parse functions for backward compatibility."""

from .athlete import (
    parse_athlete_search_results,
    parse_event_list,
    parse_season_list,
    parse_event_history,
    parse_athlete_name,
    parse_athlete_details,
    resolve_style_id,
)
from .meet import (
    parse_meet_list,
    parse_meet_details,
    parse_meet_results,
)
from .rankings import parse_rankings_page

__all__ = [
    "parse_athlete_search_results",
    "parse_event_list",
    "parse_season_list",
    "parse_event_history",
    "parse_athlete_name",
    "parse_athlete_details",
    "resolve_style_id",
    "parse_meet_list",
    "parse_meet_details",
    "parse_meet_results",
    "parse_rankings_page",
]
