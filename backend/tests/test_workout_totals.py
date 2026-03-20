"""
Tests for app.services.workout_totals

Pure unit tests — no database, no async, no external dependencies.
"""

import pytest
from app.services.workout_totals import (
    compute_totals,
    _normalize_stroke,
    _normalize_activity,
    _normalize_energy_zone,
)


# ---------------------------------------------------------------------------
# compute_totals
# ---------------------------------------------------------------------------


def test_compute_totals_basic():
    """Single section, two sets: 400 swim freestyle + 4x50 kick = 600 m total."""
    sections = [
        {
            "name": "Warm-up",
            "sets": [
                {"reps": 1, "distance": 400, "stroke": "freestyle", "activity": "swim", "energy_zone": "en1"},
                {"reps": 4, "distance": 50, "stroke": "freestyle", "activity": "kick", "energy_zone": "en1"},
            ],
        }
    ]
    result = compute_totals(sections)

    assert result["total_meters"] == 600
    assert result["total_sets"] == 2
    # stroke: all freestyle
    assert result["stroke_breakdown"]["freestyle"]["meters"] == 600
    assert result["stroke_breakdown"]["freestyle"]["percentage"] == 100.0
    # activity: 400 swim + 200 kick
    assert result["activity_breakdown"]["swim"]["meters"] == 400
    assert result["activity_breakdown"]["kick"]["meters"] == 200
    # zone: all en1
    assert result["energy_zone_breakdown"]["en1"]["meters"] == 600


def test_compute_totals_percentages():
    """Two equal sets should each account for exactly 50% of totals."""
    sections = [
        {
            "name": "Main",
            "sets": [
                {"reps": 4, "distance": 100, "stroke": "freestyle", "activity": "swim", "energy_zone": "en2"},
                {"reps": 4, "distance": 100, "stroke": "backstroke", "activity": "swim", "energy_zone": "en3"},
            ],
        }
    ]
    result = compute_totals(sections)

    assert result["total_meters"] == 800
    assert result["stroke_breakdown"]["freestyle"]["percentage"] == 50.0
    assert result["stroke_breakdown"]["backstroke"]["percentage"] == 50.0
    assert result["activity_breakdown"]["swim"]["percentage"] == 100.0
    assert result["energy_zone_breakdown"]["en2"]["meters"] == 400
    assert result["energy_zone_breakdown"]["en3"]["meters"] == 400


def test_compute_totals_multi_section():
    """Three sections (warmup/main/cooldown) — totals should span all sections."""
    sections = [
        {
            "name": "Warm-up",
            "sets": [
                {"reps": 1, "distance": 400, "stroke": "freestyle", "activity": "swim", "energy_zone": "en1"},
            ],
        },
        {
            "name": "Main Set",
            "sets": [
                {"reps": 8, "distance": 100, "stroke": "butterfly", "activity": "swim", "energy_zone": "en3"},
                {"reps": 4, "distance": 50, "stroke": "im", "activity": "kick", "energy_zone": "en2"},
            ],
        },
        {
            "name": "Cool-down",
            "sets": [
                {"reps": 1, "distance": 300, "stroke": "backstroke", "activity": "swim", "energy_zone": "en1"},
            ],
        },
    ]
    result = compute_totals(sections)

    # 400 + 800 + 200 + 300 = 1700
    assert result["total_meters"] == 1700
    assert result["total_sets"] == 4

    assert result["stroke_breakdown"]["freestyle"]["meters"] == 400
    assert result["stroke_breakdown"]["butterfly"]["meters"] == 800
    assert result["stroke_breakdown"]["im"]["meters"] == 200
    assert result["stroke_breakdown"]["backstroke"]["meters"] == 300

    assert result["activity_breakdown"]["swim"]["meters"] == 1500
    assert result["activity_breakdown"]["kick"]["meters"] == 200

    en1 = result["energy_zone_breakdown"]["en1"]["meters"]
    assert en1 == 700  # 400 warmup + 300 cooldown


def test_compute_totals_empty():
    """Empty input returns zeros and empty breakdown dicts."""
    result = compute_totals([])

    assert result["total_meters"] == 0
    assert result["total_sets"] == 0
    assert result["stroke_breakdown"] == {}
    assert result["activity_breakdown"] == {}
    assert result["energy_zone_breakdown"] == {}


def test_compute_totals_all_strokes():
    """One set per valid stroke, each 100 m — every stroke appears in breakdown."""
    strokes = ["freestyle", "backstroke", "breaststroke", "butterfly", "im", "choice"]
    sections = [
        {
            "name": "All Strokes",
            "sets": [
                {"reps": 1, "distance": 100, "stroke": s, "activity": "swim", "energy_zone": "en2"}
                for s in strokes
            ],
        }
    ]
    result = compute_totals(sections)

    assert result["total_meters"] == 600
    assert result["total_sets"] == 6
    for stroke in strokes:
        assert result["stroke_breakdown"][stroke]["meters"] == 100
        assert result["stroke_breakdown"][stroke]["percentage"] == pytest.approx(100 / 6, abs=0.2)


def test_compute_totals_all_activities():
    """One set per valid activity, each 100 m — every activity appears in breakdown."""
    activities = ["swim", "kick", "pull", "drill"]
    sections = [
        {
            "name": "All Activities",
            "sets": [
                {"reps": 1, "distance": 100, "stroke": "freestyle", "activity": a, "energy_zone": "en1"}
                for a in activities
            ],
        }
    ]
    result = compute_totals(sections)

    assert result["total_meters"] == 400
    assert result["total_sets"] == 4
    for activity in activities:
        assert result["activity_breakdown"][activity]["meters"] == 100
        assert result["activity_breakdown"][activity]["percentage"] == 25.0


def test_compute_totals_energy_zones():
    """Three different zones tracked correctly."""
    sections = [
        {
            "name": "Mixed Zones",
            "sets": [
                {"reps": 4, "distance": 100, "stroke": "freestyle", "activity": "swim", "energy_zone": "en1"},
                {"reps": 4, "distance": 100, "stroke": "freestyle", "activity": "swim", "energy_zone": "en3"},
                {"reps": 2, "distance": 50, "stroke": "freestyle", "activity": "swim", "energy_zone": "sprint"},
            ],
        }
    ]
    result = compute_totals(sections)

    # 400 + 400 + 100 = 900
    assert result["total_meters"] == 900
    assert result["energy_zone_breakdown"]["en1"]["meters"] == 400
    assert result["energy_zone_breakdown"]["en3"]["meters"] == 400
    assert result["energy_zone_breakdown"]["sprint"]["meters"] == 100
    assert "en2" not in result["energy_zone_breakdown"]
    assert "en4" not in result["energy_zone_breakdown"]


# ---------------------------------------------------------------------------
# _normalize_stroke aliases
# ---------------------------------------------------------------------------


def test_normalize_stroke_aliases():
    """Common aliases resolve to canonical stroke names."""
    assert _normalize_stroke("free") == "freestyle"
    assert _normalize_stroke("fr") == "freestyle"
    assert _normalize_stroke("freestyle") == "freestyle"

    assert _normalize_stroke("back") == "backstroke"
    assert _normalize_stroke("bk") == "backstroke"
    assert _normalize_stroke("backstroke") == "backstroke"

    assert _normalize_stroke("breast") == "breaststroke"
    assert _normalize_stroke("br") == "breaststroke"
    assert _normalize_stroke("brst") == "breaststroke"
    assert _normalize_stroke("breaststroke") == "breaststroke"

    assert _normalize_stroke("fly") == "butterfly"
    assert _normalize_stroke("bf") == "butterfly"
    assert _normalize_stroke("butterfly") == "butterfly"

    assert _normalize_stroke("individual medley") == "im"
    assert _normalize_stroke("medley") == "im"
    assert _normalize_stroke("im") == "im"

    assert _normalize_stroke("ch") == "choice"
    assert _normalize_stroke("choice") == "choice"

    # Case insensitive
    assert _normalize_stroke("FREE") == "freestyle"
    assert _normalize_stroke("Backstroke") == "backstroke"


# ---------------------------------------------------------------------------
# _normalize_activity aliases
# ---------------------------------------------------------------------------


def test_normalize_activity_aliases():
    """Common aliases resolve to canonical activity names."""
    assert _normalize_activity("kicking") == "kick"
    assert _normalize_activity("k") == "kick"
    assert _normalize_activity("kick") == "kick"

    assert _normalize_activity("pulling") == "pull"
    assert _normalize_activity("pull") == "pull"

    assert _normalize_activity("drills") == "drill"
    assert _normalize_activity("dr") == "drill"
    assert _normalize_activity("drill") == "drill"

    assert _normalize_activity("swimming") == "swim"
    assert _normalize_activity("sprint") == "swim"
    assert _normalize_activity("swim") == "swim"

    # Case insensitive
    assert _normalize_activity("KICK") == "kick"
    assert _normalize_activity("Pulling") == "pull"


# ---------------------------------------------------------------------------
# _normalize_invalid_defaults
# ---------------------------------------------------------------------------


def test_normalize_invalid_defaults():
    """Unknown strings fall back to the correct defaults."""
    # Unknown stroke → "choice"
    assert _normalize_stroke("unknown_stroke") == "choice"
    assert _normalize_stroke("") == "choice"
    assert _normalize_stroke(None) == "choice"

    # Unknown activity → "swim"
    assert _normalize_activity("unknown_activity") == "swim"
    assert _normalize_activity("") == "swim"
    assert _normalize_activity(None) == "swim"

    # Unknown energy zone → "en2"
    assert _normalize_energy_zone("unknown_zone") == "en2"
    assert _normalize_energy_zone("") == "en2"
    assert _normalize_energy_zone(None) == "en2"

    # Valid energy zones pass through unchanged
    assert _normalize_energy_zone("en1") == "en1"
    assert _normalize_energy_zone("en4") == "en4"
    assert _normalize_energy_zone("sprint") == "sprint"
