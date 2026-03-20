"""Tests for the LLM workout parser service.

These tests call the real Claude Haiku API and are skipped when
ANTHROPIC_API_KEY is not set in the environment.
"""

import os

import pytest
import pytest_asyncio

from app.services.workout_llm_parser import parse_workout_with_llm, _cache

pytestmark = pytest.mark.skipif(
    not os.getenv("ANTHROPIC_API_KEY"),
    reason="ANTHROPIC_API_KEY not set",
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

VALID_STROKES = {"freestyle", "backstroke", "breaststroke", "butterfly", "im", "choice"}
VALID_ACTIVITIES = {"swim", "kick", "pull", "drill"}
VALID_ENERGY_ZONES = {"en1", "en2", "en3", "en4", "sprint"}


def _total_distance(result: dict) -> int:
    """Sum reps*distance across all sets in all sections."""
    total = 0
    for section in result.get("sections", []):
        for s in section.get("sets", []):
            total += s["reps"] * s["distance"]
    return total


def _all_sets(result: dict) -> list[dict]:
    """Flatten all sets from all sections."""
    sets: list[dict] = []
    for section in result.get("sections", []):
        sets.extend(section.get("sets", []))
    return sets


# ---------------------------------------------------------------------------
# TestLLMParserBasic
# ---------------------------------------------------------------------------

class TestLLMParserBasic:
    """Core parsing accuracy for various workout text formats."""

    @pytest.mark.asyncio
    async def test_simple_workout(self) -> None:
        text = (
            "Warm-up:\n"
            "400 Free easy\n"
            "\n"
            "Main Set:\n"
            "8x100 Free @1:30\n"
            "4x50 Kick @1:00\n"
            "\n"
            "Cool-down:\n"
            "200 choice easy"
        )
        result = await parse_workout_with_llm(text)

        assert len(result["sections"]) >= 1
        total = _total_distance(result)
        # 400 + 800 + 200 + 200 = 1600
        assert total == 1600, f"Expected 1600, got {total}"

    @pytest.mark.asyncio
    async def test_markdown_formatted_workout(self) -> None:
        text = (
            "## **Warm-Up (400m)**\n"
            "- 200 easy choice\n"
            "- 4x50 drill/swim by 25 @1:00\n"
            "\n"
            "## **Main Set (1600m)**\n"
            "- 4x200 Free @3:00 descend 1-4\n"
            "- 8x100 IM @1:45\n"
            "\n"
            "## **Cool-Down (200m)**\n"
            "- 200 easy backstroke\n"
        )
        result = await parse_workout_with_llm(text)

        assert len(result["sections"]) >= 1
        total = _total_distance(result)
        # 200 + 200 + 800 + 800 + 200 = 2200
        assert 2000 <= total <= 2400, f"Expected ~2200, got {total}"

    @pytest.mark.asyncio
    async def test_prose_style_workout(self) -> None:
        text = "300 choice\n200 pull\n100 kick"
        result = await parse_workout_with_llm(text)

        total = _total_distance(result)
        assert total == 600, f"Expected 600, got {total}"

    @pytest.mark.asyncio
    async def test_round_notation(self) -> None:
        text = (
            "3 rounds of:\n"
            "  4x25 Free sprint\n"
            "  50 easy\n"
        )
        result = await parse_workout_with_llm(text)

        total = _total_distance(result)
        # 3 * (4*25 + 50) = 3 * 150 = 450
        # LLM should expand rounds: reps multiplied by rounds
        # 4x25 becomes 12x25 = 300, 50 easy becomes 3x50 = 150 => 450
        assert 400 <= total <= 500, f"Expected ~450, got {total}"


# ---------------------------------------------------------------------------
# TestLLMParserEnums
# ---------------------------------------------------------------------------

class TestLLMParserEnums:
    """Verify all returned enum values are within allowed sets."""

    _WORKOUT_TEXT = (
        "Warm-up:\n"
        "200 Free easy\n"
        "4x50 IM drill @1:15\n"
        "\n"
        "Main Set:\n"
        "6x100 Fly @1:40 with fins\n"
        "4x75 Back kick @1:30\n"
        "8x50 Breast pull @1:00\n"
        "\n"
        "Cool-down:\n"
        "100 choice easy"
    )

    @pytest_asyncio.fixture
    async def parsed(self) -> dict:
        return await parse_workout_with_llm(self._WORKOUT_TEXT)

    @pytest.mark.asyncio
    async def test_valid_stroke_enums(self, parsed: dict) -> None:
        for s in _all_sets(parsed):
            assert s["stroke"] in VALID_STROKES, (
                f"Invalid stroke: {s['stroke']}"
            )

    @pytest.mark.asyncio
    async def test_valid_activity_enums(self, parsed: dict) -> None:
        for s in _all_sets(parsed):
            assert s["activity"] in VALID_ACTIVITIES, (
                f"Invalid activity: {s['activity']}"
            )

    @pytest.mark.asyncio
    async def test_valid_energy_zone_enums(self, parsed: dict) -> None:
        for s in _all_sets(parsed):
            assert s["energy_zone"] in VALID_ENERGY_ZONES, (
                f"Invalid energy_zone: {s['energy_zone']}"
            )


# ---------------------------------------------------------------------------
# TestLLMParserEdgeCases
# ---------------------------------------------------------------------------

class TestLLMParserEdgeCases:
    """Edge-case inputs: empty, garbage, minimal."""

    @pytest.mark.asyncio
    async def test_empty_string(self) -> None:
        result = await parse_workout_with_llm("")
        assert result == {"sections": []}

    @pytest.mark.asyncio
    async def test_whitespace_only(self) -> None:
        result = await parse_workout_with_llm("   \n\n  \t  ")
        assert result == {"sections": []}

    @pytest.mark.asyncio
    async def test_garbage_text(self) -> None:
        result = await parse_workout_with_llm(
            "The quick brown fox jumps over the lazy dog. "
            "Lorem ipsum dolor sit amet."
        )
        sets = _all_sets(result)
        assert len(sets) == 0

    @pytest.mark.asyncio
    async def test_single_line(self) -> None:
        result = await parse_workout_with_llm("400 Free")
        total = _total_distance(result)
        assert total == 400, f"Expected 400, got {total}"


# ---------------------------------------------------------------------------
# TestLLMParserCache
# ---------------------------------------------------------------------------

class TestLLMParserCache:
    """Verify the in-memory cache behaviour."""

    @pytest.mark.asyncio
    async def test_cache_hit(self) -> None:
        _cache.clear()
        text = "200 Free easy"

        result1 = await parse_workout_with_llm(text)
        result2 = await parse_workout_with_llm(text)

        # Same object reference means the cache was used
        assert result1 is result2
