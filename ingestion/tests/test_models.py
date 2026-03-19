"""Tests for ingestion Pydantic models."""

import pytest
from pydantic import ValidationError

from ingestion.models import (
    ClassifiedWorkout,
    DistanceUnit,
    EnergyZone,
    NormalizedWorkout,
    RawWorkout,
    SwimLevel,
    TrainingFocus,
    WorkoutMetadata,
    WorkoutSource,
)


class TestRawWorkout:
    """Tests for the RawWorkout model."""

    def test_minimal_creation(self) -> None:
        """RawWorkout requires only title, text, and source."""
        workout = RawWorkout(
            title="Morning Sprint Set",
            text="8x50 Free on :45",
            source="scraped",
        )
        assert workout.title == "Morning Sprint Set"
        assert workout.text == "8x50 Free on :45"
        assert workout.source == "scraped"
        assert workout.source_url is None
        assert workout.source_name is None
        assert workout.coach_notes is None

    def test_full_creation_with_all_optional_fields(self) -> None:
        """RawWorkout accepts all optional fields."""
        workout = RawWorkout(
            title="Distance Day",
            text="1x800 Free steady\n4x200 IM descend",
            source="curated",
            source_url="https://example.com/workouts/42",
            source_name="SwimWorkouts.net",
            coach_notes="Good for senior-level endurance block",
        )
        assert workout.source_url == "https://example.com/workouts/42"
        assert workout.source_name == "SwimWorkouts.net"
        assert workout.coach_notes == "Good for senior-level endurance block"


class TestNormalizedWorkout:
    """Tests for the NormalizedWorkout model."""

    def test_document_format_contains_markers(self) -> None:
        """The document field must contain Title: and Workout: markers."""
        workout = NormalizedWorkout(
            title="Sprint Day",
            text="10x50 Free sprint",
            document="Title: Sprint Day\nWorkout: 10x50 Free sprint",
            source="curated",
        )
        assert "Title:" in workout.document
        assert "Workout:" in workout.document

    def test_content_hash_is_deterministic(self) -> None:
        """Same document text produces the same content_hash."""
        kwargs = dict(
            title="A",
            text="B",
            document="Title: A\nWorkout: B",
            source="curated",
        )
        w1 = NormalizedWorkout(**kwargs)
        w2 = NormalizedWorkout(**kwargs)
        assert w1.content_hash == w2.content_hash
        assert len(w1.content_hash) == 64  # SHA-256 hex length

    def test_different_text_produces_different_hash(self) -> None:
        """Different document text produces a different content_hash."""
        w1 = NormalizedWorkout(
            title="A",
            text="B",
            document="Title: A\nWorkout: B",
            source="curated",
        )
        w2 = NormalizedWorkout(
            title="A",
            text="C",
            document="Title: A\nWorkout: C",
            source="curated",
        )
        assert w1.content_hash != w2.content_hash


class TestWorkoutMetadata:
    """Tests for the WorkoutMetadata model."""

    def test_valid_enums_accepted(self) -> None:
        """Enum values are accepted by string."""
        meta = WorkoutMetadata(
            training_focus=TrainingFocus.SPRINT,
            energy_zone=EnergyZone.SP1,
            level=SwimLevel.SENIOR,
            distance_unit=DistanceUnit.METERS,
            source=WorkoutSource.SCRAPED,
        )
        assert meta.training_focus == TrainingFocus.SPRINT
        assert meta.energy_zone == EnergyZone.SP1
        assert meta.level == SwimLevel.SENIOR
        assert meta.distance_unit == DistanceUnit.METERS
        assert meta.source == WorkoutSource.SCRAPED

    def test_defaults_are_correct(self) -> None:
        """Default values match specification."""
        meta = WorkoutMetadata()
        assert meta.training_focus == TrainingFocus.MIXED
        assert meta.level == SwimLevel.AGE_GROUP
        assert meta.distance_unit == DistanceUnit.YARDS
        assert meta.pct_free == 0
        assert meta.pct_back == 0
        assert meta.pct_breast == 0
        assert meta.pct_fly == 0
        assert meta.pct_im == 0
        assert meta.pct_kick == 0
        assert meta.pct_drill == 0
        assert meta.total_distance == 0
        assert meta.estimated_minutes == 0

    def test_pct_values_clamped_high(self) -> None:
        """Percentage values above 100 are clamped to 100."""
        meta = WorkoutMetadata(pct_free=150, pct_back=200)
        assert meta.pct_free == 100
        assert meta.pct_back == 100

    def test_pct_values_clamped_low(self) -> None:
        """Negative percentage values are clamped to 0."""
        meta = WorkoutMetadata(pct_free=-10, pct_fly=-50)
        assert meta.pct_free == 0
        assert meta.pct_fly == 0

    def test_total_distance_clamped_to_zero(self) -> None:
        """Negative total_distance is clamped to 0."""
        meta = WorkoutMetadata(total_distance=-500)
        assert meta.total_distance == 0

    def test_estimated_minutes_clamped(self) -> None:
        """estimated_minutes is clamped to 0-300."""
        meta_high = WorkoutMetadata(estimated_minutes=999)
        assert meta_high.estimated_minutes == 300

        meta_low = WorkoutMetadata(estimated_minutes=-10)
        assert meta_low.estimated_minutes == 0


class TestClassifiedWorkout:
    """Tests for the ClassifiedWorkout model."""

    def test_combines_normalized_and_metadata(self) -> None:
        """ClassifiedWorkout has both normalized fields and metadata."""
        workout = ClassifiedWorkout(
            title="IM Day",
            text="4x100 IM",
            document="Title: IM Day\nWorkout: 4x100 IM",
            source="curated",
            metadata=WorkoutMetadata(
                training_focus=TrainingFocus.IM,
                total_distance=400,
            ),
        )
        assert workout.title == "IM Day"
        assert workout.metadata.training_focus == TrainingFocus.IM
        assert workout.metadata.total_distance == 400

    def test_content_hash_auto_computed(self) -> None:
        """ClassifiedWorkout exposes content_hash from document field."""
        workout = ClassifiedWorkout(
            title="Sprint",
            text="8x50",
            document="Title: Sprint\nWorkout: 8x50",
            source="curated",
        )
        assert isinstance(workout.content_hash, str)
        assert len(workout.content_hash) == 64

    def test_default_metadata(self) -> None:
        """ClassifiedWorkout gets a default WorkoutMetadata if none provided."""
        workout = ClassifiedWorkout(
            title="Easy",
            text="warmup",
            document="Title: Easy\nWorkout: warmup",
            source="curated",
        )
        assert isinstance(workout.metadata, WorkoutMetadata)
        assert workout.metadata.training_focus == TrainingFocus.MIXED
