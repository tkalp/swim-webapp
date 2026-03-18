"""Unit tests for qualification comparison logic."""

from swimrankings.models import parse_time


class TestQualificationComparison:
    def test_faster_than_cut(self):
        pb = parse_time("56.88")
        cut = parse_time("59.04")
        assert pb < cut  # qualified

    def test_slower_than_cut(self):
        pb = parse_time("1:00.12")
        cut = parse_time("59.04")
        assert pb > cut  # not qualified

    def test_exact_cut(self):
        pb = parse_time("59.04")
        cut = parse_time("59.04")
        assert pb <= cut  # qualified (equal counts)

    def test_diff_calculation(self):
        pb = parse_time("56.88")
        cut = parse_time("59.04")
        diff = pb - cut
        assert round(diff, 2) == -2.16

    def test_no_time_handling(self):
        import math
        pb = parse_time("")
        assert math.isinf(pb)
        assert pb > parse_time("59.04")
