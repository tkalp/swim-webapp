"""Tests for the classifier output validator."""

import pytest

from ingestion.models import (
    DistanceUnit,
    EnergyZone,
    SwimLevel,
    TrainingFocus,
    WorkoutMetadata,
)
from ingestion.validator import validate_classifier_output


class TestValidateClassifierOutput:
    """Tests for validate_classifier_output."""

    def test_valid_output(self) -> None:
        """Correct enum values pass through unchanged."""
        raw = {
            "training_focus": "sprint",
            "energy_zone": "SP1",
            "level": "senior",
            "distance_unit": "meters",
            "total_distance": 4000,
            "estimated_minutes": 60,
            "pct_free": 50,
            "pct_back": 10,
            "pct_breast": 10,
            "pct_fly": 10,
            "pct_im": 10,
            "pct_kick": 5,
            "pct_drill": 5,
        }
        result = validate_classifier_output(raw)
        assert result.training_focus == TrainingFocus.SPRINT
        assert result.energy_zone == EnergyZone.SP1
        assert result.level == SwimLevel.SENIOR
        assert result.distance_unit == DistanceUnit.METERS
        assert result.total_distance == 4000
        assert result.estimated_minutes == 60
        assert result.pct_free == 50

    def test_unknown_training_focus_fuzzy_matched(self) -> None:
        """Fuzzy alias 'speed' maps to 'sprint'."""
        result = validate_classifier_output({"training_focus": "speed"})
        assert result.training_focus == TrainingFocus.SPRINT

    def test_training_focus_aliases(self) -> None:
        """Various training focus aliases resolve correctly."""
        assert validate_classifier_output(
            {"training_focus": "fast"}
        ).training_focus == TrainingFocus.SPRINT
        assert validate_classifier_output(
            {"training_focus": "aerobic"}
        ).training_focus == TrainingFocus.ENDURANCE
        assert validate_classifier_output(
            {"training_focus": "drill"}
        ).training_focus == TrainingFocus.TECHNIQUE
        assert validate_classifier_output(
            {"training_focus": "warm up"}
        ).training_focus == TrainingFocus.RECOVERY
        assert validate_classifier_output(
            {"training_focus": "race"}
        ).training_focus == TrainingFocus.RACE_PREP
        assert validate_classifier_output(
            {"training_focus": "medley"}
        ).training_focus == TrainingFocus.IM
        assert validate_classifier_output(
            {"training_focus": "general"}
        ).training_focus == TrainingFocus.MIXED

    def test_unknown_energy_zone_fuzzy_matched(self) -> None:
        """Fuzzy alias 'hard' maps to 'SP1'."""
        result = validate_classifier_output({"energy_zone": "hard"})
        assert result.energy_zone == EnergyZone.SP1

    def test_energy_zone_aliases(self) -> None:
        """Various energy zone aliases resolve correctly."""
        assert validate_classifier_output(
            {"energy_zone": "easy"}
        ).energy_zone == EnergyZone.EN1
        assert validate_classifier_output(
            {"energy_zone": "recovery"}
        ).energy_zone == EnergyZone.EN1
        assert validate_classifier_output(
            {"energy_zone": "aerobic"}
        ).energy_zone == EnergyZone.EN2
        assert validate_classifier_output(
            {"energy_zone": "threshold"}
        ).energy_zone == EnergyZone.EN3
        assert validate_classifier_output(
            {"energy_zone": "vo2max"}
        ).energy_zone == EnergyZone.SP1
        assert validate_classifier_output(
            {"energy_zone": "race_pace"}
        ).energy_zone == EnergyZone.SP2
        assert validate_classifier_output(
            {"energy_zone": "all_out"}
        ).energy_zone == EnergyZone.SP3
        assert validate_classifier_output(
            {"energy_zone": "varied"}
        ).energy_zone == EnergyZone.MIXED

    def test_distance_unit_aliases(self) -> None:
        """Distance unit aliases resolve correctly."""
        assert validate_classifier_output(
            {"distance_unit": "yard"}
        ).distance_unit == DistanceUnit.YARDS
        assert validate_classifier_output(
            {"distance_unit": "meter"}
        ).distance_unit == DistanceUnit.METERS
        assert validate_classifier_output(
            {"distance_unit": "m"}
        ).distance_unit == DistanceUnit.METERS
        assert validate_classifier_output(
            {"distance_unit": "y"}
        ).distance_unit == DistanceUnit.YARDS

    def test_pct_out_of_range_clamped(self) -> None:
        """Percentage values are clamped to 0-100."""
        result = validate_classifier_output({"pct_free": 200, "pct_back": -50})
        assert result.pct_free == 100
        assert result.pct_back == 0

    def test_empty_dict_returns_defaults(self) -> None:
        """An empty dict produces a WorkoutMetadata with all defaults."""
        result = validate_classifier_output({})
        assert result.training_focus == TrainingFocus.MIXED
        assert result.energy_zone is None
        assert result.level == SwimLevel.AGE_GROUP
        assert result.distance_unit == DistanceUnit.YARDS
        assert result.total_distance == 0
        assert result.estimated_minutes == 0

    def test_none_input_returns_defaults(self) -> None:
        """None input produces a WorkoutMetadata with all defaults."""
        result = validate_classifier_output(None)
        assert result.training_focus == TrainingFocus.MIXED
        assert result.energy_zone is None
        assert result.total_distance == 0

    def test_string_numbers_coerced(self) -> None:
        """String representations of numbers are coerced to int."""
        result = validate_classifier_output({
            "total_distance": "3000",
            "estimated_minutes": "80",
            "pct_free": "45",
        })
        assert result.total_distance == 3000
        assert result.estimated_minutes == 80
        assert result.pct_free == 45

    def test_unrecognized_training_focus_falls_back_to_default(self) -> None:
        """A completely unrecognized training focus falls back to MIXED."""
        result = validate_classifier_output({"training_focus": "xyzzy_nonsense"})
        assert result.training_focus == TrainingFocus.MIXED

    def test_unrecognized_energy_zone_falls_back_to_none(self) -> None:
        """A completely unrecognized energy zone falls back to None."""
        result = validate_classifier_output({"energy_zone": "xyzzy_nonsense"})
        assert result.energy_zone is None

    def test_case_insensitive_matching(self) -> None:
        """Enum matching is case-insensitive."""
        result = validate_classifier_output({
            "training_focus": "SPRINT",
            "energy_zone": "sp1",
        })
        assert result.training_focus == TrainingFocus.SPRINT
        assert result.energy_zone == EnergyZone.SP1

    def test_extra_keys_ignored(self) -> None:
        """Unknown keys in the raw dict are silently ignored."""
        result = validate_classifier_output({
            "training_focus": "sprint",
            "unknown_field": "should_be_ignored",
        })
        assert result.training_focus == TrainingFocus.SPRINT
