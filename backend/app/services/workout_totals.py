"""
Workout Totals Module

Pure-function module for computing aggregated totals, breakdowns, and percentages
from structured workout sections/sets. No external dependencies.
"""

from typing import Any

# Valid enum values
VALID_STROKES: frozenset[str] = frozenset(
    {"freestyle", "backstroke", "breaststroke", "butterfly", "im", "choice"}
)
VALID_ACTIVITIES: frozenset[str] = frozenset({"swim", "kick", "pull", "drill"})
VALID_ENERGY_ZONES: frozenset[str] = frozenset({"en1", "en2", "en3", "en4", "sprint"})

# Alias mappings
_STROKE_ALIASES: dict[str, str] = {
    "free": "freestyle",
    "fr": "freestyle",
    "back": "backstroke",
    "bk": "backstroke",
    "breast": "breaststroke",
    "br": "breaststroke",
    "brst": "breaststroke",
    "fly": "butterfly",
    "bf": "butterfly",
    "individual medley": "im",
    "medley": "im",
    "ch": "choice",
}

_ACTIVITY_ALIASES: dict[str, str] = {
    "kicking": "kick",
    "k": "kick",
    "pulling": "pull",
    "drill": "drill",
    "drills": "drill",
    "dr": "drill",
    "swimming": "swim",
    "sprint": "swim",
}

_ZONE_ALIASES: dict[str, str] = {
    "sp": "sprint",
    "sp1": "sprint",
    "sp2": "sprint",
    "sp3": "sprint",
}


def _normalize_stroke(stroke: str | None) -> str:
    """Map a raw stroke string to a valid VALID_STROKES value.

    Common aliases (free→freestyle, back→backstroke, etc.) are resolved first.
    Unknown values default to "choice".
    """
    if not stroke:
        return "choice"
    normalized = stroke.strip().lower()
    if normalized in VALID_STROKES:
        return normalized
    if normalized in _STROKE_ALIASES:
        return _STROKE_ALIASES[normalized]
    return "choice"


def _normalize_activity(activity: str | None) -> str:
    """Map a raw activity string to a valid VALID_ACTIVITIES value.

    Common aliases (kicking→kick, etc.) are resolved first.
    Unknown values default to "swim".
    """
    if not activity:
        return "swim"
    normalized = activity.strip().lower()
    if normalized in VALID_ACTIVITIES:
        return normalized
    if normalized in _ACTIVITY_ALIASES:
        return _ACTIVITY_ALIASES[normalized]
    return "swim"


def _normalize_energy_zone(zone: str | None) -> str:
    """Map a raw energy zone string to a valid VALID_ENERGY_ZONES value.

    Unknown values default to "en2".
    """
    if not zone:
        return "en2"
    normalized = zone.strip().lower()
    if normalized in VALID_ENERGY_ZONES:
        return normalized
    if normalized in _ZONE_ALIASES:
        return _ZONE_ALIASES[normalized]
    return "en2"


def _build_breakdown(
    tallies: dict[str, int | float],
    total_meters: int | float,
) -> dict[str, dict[str, Any]]:
    """Convert a {key: meters} tally dict into a breakdown with percentages.

    Each entry in the result has:
        - meters: the raw meter count
        - percentage: round((meters / total_meters) * 100, 1)

    Entries with 0 meters are omitted. Returns an empty dict when total_meters is 0.
    """
    if total_meters == 0:
        return {}

    result: dict[str, dict[str, Any]] = {}
    for key, meters in tallies.items():
        if meters == 0:
            continue
        result[key] = {
            "meters": meters,
            "percentage": round((meters / total_meters) * 100, 1),
        }
    return result


def compute_totals(sections: list[dict]) -> dict:
    """Compute aggregated totals and breakdowns from structured workout sections.

    Args:
        sections: List of section dicts, each containing a "sets" list.
                  Each set dict must include:
                    - reps (int): number of repetitions
                    - distance (int | float): meters per rep
                    - stroke (str, optional): raw stroke name
                    - activity (str, optional): raw activity name
                    - energy_zone (str, optional): raw energy zone name

    Returns:
        dict with keys:
            - total_meters (int | float): sum of reps * distance across all sets
            - total_sets (int): count of individual set entries
            - stroke_breakdown (dict): per-stroke meters + percentage
            - activity_breakdown (dict): per-activity meters + percentage
            - energy_zone_breakdown (dict): per-zone meters + percentage
    """
    total_meters: int | float = 0
    total_sets: int = 0

    stroke_tallies: dict[str, int | float] = {s: 0 for s in VALID_STROKES}
    activity_tallies: dict[str, int | float] = {a: 0 for a in VALID_ACTIVITIES}
    zone_tallies: dict[str, int | float] = {z: 0 for z in VALID_ENERGY_ZONES}

    for section in sections:
        rounds: int = max(1, int(section.get("rounds", 1) or 1))
        sets: list[dict] = section.get("sets", [])
        for swim_set in sets:
            reps: int = int(swim_set.get("reps", 0))
            distance: int | float = swim_set.get("distance", 0)
            set_meters = reps * distance * rounds

            total_meters += set_meters
            total_sets += 1

            stroke = _normalize_stroke(swim_set.get("stroke"))
            activity = _normalize_activity(swim_set.get("activity"))
            zone = _normalize_energy_zone(swim_set.get("energy_zone"))

            stroke_tallies[stroke] += set_meters
            activity_tallies[activity] += set_meters
            zone_tallies[zone] += set_meters

    return {
        "total_meters": total_meters,
        "total_sets": total_sets,
        "stroke_breakdown": _build_breakdown(stroke_tallies, total_meters),
        "activity_breakdown": _build_breakdown(activity_tallies, total_meters),
        "energy_zone_breakdown": _build_breakdown(zone_tallies, total_meters),
    }
