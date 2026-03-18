"""Tests for worker.converter.RaceResultConverter."""
import pytest
from swimrankings.models import RaceResult, Stroke
from worker.converter import RaceResultConverter
from worker.models import WorkoutResult


class TestParseDate:
    def test_standard_short_month(self):
        assert RaceResultConverter.parse_date("22 Nov 2024") == "2024-11-22"

    def test_full_month(self):
        assert RaceResultConverter.parse_date("14 March 2023") == "2023-03-14"

    def test_non_breaking_spaces(self):
        assert RaceResultConverter.parse_date("05\xa0Jan\xa02025") == "2025-01-05"

    def test_slash_format(self):
        assert RaceResultConverter.parse_date("31/12/2024") == "2024-12-31"

    def test_iso_passthrough(self):
        assert RaceResultConverter.parse_date("2024-06-15") == "2024-06-15"

    def test_empty_string(self):
        assert RaceResultConverter.parse_date("") == ""

    def test_none(self):
        assert RaceResultConverter.parse_date(None) == ""


class TestParseEvent:
    def test_freestyle_with_m(self):
        result = RaceResultConverter.parse_event("100m Freestyle")
        assert result == (100, "free")

    def test_backstroke_with_m(self):
        result = RaceResultConverter.parse_event("200m Backstroke")
        assert result == (200, "back")

    def test_breaststroke_with_m(self):
        result = RaceResultConverter.parse_event("50m Breaststroke")
        assert result == (50, "breast")

    def test_butterfly_with_m(self):
        result = RaceResultConverter.parse_event("100m Butterfly")
        assert result == (100, "fly")

    def test_individual_medley_with_m(self):
        result = RaceResultConverter.parse_event("200m Individual Medley")
        assert result == (200, "im")

    def test_no_m_suffix(self):
        result = RaceResultConverter.parse_event("400 Freestyle")
        assert result == (400, "free")

    def test_invalid_event(self):
        result = RaceResultConverter.parse_event("not an event")
        assert result is None


class TestSynthesizeResultId:
    def test_basic(self):
        result = RaceResultConverter.synthesize_result_id(
            "athlete123", "2024-11-22", 100, "free", "LCM", "58.45", "National Champs"
        )
        assert result == "athlete123_2024-11-22_100_free_LCM_58.45_National Champs"

    def test_empty_meet(self):
        result = RaceResultConverter.synthesize_result_id(
            "abc", "2024-01-01", 200, "back", "SCM", "2:01.00", ""
        )
        assert result == "abc_2024-01-01_200_back_SCM_2:01.00_"


class TestConvertRaceResult:
    def _make_result(self, **kwargs):
        defaults = dict(
            event="100m Freestyle",
            course="LCM",
            time="54.23",
            date="22 Nov 2024",
            city="Toronto",
            meet="Canadian Nationals",
            points="850",
        )
        defaults.update(kwargs)
        return RaceResult(**defaults)

    def test_full_conversion(self):
        race = self._make_result()
        result = RaceResultConverter.convert(race, swimmer_id="sw-1", athlete_id="ath-1")
        assert isinstance(result, WorkoutResult)
        assert result.swimmer_id == "sw-1"
        assert result.distance == 100
        assert result.stroke == "free"
        assert result.time_result == "54.23"
        assert result.result_units == "LCM"
        assert result.performed_on == "2024-11-22"
        assert result.meet_name == "Canadian Nationals"
        assert result.meet_city == "Toronto"
        assert result.source == "swimrankings"
        assert result.swimrankings_result_id == "ath-1_2024-11-22_100_free_LCM_54.23_Canadian Nationals"

    def test_scm_course(self):
        race = self._make_result(course="SCM", event="200m Backstroke", time="2:05.10")
        result = RaceResultConverter.convert(race, swimmer_id="sw-2", athlete_id="ath-2")
        assert result is not None
        assert result.result_units == "SCM"
        assert result.stroke == "back"
        assert result.distance == 200

    def test_unparseable_event_returns_none(self):
        race = self._make_result(event="not an event at all")
        # Force stroke to something not Unknown so it goes through event parsing
        race.stroke = Stroke.FREESTYLE  # will fail on parse_event for distance
        # Actually, let's use a clearly bad event that parse_event returns None for
        race2 = RaceResult(
            event="relay 4x100",
            course="LCM",
            time="3:30.00",
            date="2024-11-22",
            city="Ottawa",
            meet="Some Meet",
        )
        result = RaceResultConverter.convert(race2, swimmer_id="sw-3", athlete_id="ath-3")
        assert result is None

    def test_unknown_stroke_returns_none(self):
        race = RaceResult(
            event="Unknown event 200m",
            course="LCM",
            time="2:00.00",
            date="2024-11-22",
            city="Toronto",
            meet="Test Meet",
            stroke=Stroke.UNKNOWN,
        )
        result = RaceResultConverter.convert(race, swimmer_id="sw-4", athlete_id="ath-4")
        assert result is None


class TestConvertBatch:
    def _valid_result(self, event="100m Freestyle"):
        return RaceResult(
            event=event,
            course="LCM",
            time="54.00",
            date="15 Jun 2024",
            city="Vancouver",
            meet="BC Champs",
        )

    def _invalid_result(self):
        return RaceResult(
            event="some garbage event",
            course="LCM",
            time="1:00.00",
            date="15 Jun 2024",
            city="Vancouver",
            meet="BC Champs",
            stroke=Stroke.UNKNOWN,
        )

    def test_skips_invalid_and_converts_valid(self):
        results = [
            self._valid_result("100m Freestyle"),
            self._invalid_result(),
            self._valid_result("200m Backstroke"),
        ]
        converted = RaceResultConverter.convert_batch(results, swimmer_id="sw-5", athlete_id="ath-5")
        assert len(converted) == 2
        assert all(isinstance(r, WorkoutResult) for r in converted)
        strokes = {r.stroke for r in converted}
        assert "free" in strokes
        assert "back" in strokes
