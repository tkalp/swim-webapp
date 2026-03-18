"""
RaceResultConverter — converts swim-scraper RaceResult objects to worker WorkoutResult models.
"""

import logging
import re
from datetime import datetime
from typing import List, Optional, Tuple

from worker.models import WorkoutResult
from worker.constants import get_stroke_enum

logger = logging.getLogger(__name__)


class RaceResultConverter:
    """Converts RaceResult objects (from swim-scraper) to WorkoutResult domain models."""

    # Maps swim-scraper Stroke enum values to worker stroke enums.
    # Stroke.UNKNOWN is intentionally absent — results with Unknown stroke are skipped.
    _STROKE_VALUE_MAP = {
        "Freestyle": "free",
        "Backstroke": "back",
        "Breaststroke": "breast",
        "Butterfly": "fly",
        "Medley": "im",
    }

    @staticmethod
    def parse_date(date_str: Optional[str]) -> str:
        """Parse a date string to ISO format (YYYY-MM-DD).

        Handles non-breaking spaces (\\xa0) and the following formats:
        ``%d %b %Y``, ``%d %B %Y``, ``%d/%m/%Y``, ``%d-%m-%Y``, ``%d.%m.%Y``,
        ``%Y-%m-%d``.

        Returns an empty string for empty or None input.
        """
        if not date_str or not str(date_str).strip():
            return ""

        # Normalise: replace non-breaking spaces and collapse extra whitespace.
        normalized = str(date_str).strip().replace("\xa0", " ").replace("  ", " ")

        formats = [
            "%d %b %Y",   # 22 Nov 2024
            "%d %B %Y",   # 22 November 2024
            "%d/%m/%Y",   # 22/11/2024
            "%d-%m-%Y",   # 22-11-2024
            "%d.%m.%Y",   # 22.11.2024
            "%Y-%m-%d",   # 2024-11-22
        ]

        for fmt in formats:
            try:
                return datetime.strptime(normalized, fmt).strftime("%Y-%m-%d")
            except ValueError:
                continue

        logger.warning("Could not parse date '%s', returning normalised string", date_str)
        return normalized

    @staticmethod
    def parse_event(event_name: str) -> Optional[Tuple[int, str]]:
        """Parse an event name into ``(distance, stroke_enum)``.

        Handles both ``"100m Freestyle"`` and ``"100 Freestyle"`` formats.
        Uses :func:`worker.constants.get_stroke_enum` for stroke mapping.

        Returns ``None`` if the event cannot be parsed.
        """
        if not event_name:
            return None

        # Match optional leading distance with optional 'm' suffix then stroke name.
        # Examples: "100m Freestyle", "100 Freestyle", "200m Individual Medley"
        match = re.match(r"^(\d+)\s*m?\s+(.+)$", event_name.strip(), re.IGNORECASE)
        if not match:
            return None

        try:
            distance = int(match.group(1))
        except ValueError:
            return None

        stroke_name = match.group(2).strip()
        stroke_enum = get_stroke_enum(stroke_name)

        # get_stroke_enum defaults to 'free' when unrecognised; verify the
        # stroke name actually maps rather than blindly accepting the fallback.
        from worker.constants import STROKE_NAME_TO_ENUM
        # Build a case-insensitive lookup to validate.
        normalized_name = " ".join(w.capitalize() for w in stroke_name.split())
        if stroke_name not in STROKE_NAME_TO_ENUM and normalized_name not in STROKE_NAME_TO_ENUM:
            # The name wasn't in the map — treat as unparseable only if stroke_name is
            # clearly not freestyle-like (i.e. the fallback would be wrong).
            # Acceptable names: anything in the map or its capitalised form.
            # Reject anything outside of known names.
            known_lower = {k.lower() for k in STROKE_NAME_TO_ENUM}
            if stroke_name.lower() not in known_lower:
                logger.debug("parse_event: unrecognised stroke '%s' in event '%s'", stroke_name, event_name)
                return None

        return (distance, stroke_enum)

    @staticmethod
    def synthesize_result_id(
        athlete_id: str,
        date: str,
        distance: int,
        stroke: str,
        course: str,
        time: str,
        meet: str,
    ) -> str:
        """Build a deterministic dedup key for a race result.

        Format: ``"{athlete_id}_{date}_{distance}_{stroke}_{course}_{time}_{meet}"``
        """
        return f"{athlete_id}_{date}_{distance}_{stroke}_{course}_{time}_{meet}"

    @classmethod
    def convert(
        cls,
        race_result,
        swimmer_id: str,
        athlete_id: str,
    ) -> Optional[WorkoutResult]:
        """Convert a single ``RaceResult`` to a ``WorkoutResult``.

        Stroke is resolved from ``race_result.stroke.value`` via
        :attr:`_STROKE_VALUE_MAP`.  Results with ``Stroke.UNKNOWN`` are
        skipped (returns ``None``).  Falls back to :meth:`parse_event` when
        the stroke value is unexpectedly absent from the map.

        Returns ``None`` when the result cannot be converted.
        """
        stroke_value = race_result.stroke.value if race_result.stroke else None

        # Skip unknown strokes immediately.
        if stroke_value == "Unknown":
            logger.debug(
                "Skipping result for event '%s' — stroke is Unknown", race_result.event
            )
            return None

        # Attempt primary resolution from stroke enum value.
        stroke_enum = cls._STROKE_VALUE_MAP.get(stroke_value)

        # Parse event to obtain distance (and validate/fallback stroke).
        parsed = cls.parse_event(race_result.event)
        if parsed is None:
            # Try with 'Medley' mapped to 'Individual Medley' in event name
            # before giving up entirely.
            logger.debug(
                "Skipping result — could not parse event '%s'", race_result.event
            )
            return None

        distance, event_stroke_enum = parsed

        # If stroke map lookup failed, fall back to event-parsed stroke.
        if stroke_enum is None:
            stroke_enum = event_stroke_enum

        # Parse date.
        performed_on = cls.parse_date(race_result.date)

        # Build dedup id.
        result_id = cls.synthesize_result_id(
            athlete_id=athlete_id,
            date=performed_on,
            distance=distance,
            stroke=stroke_enum,
            course=race_result.course,
            time=race_result.time,
            meet=race_result.meet or "",
        )

        return WorkoutResult(
            swimmer_id=swimmer_id,
            distance=distance,
            stroke=stroke_enum,        # type: ignore[arg-type]
            time_result=race_result.time,
            result_units=race_result.course,  # type: ignore[arg-type]
            performed_on=performed_on,
            meet_name=race_result.meet or None,
            meet_city=race_result.city or None,
            meet_nation=None,
            source="swimrankings",
            swimrankings_result_id=result_id,
            reaction_time=None,
            activity="swim",
            equipment="none",
            has_splits_available=None,
        )

    @classmethod
    def convert_batch(
        cls,
        race_results,
        swimmer_id: str,
        athlete_id: str,
    ) -> List[WorkoutResult]:
        """Convert a list of ``RaceResult`` objects to ``WorkoutResult`` objects.

        Invalid / unparseable results are skipped.  A warning is logged with
        the total skip count when any results are dropped.
        """
        converted: List[WorkoutResult] = []
        skipped = 0

        for race in race_results:
            result = cls.convert(race, swimmer_id=swimmer_id, athlete_id=athlete_id)
            if result is None:
                skipped += 1
            else:
                converted.append(result)

        if skipped:
            logger.warning(
                "convert_batch: skipped %d result(s) out of %d total",
                skipped,
                len(race_results),
            )

        return converted
