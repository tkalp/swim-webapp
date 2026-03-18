"""Unit tests for athlete comparison and time-delta logic."""

from swimrankings.models import (
    Athlete, RaceResult, Comparison, ComparisonRow, parse_time,
)


class TestTimeDelta:
    def test_positive_diff(self):
        """Athlete A is slower."""
        a = parse_time("1:00.00")
        b = parse_time("58.00")
        diff = a - b
        assert round(diff, 2) == 2.0

    def test_negative_diff(self):
        """Athlete A is faster."""
        a = parse_time("56.88")
        b = parse_time("58.00")
        diff = a - b
        assert round(diff, 2) == -1.12

    def test_zero_diff(self):
        a = parse_time("56.88")
        b = parse_time("56.88")
        assert a - b == 0.0

    def test_format_diff(self):
        diff = parse_time("56.88") - parse_time("58.00")
        assert f"{diff:+.2f}" == "-1.12"


class TestComparisonRow:
    def test_to_dict(self):
        row = ComparisonRow(
            event="100m Free", course="LCM",
            time_a="50.00", time_b="51.00",
            points_a="800", points_b="780",
            diff="-1.00"
        )
        d = row.to_dict()
        assert d["diff"] == "-1.00"
        assert d["event"] == "100m Free"


class TestComparison:
    def test_empty_events(self):
        a = Athlete(id="1", name="A")
        b = Athlete(id="2", name="B")
        c = Comparison(athlete_a=a, athlete_b=b, events=[])
        assert c.to_dict()["events"] == []
