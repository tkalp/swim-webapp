"""Normalize raw workouts: strip HTML, standardize notation, clean whitespace."""

from __future__ import annotations

import re
from typing import Optional

from ingestion.models import NormalizedWorkout, RawWorkout

# ---------------------------------------------------------------------------
# Stroke abbreviation map (applied case-insensitively)
# ---------------------------------------------------------------------------

_STROKE_MAP: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bindividual\s+medley\b", re.IGNORECASE), "IM"),
    (re.compile(r"\bfreestyle\b", re.IGNORECASE), "Free"),
    (re.compile(r"\bbackstroke\b", re.IGNORECASE), "Back"),
    (re.compile(r"\bbreaststroke\b", re.IGNORECASE), "Breast"),
    (re.compile(r"\bbutterfly\b", re.IGNORECASE), "Fly"),
]

# Collapse "4 × 100" or "4 x 100" → "4x100"
_SET_NOTATION_RE = re.compile(r"(\d+)\s*[x×]\s*(\d+)")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _strip_html(text: str) -> str:
    """Remove HTML tags if the text appears to contain any."""
    if "<" in text and ">" in text:
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(text, "html.parser")
        # Collapse runs of whitespace that appear after tag boundaries
        return re.sub(r"[ \t]+", " ", soup.get_text(separator=" "))
    return text


def _standardize_notation(text: str) -> str:
    """Replace full stroke names with abbreviations and normalize set notation."""
    for pattern, replacement in _STROKE_MAP:
        text = pattern.sub(replacement, text)
    text = _SET_NOTATION_RE.sub(r"\1x\2", text)
    return text


def _clean_whitespace(text: str) -> str:
    """Strip trailing spaces per line and collapse multiple blank lines."""
    lines = [line.rstrip() for line in text.splitlines()]
    # Collapse runs of blank lines into a single blank line
    cleaned: list[str] = []
    prev_blank = False
    for line in lines:
        if not line:
            if not prev_blank:
                cleaned.append("")
            prev_blank = True
        else:
            cleaned.append(line)
            prev_blank = False
    return "\n".join(cleaned).strip()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def normalize(raw: RawWorkout) -> Optional[NormalizedWorkout]:
    """Transform a RawWorkout into a NormalizedWorkout.

    Returns None if the text is empty or whitespace-only after processing.
    """
    text = raw.text
    text = _strip_html(text)
    text = _standardize_notation(text)
    text = _clean_whitespace(text)

    if not text:
        return None

    document = f"Title: {raw.title}\nWorkout:\n{text}"

    return NormalizedWorkout(
        title=raw.title,
        text=text,
        document=document,
        source=raw.source,
        source_url=raw.source_url,
        source_name=raw.source_name,
        coach_notes=raw.coach_notes,
    )
