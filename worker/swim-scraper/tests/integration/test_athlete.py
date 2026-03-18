"""Integration tests for athlete commands — runs actual browser against swimrankings.net.

Run with: pytest tests/integration/ -v --timeout=300
These tests are slow (browser + rate limiting) and require network access.
"""

import pytest
from swimrankings import SwimRankings

PEATY_ID = "4636962"


@pytest.fixture(scope="module")
def client():
    """Shared browser session across all tests in this module."""
    sr = SwimRankings(rate_limit_min=3.0)
    sr.start()
    yield sr
    sr.close()


class TestSearch:
    def test_search_adam_peaty(self, client):
        results = client.search("Adam Peaty")
        assert len(results) >= 1
        ids = [a.id for a in results]
        assert PEATY_ID in ids

    def test_search_returns_athlete_objects(self, client):
        results = client.search("Adam Peaty")
        assert results[0].name
        assert results[0].id


class TestPersonalBests:
    def test_has_breaststroke(self, client):
        bests = client.personal_bests(PEATY_ID)
        events = [r.event for r in bests]
        assert any("Breaststroke" in e for e in events)

    def test_has_lcm_and_scm(self, client):
        bests = client.personal_bests(PEATY_ID)
        courses = set(r.course for r in bests)
        assert "LCM" in courses
        assert "SCM" in courses

    def test_results_have_times(self, client):
        bests = client.personal_bests(PEATY_ID)
        assert all(r.time for r in bests)


class TestHistory:
    def test_returns_many_results(self, client):
        history = client.history(PEATY_ID)
        assert history.total_results > 100

    def test_has_athlete_name(self, client):
        history = client.history(PEATY_ID)
        assert "PEATY" in history.athlete_name.upper()

    def test_has_events_and_seasons(self, client):
        history = client.history(PEATY_ID)
        assert len(history.events) > 5
        assert len(history.seasons) > 3


class TestDump:
    def test_returns_html(self, client):
        html = client.dump("https://www.swimrankings.net/")
        assert len(html) > 100
        assert "<html" in html.lower()
