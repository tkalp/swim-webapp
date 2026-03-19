"""Tests for the pipeline orchestrator."""

from __future__ import annotations

from unittest.mock import MagicMock, AsyncMock, patch

import pytest

from ingestion.models import (
    ClassifiedWorkout,
    NormalizedWorkout,
    RawWorkout,
    WorkoutMetadata,
)
from ingestion.pipeline import run_pipeline


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _raw(title: str = "Test Set", text: str = "10x100 Free") -> RawWorkout:
    return RawWorkout(title=title, text=text, source="test")


def _raw_empty() -> RawWorkout:
    """A workout whose text is whitespace-only — normalizer should return None."""
    return RawWorkout(title="Empty", text="   ", source="test")


def _default_metadata() -> WorkoutMetadata:
    return WorkoutMetadata(total_distance=2000, estimated_minutes=60)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_full_pipeline_happy_path() -> None:
    """3 raw workouts -> 3 normalized -> 3 classified -> 3 written."""
    raws = [_raw(f"Set {i}") for i in range(3)]
    meta = _default_metadata()

    with (
        patch("ingestion.pipeline.classify_batch", new_callable=AsyncMock) as mock_classify,
        patch("ingestion.pipeline.ChromaDBWriter") as MockWriter,
    ):
        mock_classify.return_value = [meta, meta, meta]
        writer_instance = MagicMock()
        writer_instance.write.return_value = {"added": 3, "skipped": 0}
        MockWriter.return_value = writer_instance

        result = await run_pipeline(raws, chroma_path="/tmp/test_chroma")

    assert result["input"] == 3
    assert result["normalized"] == 3
    assert result["classified"] == 3
    assert result["added"] == 3
    assert result["skipped"] == 0
    assert result["normalize_failed"] == 0

    mock_classify.assert_awaited_once()
    writer_instance.write.assert_called_once()
    # Verify 3 ClassifiedWorkout objects were passed to write
    written = writer_instance.write.call_args[0][0]
    assert len(written) == 3
    assert all(isinstance(w, ClassifiedWorkout) for w in written)


@pytest.mark.asyncio
async def test_skips_empty_workouts() -> None:
    """1 valid + 1 empty text -> normalize_failed=1, normalized=1."""
    raws = [_raw("Good Set"), _raw_empty()]
    meta = _default_metadata()

    with (
        patch("ingestion.pipeline.classify_batch", new_callable=AsyncMock) as mock_classify,
        patch("ingestion.pipeline.ChromaDBWriter") as MockWriter,
    ):
        mock_classify.return_value = [meta]
        writer_instance = MagicMock()
        writer_instance.write.return_value = {"added": 1, "skipped": 0}
        MockWriter.return_value = writer_instance

        result = await run_pipeline(raws, chroma_path="/tmp/test_chroma")

    assert result["input"] == 2
    assert result["normalized"] == 1
    assert result["normalize_failed"] == 1
    assert result["classified"] == 1
    assert result["added"] == 1

    # classify_batch should only receive the 1 valid workout
    classified_input = mock_classify.call_args[0][0]
    assert len(classified_input) == 1


@pytest.mark.asyncio
async def test_dry_run_does_not_write() -> None:
    """dry_run=True -> ChromaDBWriter.write() NOT called."""
    raws = [_raw("Dry Run Set")]
    meta = _default_metadata()

    with (
        patch("ingestion.pipeline.classify_batch", new_callable=AsyncMock) as mock_classify,
        patch("ingestion.pipeline.ChromaDBWriter") as MockWriter,
    ):
        mock_classify.return_value = [meta]
        writer_instance = MagicMock()
        MockWriter.return_value = writer_instance

        result = await run_pipeline(raws, chroma_path="/tmp/test_chroma", dry_run=True)

    assert result["input"] == 1
    assert result["normalized"] == 1
    assert result["classified"] == 1
    assert result["added"] == 0
    assert result["skipped"] == 0

    # Writer should never have been instantiated or called
    MockWriter.assert_not_called()
    writer_instance.write.assert_not_called()
