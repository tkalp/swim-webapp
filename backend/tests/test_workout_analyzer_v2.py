"""Tests for WorkoutAnalyzer.analyze_workout_v2 and its helper methods."""

import os

import pytest

from app.services.workout_analyzer import WorkoutAnalyzer

# ---------------------------------------------------------------------------
# Tests that call the LLM require ANTHROPIC_API_KEY
# ---------------------------------------------------------------------------

llm_required = pytest.mark.skipif(
    not os.getenv("ANTHROPIC_API_KEY"),
    reason="ANTHROPIC_API_KEY not set",
)


class TestAnalyzerV2:
    """Integration tests that exercise the full LLM-backed pipeline."""

    @llm_required
    @pytest.mark.asyncio
    async def test_returns_parser_used(self) -> None:
        analyzer = WorkoutAnalyzer()
        result = await analyzer.analyze_workout_v2("4x100 Free @1:30\n200 choice easy")
        assert "parser_used" in result
        assert result["parser_used"] in ("llm", "regex")

    @llm_required
    @pytest.mark.asyncio
    async def test_returns_totals(self) -> None:
        analyzer = WorkoutAnalyzer()
        result = await analyzer.analyze_workout_v2("4x100 Free @1:30\n200 choice easy")
        assert result["total_meters"] == 600
        assert "stroke_breakdown" in result
        assert "activity_breakdown" in result
        assert "energy_zone_breakdown" in result
        assert "estimated_duration_minutes" in result
        assert result["estimated_duration_minutes"] > 0

    @llm_required
    @pytest.mark.asyncio
    async def test_returns_sections(self) -> None:
        analyzer = WorkoutAnalyzer()
        result = await analyzer.analyze_workout_v2(
            "Warm-up:\n400 Free\n\nMain:\n8x100 Back @1:40"
        )
        assert "sections" in result
        assert len(result["sections"]) >= 1


class TestRegexFallback:
    """Test the regex fallback method directly (no API key needed)."""

    def test_fallback_converts_format(self) -> None:
        analyzer = WorkoutAnalyzer()
        result = analyzer._regex_fallback("4x100 Free @1:30")
        assert "sections" in result
        assert len(result["sections"]) > 0
        sets = result["sections"][0]["sets"]
        assert len(sets) > 0
        assert sets[0]["reps"] == 4
        assert sets[0]["distance"] == 100

    def test_fallback_empty_text(self) -> None:
        analyzer = WorkoutAnalyzer()
        result = analyzer._regex_fallback("")
        assert result == {"sections": []}

    def test_fallback_section_name(self) -> None:
        analyzer = WorkoutAnalyzer()
        result = analyzer._regex_fallback("4x100 Free")
        assert result["sections"][0]["name"] == "Full Workout"

    def test_fallback_set_fields(self) -> None:
        analyzer = WorkoutAnalyzer()
        result = analyzer._regex_fallback("4x100 Free")
        s = result["sections"][0]["sets"][0]
        # All expected keys must be present
        for key in ("reps", "distance", "stroke", "activity", "energy_zone", "interval", "equipment", "notes"):
            assert key in s, f"Missing key: {key}"


class TestDurationEstimation:
    """Test _estimate_duration with hand-crafted section data."""

    def test_basic_duration_with_interval(self) -> None:
        analyzer = WorkoutAnalyzer()
        sections = [
            {
                "name": "Main",
                "sets": [
                    {
                        "reps": 4,
                        "distance": 100,
                        "stroke": "freestyle",
                        "activity": "swim",
                        "interval": "1:30",
                    }
                ],
            }
        ]
        duration = analyzer._estimate_duration(sections)
        assert duration == 6.0  # 4 * 90s = 360s = 6 min

    def test_duration_without_interval(self) -> None:
        analyzer = WorkoutAnalyzer()
        sections = [
            {
                "name": "Main",
                "sets": [
                    {
                        "reps": 1,
                        "distance": 400,
                        "stroke": "freestyle",
                        "activity": "swim",
                    }
                ],
            }
        ]
        duration = analyzer._estimate_duration(sections)
        assert duration > 0

    def test_duration_empty_sections(self) -> None:
        analyzer = WorkoutAnalyzer()
        assert analyzer._estimate_duration([]) == 0.0

    def test_duration_bad_interval_falls_back_to_pace(self) -> None:
        analyzer = WorkoutAnalyzer()
        sections = [
            {
                "name": "Main",
                "sets": [
                    {
                        "reps": 2,
                        "distance": 100,
                        "stroke": "freestyle",
                        "activity": "swim",
                        "interval": "not-a-time",
                    }
                ],
            }
        ]
        duration = analyzer._estimate_duration(sections)
        # Should still produce a positive estimate via pace tables
        assert duration > 0

    def test_duration_at_sign_in_interval(self) -> None:
        """Intervals like '@1:30' should be handled (strip the @)."""
        analyzer = WorkoutAnalyzer()
        sections = [
            {
                "name": "Main",
                "sets": [
                    {
                        "reps": 4,
                        "distance": 100,
                        "stroke": "freestyle",
                        "activity": "swim",
                        "interval": "@1:30",
                    }
                ],
            }
        ]
        duration = analyzer._estimate_duration(sections)
        assert duration == 6.0


class TestRateLimiting:
    """Test the in-memory rate limiter in the routes module."""

    def test_rate_limit_allows_under_threshold(self) -> None:
        from app.routes.workout_analysis import _check_rate_limit, _rate_limits
        # Use a unique user id to avoid cross-test pollution
        uid = "test-rate-limit-allow"
        _rate_limits.pop(uid, None)
        for _ in range(10):
            assert _check_rate_limit(uid) is True

    def test_rate_limit_blocks_over_threshold(self) -> None:
        from app.routes.workout_analysis import _check_rate_limit, _rate_limits
        uid = "test-rate-limit-block"
        _rate_limits.pop(uid, None)
        for _ in range(10):
            _check_rate_limit(uid)
        assert _check_rate_limit(uid) is False
