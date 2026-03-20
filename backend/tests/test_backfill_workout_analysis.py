import pytest
from app.tasks.backfill_workout_analysis import backfill_single_workout


def test_backfill_transforms_to_correct_format():
    """Verify the analysis result is transformed to the sections+totals format."""
    mock_analysis = {
        "parser_used": "llm",
        "sections": [{"name": "Warm-up", "sets": [{"reps": 4, "distance": 100, "stroke": "freestyle", "activity": "swim", "energy_zone": "en1"}]}],
        "total_meters": 400,
        "total_sets": 1,
        "estimated_duration_minutes": 8.0,
        "rest_time_minutes": 0.0,
        "stroke_breakdown": {"freestyle": {"meters": 400, "percentage": 100}},
        "activity_breakdown": {"swim": {"meters": 400, "percentage": 100}},
        "energy_zone_breakdown": {"en1": {"meters": 400, "percentage": 100}},
    }

    result = backfill_single_workout(mock_analysis)

    assert result is not None
    assert "sections" in result
    assert "totals" in result
    assert result["totals"]["total_meters"] == 400
    assert result["totals"]["stroke_breakdown"]["freestyle"]["meters"] == 400
    assert result["sections"][0]["name"] == "Warm-up"


def test_backfill_returns_none_on_empty_analysis():
    """Verify that empty analysis returns None."""
    mock_analysis = {
        "parser_used": "regex",
        "sections": [],
        "total_meters": 0,
        "total_sets": 0,
        "estimated_duration_minutes": 0,
        "rest_time_minutes": 0,
        "stroke_breakdown": {},
        "activity_breakdown": {},
        "energy_zone_breakdown": {},
    }
    result = backfill_single_workout(mock_analysis)
    assert result is None
