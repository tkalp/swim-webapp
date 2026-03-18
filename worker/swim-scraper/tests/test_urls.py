"""Unit tests for URL builders."""

from swimrankings.urls import (
    athlete_search, athlete_detail, athlete_event, meet_detail, recent_meets,
    athlete_event_season, meet_results, meet_search, rankings,
)

BASE = "https://www.swimrankings.net/index.php"


class TestExistingUrls:
    def test_athlete_search_default(self):
        assert athlete_search() == f"{BASE}?page=athleteSelect&nationId=0&selectPage=SEARCH"

    def test_athlete_search_with_nation(self):
        assert athlete_search(nation_id=44) == f"{BASE}?page=athleteSelect&nationId=44&selectPage=SEARCH"

    def test_athlete_detail(self):
        assert athlete_detail("4636962") == f"{BASE}?page=athleteDetail&athleteId=4636962"

    def test_athlete_event(self):
        url = athlete_event("4636962", "15")
        assert "athleteId=4636962" in url
        assert "styleId=15" in url

    def test_meet_detail(self):
        assert "meetId=12345" in meet_detail("12345")

    def test_recent_meets(self):
        assert "selectPage=RECENT" in recent_meets()


class TestNewUrls:
    def test_athlete_event_season(self):
        url = athlete_event_season("4636962", "15", "2024")
        assert "athleteId=4636962" in url
        assert "styleId=15" in url
        assert "resultSeason=2024" in url

    def test_meet_results_no_filters(self):
        url = meet_results("12345")
        assert "meetId=12345" in url

    def test_meet_results_with_gender(self):
        url = meet_results("12345", gender="M")
        assert "gender=M" in url

    def test_meet_results_with_style(self):
        url = meet_results("12345", style_id="15")
        assert "styleId=15" in url

    def test_meet_search_default(self):
        url = meet_search()
        assert "nationId=0" in url

    def test_meet_search_with_nation(self):
        url = meet_search(nation_id=44)
        assert "nationId=44" in url

    def test_rankings(self):
        url = rankings("15", "M")
        assert "styleId=15" in url
        assert "gender=M" in url

    def test_rankings_with_season(self):
        url = rankings("15", "M", season="2024")
        assert "season=2024" in url

    def test_rankings_with_nation(self):
        url = rankings("15", "M", nation_id=44)
        assert "nationId=44" in url
