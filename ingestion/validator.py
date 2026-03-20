"""Validator for Claude classifier output.

Sanitizes raw JSON dicts from the classifier into validated
WorkoutMetadata models, with fuzzy enum matching and type coercion.
"""

from __future__ import annotations

import logging
from typing import Optional

from ingestion.models import (
    DistanceUnit,
    EnergyZone,
    TrainingFocus,
    WorkoutMetadata,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Alias maps — lowercased alias → canonical enum value
# ---------------------------------------------------------------------------

_TRAINING_FOCUS_ALIASES: dict[str, str] = {
    # sprint
    "speed": "sprint",
    "fast": "sprint",
    "power": "sprint",
    # endurance
    "aerobic": "endurance",
    "distance": "endurance",
    "base": "endurance",
    # technique
    "drill": "technique",
    "form": "technique",
    "stroke": "technique",
    # recovery
    "warm up": "recovery",
    "warmup": "recovery",
    "easy": "recovery",
    # race_prep
    "race": "race_prep",
    "taper": "race_prep",
    "competition": "race_prep",
    # IM
    "medley": "IM",
    "im": "IM",
    # mixed
    "general": "mixed",
    "varied": "mixed",
    "all": "mixed",
    # kick
    "kick": "kick"
}

_ENERGY_ZONE_ALIASES: dict[str, str] = {
    # EN1
    "easy": "EN1",
    "recovery": "EN1",
    # EN2
    "aerobic": "EN2",
    "moderate": "EN2",
    "steady": "EN2",
    # EN3
    "threshold": "EN3",
    "tempo": "EN3",
    # SP1
    "vo2max": "SP1",
    "vo2": "SP1",
    "hard": "SP1",
    # SP2
    "anaerobic": "SP2",
    "race": "SP2",
    "race_pace": "SP2",
    # SP3
    "sprint": "SP3",
    "max": "SP3",
    "all_out": "SP3",
    # mixed
    "general": "mixed",
    "varied": "mixed",
}

_DISTANCE_UNIT_ALIASES: dict[str, str] = {
    "yard": "yards",
    "y": "yards",
    "meter": "meters",
    "m": "meters",
}


# ---------------------------------------------------------------------------
# Fuzzy resolvers
# ---------------------------------------------------------------------------

def _resolve_enum_value(
    raw_value: str,
    enum_cls: type,
    alias_map: dict[str, str],
    field_name: str,
) -> Optional[str]:
    """Resolve a raw string to a valid enum value, using aliases if needed.

    Returns the canonical enum value string, or None if unresolvable.
    """
    lowered = raw_value.strip().lower()

    # 1. Try exact match against enum values (case-insensitive)
    for member in enum_cls:
        if member.value.lower() == lowered:
            return member.value

    # 2. Try alias map
    canonical = alias_map.get(lowered)
    if canonical is not None:
        logger.warning(
            "Fuzzy match for %s: '%s' -> '%s'", field_name, raw_value, canonical
        )
        return canonical

    # 3. Unresolvable
    logger.warning(
        "Unrecognized %s value '%s', falling back to default", field_name, raw_value
    )
    return None


def _coerce_int(value: object, field_name: str) -> int:
    """Coerce a value to int, defaulting to 0 on failure."""
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        try:
            return int(value)
        except ValueError:
            logger.warning(
                "Cannot coerce %s value '%s' to int, defaulting to 0",
                field_name, value,
            )
            return 0
    return 0


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def validate_classifier_output(raw: dict | None) -> WorkoutMetadata:
    """Validate and sanitize raw classifier output into a WorkoutMetadata.

    Handles None/empty input, fuzzy enum matching, and string-to-int coercion.
    Pydantic field validators on WorkoutMetadata handle clamping.

    Parameters
    ----------
    raw:
        The raw JSON dict from the classifier, or None.

    Returns
    -------
    WorkoutMetadata:
        A validated metadata instance with defaults for any missing/invalid fields.
    """
    if not raw:
        return WorkoutMetadata()

    cleaned: dict[str, object] = {}

    # --- Enum fields with fuzzy matching ---
    if "training_focus" in raw and raw["training_focus"] is not None:
        resolved = _resolve_enum_value(
            str(raw["training_focus"]), TrainingFocus, _TRAINING_FOCUS_ALIASES, "training_focus"
        )
        if resolved is not None:
            cleaned["training_focus"] = resolved

    if "energy_zone" in raw and raw["energy_zone"] is not None:
        resolved = _resolve_enum_value(
            str(raw["energy_zone"]), EnergyZone, _ENERGY_ZONE_ALIASES, "energy_zone"
        )
        if resolved is not None:
            cleaned["energy_zone"] = resolved

    if "distance_unit" in raw and raw["distance_unit"] is not None:
        resolved = _resolve_enum_value(
            str(raw["distance_unit"]), DistanceUnit, _DISTANCE_UNIT_ALIASES, "distance_unit"
        )
        if resolved is not None:
            cleaned["distance_unit"] = resolved

    # level and source — pass through for Pydantic to validate (no aliases needed)
    for passthrough in ("level", "source"):
        if passthrough in raw and raw[passthrough] is not None:
            cleaned[passthrough] = raw[passthrough]

    # --- Numeric fields with string coercion ---
    int_fields = (
        "total_distance", "estimated_minutes",
        "pct_free", "pct_back", "pct_breast", "pct_fly",
        "pct_im", "pct_kick", "pct_drill",
    )
    for field in int_fields:
        if field in raw and raw[field] is not None:
            cleaned[field] = _coerce_int(raw[field], field)

    return WorkoutMetadata(**cleaned)
