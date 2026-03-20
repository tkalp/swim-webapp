"""Tests for workout parser improvements: markdown stripping, prose-style distances, round notation."""

import pytest
from app.services.workout_parser import WorkoutParser


@pytest.fixture
def parser():
    return WorkoutParser()


class TestMarkdownStripping:
    def test_bold_headers(self, parser):
        text = "**WARM-UP: 600 meters**\n4x100 Free @1:35"
        sets = parser.extract_sets(text)
        assert len(sets) >= 1
        total = sum(s["total_distance"] for s in sets)
        assert total >= 400

    def test_hash_headers(self, parser):
        text = "# MAIN SET\n8x100 Free @1:30"
        sets = parser.extract_sets(text)
        assert len(sets) >= 1
        total = sum(s["total_distance"] for s in sets)
        assert total == 800

    def test_italic_labels(self, parser):
        text = "*Sprint Set:*\n6x50 Free @:45"
        sets = parser.extract_sets(text)
        assert len(sets) >= 1
        total = sum(s["total_distance"] for s in sets)
        assert total == 300


class TestProseStyleDistances:
    def test_simple_prose(self, parser):
        text = "200 Free easy"
        sets = parser.extract_sets(text)
        assert len(sets) >= 1
        assert sets[0]["total_distance"] == 200

    def test_multiple_prose_lines(self, parser):
        text = "300 choice\n200 pull\n100 kick"
        sets = parser.extract_sets(text)
        total = sum(s["total_distance"] for s in sets)
        assert total == 600

    def test_prose_with_activity(self, parser):
        text = "200 kick choice"
        sets = parser.extract_sets(text)
        assert len(sets) >= 1
        assert sets[0]["total_distance"] == 200
        assert sets[0]["activity"] == "kick"


class TestRoundNotation:
    def test_rounds_of(self, parser):
        text = "3 rounds of:\n4x25 Free @1:00\n1x50 easy Free"
        sets = parser.extract_sets(text)
        total = sum(s["total_distance"] for s in sets)
        # 3 * (4*25 + 1*50) = 3 * 150 = 450
        assert total == 450

    def test_rounds_without_of(self, parser):
        text = "2 rounds:\n4x50 Kick @1:00"
        sets = parser.extract_sets(text)
        total = sum(s["total_distance"] for s in sets)
        assert total == 400  # 2 * 4*50


class TestExistingPatternsStillWork:
    """Ensure improvements don't break existing parsing."""

    def test_standard_nxm(self, parser):
        text = "8x100 Free @1:30"
        sets = parser.extract_sets(text)
        assert len(sets) == 1
        assert sets[0]["total_distance"] == 800

    def test_warmup_main_cooldown(self, parser):
        text = "Warm-up:\n400 choice\n\nMain Set:\n4x100 Free @1:30\n\nCool-down:\n200 easy"
        sets = parser.extract_sets(text)
        total = sum(s["total_distance"] for s in sets)
        assert total >= 1000  # 400 + 400 + 200
