"""Tests for the ChromaDB writer."""

from unittest.mock import MagicMock, call

import pytest

from ingestion.chromadb_writer import ChromaDBWriter
from ingestion.models import (
    ClassifiedWorkout,
    DistanceUnit,
    EnergyZone,
    SwimLevel,
    TrainingFocus,
    WorkoutMetadata,
    WorkoutSource,
)


def _make_workout(
    title: str = "Morning Sprint Set",
    text: str = "8x50 free sprint on 1:00",
    document: str = "Title: Morning Sprint Set\nWorkout: 8x50 free sprint on 1:00",
    source: str = "test",
    source_url: str | None = None,
    source_name: str | None = None,
    coach_notes: str | None = None,
    **meta_kwargs,
) -> ClassifiedWorkout:
    """Build a ClassifiedWorkout with optional metadata overrides."""
    metadata = WorkoutMetadata(
        training_focus=meta_kwargs.get("training_focus", TrainingFocus.SPRINT),
        energy_zone=meta_kwargs.get("energy_zone", EnergyZone.SP1),
        level=meta_kwargs.get("level", SwimLevel.SENIOR),
        distance_unit=meta_kwargs.get("distance_unit", DistanceUnit.METERS),
        source=meta_kwargs.get("meta_source", WorkoutSource.SCRAPED),
        total_distance=meta_kwargs.get("total_distance", 2000),
        estimated_minutes=meta_kwargs.get("estimated_minutes", 45),
        pct_free=meta_kwargs.get("pct_free", 80),
        pct_back=meta_kwargs.get("pct_back", 0),
        pct_breast=meta_kwargs.get("pct_breast", 0),
        pct_fly=meta_kwargs.get("pct_fly", 10),
        pct_im=meta_kwargs.get("pct_im", 0),
        pct_kick=meta_kwargs.get("pct_kick", 5),
        pct_drill=meta_kwargs.get("pct_drill", 5),
    )
    return ClassifiedWorkout(
        title=title,
        text=text,
        document=document,
        source=source,
        source_url=source_url,
        source_name=source_name,
        coach_notes=coach_notes,
        metadata=metadata,
    )


def _mock_collection() -> MagicMock:
    """Return a mock ChromaDB collection with sensible defaults."""
    collection = MagicMock()
    # Default: no existing documents
    collection.get.return_value = {"ids": []}
    collection.count.return_value = 0
    return collection


class TestWriteNewWorkout:
    """Writing a brand-new workout adds it to the collection."""

    def test_write_new_workout(self) -> None:
        collection = _mock_collection()
        writer = ChromaDBWriter(collection=collection)
        workout = _make_workout()

        result = writer.write([workout])

        assert result["added"] == 1
        assert result["skipped"] == 0
        collection.add.assert_called_once()

        # Verify the add call contents
        add_kwargs = collection.add.call_args
        assert add_kwargs.kwargs["ids"] == [workout.content_hash]
        assert add_kwargs.kwargs["documents"] == [workout.document]
        assert len(add_kwargs.kwargs["metadatas"]) == 1


class TestSkipDuplicate:
    """Workouts whose content_hash already exists are skipped."""

    def test_skip_duplicate(self) -> None:
        collection = _mock_collection()
        writer = ChromaDBWriter(collection=collection)
        workout = _make_workout()

        # Simulate that this ID already exists in ChromaDB
        collection.get.return_value = {"ids": [workout.content_hash]}

        result = writer.write([workout])

        assert result["added"] == 0
        assert result["skipped"] == 1
        collection.add.assert_not_called()


class TestBatchWriting:
    """Large lists are split into batches of the configured size."""

    def test_batch_writing(self) -> None:
        collection = _mock_collection()
        writer = ChromaDBWriter(collection=collection, batch_size=2)

        workouts = [
            _make_workout(title=f"Workout {i}", document=f"doc {i}")
            for i in range(5)
        ]

        result = writer.write(workouts)

        assert result["added"] == 5
        assert result["skipped"] == 0
        # 5 items with batch_size=2 → 3 add() calls (2+2+1)
        assert collection.add.call_count == 3

        # Verify batch sizes
        batch_sizes = [
            len(c.kwargs["ids"]) for c in collection.add.call_args_list
        ]
        assert batch_sizes == [2, 2, 1]


class TestMetadataFieldsCorrect:
    """The metadata dict passed to add() contains all required fields."""

    def test_metadata_fields_correct(self) -> None:
        collection = _mock_collection()
        writer = ChromaDBWriter(collection=collection)
        workout = _make_workout(
            title="Endurance Set",
            source="scraped",
            source_url="https://example.com/workout",
            source_name="Example Site",
            coach_notes="Focus on turns",
            training_focus=TrainingFocus.ENDURANCE,
            energy_zone=EnergyZone.EN2,
            level=SwimLevel.AGE_GROUP,
            distance_unit=DistanceUnit.YARDS,
            meta_source=WorkoutSource.SCRAPED,
            total_distance=4000,
            estimated_minutes=90,
            pct_free=40,
            pct_back=15,
            pct_breast=10,
            pct_fly=10,
            pct_im=10,
            pct_kick=10,
            pct_drill=5,
        )

        writer.write([workout])

        meta = collection.add.call_args.kwargs["metadatas"][0]

        # Enum values stored as their string value
        assert meta["training_focus"] == "endurance"
        assert meta["energy_zone"] == "EN2"
        assert meta["level"] == "age_group"
        assert meta["distance_unit"] == "yards"
        assert meta["source"] == "scraped"

        # Numeric fields
        assert meta["total_distance"] == 4000
        assert meta["estimated_minutes"] == 90
        assert meta["pct_free"] == 40
        assert meta["pct_back"] == 15
        assert meta["pct_breast"] == 10
        assert meta["pct_fly"] == 10
        assert meta["pct_im"] == 10
        assert meta["pct_kick"] == 10
        assert meta["pct_drill"] == 5

        # String fields
        assert meta["title"] == "Endurance Set"
        assert meta["source_url"] == "https://example.com/workout"
        assert meta["source_name"] == "Example Site"
        assert meta["coach_notes"] == "Focus on turns"

        # Timestamp present
        assert "ingested_at" in meta
        assert isinstance(meta["ingested_at"], str)

    def test_nullable_strings_default_to_empty(self) -> None:
        """Nullable string fields become empty string, not None."""
        collection = _mock_collection()
        writer = ChromaDBWriter(collection=collection)
        workout = _make_workout(
            source_url=None,
            source_name=None,
            coach_notes=None,
            energy_zone=None,
        )

        writer.write([workout])

        meta = collection.add.call_args.kwargs["metadatas"][0]
        assert meta["source_url"] == ""
        assert meta["source_name"] == ""
        assert meta["coach_notes"] == ""
        assert meta["energy_zone"] == ""


class TestRetryLogic:
    """Transient failures on add() are retried with exponential backoff."""

    def test_retry_on_transient_failure(self) -> None:
        collection = _mock_collection()
        writer = ChromaDBWriter(collection=collection)
        workout = _make_workout()

        # First call raises, second succeeds
        collection.add.side_effect = [RuntimeError("transient"), None]

        result = writer.write([workout])

        assert result["added"] == 1
        assert collection.add.call_count == 2

    def test_retry_exhausted_raises(self) -> None:
        collection = _mock_collection()
        writer = ChromaDBWriter(collection=collection)
        workout = _make_workout()

        collection.add.side_effect = RuntimeError("persistent failure")

        with pytest.raises(RuntimeError, match="persistent failure"):
            writer.write([workout])

        # 3 attempts total
        assert collection.add.call_count == 3


class TestCountAndStats:
    """count() and stats() delegate to collection correctly."""

    def test_count(self) -> None:
        collection = _mock_collection()
        collection.count.return_value = 42
        writer = ChromaDBWriter(collection=collection)

        assert writer.count() == 42

    def test_stats(self) -> None:
        collection = _mock_collection()
        collection.count.return_value = 10

        # Mock the where queries for each source
        def mock_get(**kwargs):
            where = kwargs.get("where", {})
            source_val = where.get("source", "")
            counts = {
                "scraped": ["id1", "id2", "id3"],
                "curated": ["id4", "id5"],
                "ai_generated": ["id6"],
                "coach_created": ["id7", "id8", "id9", "id10"],
            }
            return {"ids": counts.get(source_val, [])}

        collection.get.side_effect = mock_get
        writer = ChromaDBWriter(collection=collection)

        result = writer.stats()

        assert result["total"] == 10
        assert result["by_source"]["scraped"] == 3
        assert result["by_source"]["curated"] == 2
        assert result["by_source"]["ai_generated"] == 1
        assert result["by_source"]["coach_created"] == 4
