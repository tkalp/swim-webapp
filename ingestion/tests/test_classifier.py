"""Tests for the async workout classifier."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from ingestion.classifier import classify_batch, classify_workout
from ingestion.models import (
    DistanceUnit,
    EnergyZone,
    NormalizedWorkout,
    SwimLevel,
    TrainingFocus,
    WorkoutMetadata,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_workout(title: str = "Test Set", text: str = "10x100 free") -> NormalizedWorkout:
    return NormalizedWorkout(
        title=title,
        text=text,
        document=f"Title: {title}\nWorkout:\n{text}",
        source="test",
    )


def _mock_client(responses: list[str]) -> AsyncMock:
    """Build a mock AsyncAnthropic whose messages.create returns *responses* in order."""
    client = AsyncMock()
    side_effects = []
    for text in responses:
        content_block = MagicMock()
        content_block.text = text
        message = MagicMock()
        message.content = [content_block]
        side_effects.append(message)
    client.messages.create = AsyncMock(side_effect=side_effects)
    return client


VALID_JSON = """{
    "total_distance": 4000,
    "distance_unit": "yards",
    "estimated_minutes": 60,
    "training_focus": "endurance",
    "energy_zone": "EN2",
    "level": "senior",
    "pct_free": 60,
    "pct_back": 10,
    "pct_breast": 10,
    "pct_fly": 5,
    "pct_im": 5,
    "pct_kick": 5,
    "pct_drill": 5
}"""

VALID_JSON_WRAPPED = f"```json\n{VALID_JSON}\n```"


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestClassifyWorkout:
    """Tests for classify_workout."""

    @pytest.mark.asyncio
    async def test_parses_valid_response(self) -> None:
        """Valid JSON from Claude produces correct WorkoutMetadata."""
        client = _mock_client([VALID_JSON])
        workout = _make_workout()

        result = await classify_workout(workout, client=client)

        assert isinstance(result, WorkoutMetadata)
        assert result.total_distance == 4000
        assert result.distance_unit == DistanceUnit.YARDS
        assert result.estimated_minutes == 60
        assert result.training_focus == TrainingFocus.ENDURANCE
        assert result.energy_zone == EnergyZone.EN2
        assert result.level == SwimLevel.SENIOR
        assert result.pct_free == 60
        assert result.pct_kick == 5
        client.messages.create.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_parses_markdown_wrapped_json(self) -> None:
        """JSON wrapped in markdown code block fences is extracted correctly."""
        client = _mock_client([VALID_JSON_WRAPPED])
        workout = _make_workout()

        result = await classify_workout(workout, client=client)

        assert result.total_distance == 4000
        assert result.training_focus == TrainingFocus.ENDURANCE

    @pytest.mark.asyncio
    async def test_invalid_json_retries_once(self) -> None:
        """First call returns garbage, second returns valid JSON — succeeds on retry."""
        client = _mock_client(["not json at all {{{", VALID_JSON])
        workout = _make_workout()

        result = await classify_workout(workout, client=client)

        assert result.total_distance == 4000
        assert result.training_focus == TrainingFocus.ENDURANCE
        assert client.messages.create.await_count == 2

    @pytest.mark.asyncio
    async def test_invalid_json_both_attempts_returns_defaults(self) -> None:
        """Both calls return garbage — returns default WorkoutMetadata."""
        client = _mock_client(["not json", "still not json"])
        workout = _make_workout()

        result = await classify_workout(workout, client=client)

        assert result.total_distance == 0
        assert result.training_focus == TrainingFocus.MIXED
        assert result.energy_zone is None
        assert client.messages.create.await_count == 2


class TestClassifyBatch:
    """Tests for classify_batch."""

    @pytest.mark.asyncio
    async def test_classify_batch_multiple(self) -> None:
        """Three workouts are classified concurrently, returning three results in order."""
        workouts = [
            _make_workout("Sprint Set", "8x50 sprint"),
            _make_workout("Distance Set", "1x1500 free"),
            _make_workout("IM Set", "4x200 IM"),
        ]

        # Each workout gets its own valid response
        responses = [
            '{"total_distance": 400, "training_focus": "sprint", "energy_zone": "SP3"}',
            '{"total_distance": 1500, "training_focus": "endurance", "energy_zone": "EN2"}',
            '{"total_distance": 800, "training_focus": "IM", "energy_zone": "mixed"}',
        ]

        # We patch classify_workout to return deterministic results based on index
        async def _fake_classify(
            workout: NormalizedWorkout, client: object = None
        ) -> WorkoutMetadata:
            idx = next(i for i, w in enumerate(workouts) if w.title == workout.title)
            import json
            from ingestion.validator import validate_classifier_output
            return validate_classifier_output(json.loads(responses[idx]))

        with patch("ingestion.classifier.classify_workout", side_effect=_fake_classify):
            results = await classify_batch(workouts, max_concurrent=2)

        assert len(results) == 3
        assert results[0].total_distance == 400
        assert results[0].training_focus == TrainingFocus.SPRINT
        assert results[1].total_distance == 1500
        assert results[1].training_focus == TrainingFocus.ENDURANCE
        assert results[2].total_distance == 800
        assert results[2].training_focus == TrainingFocus.IM
