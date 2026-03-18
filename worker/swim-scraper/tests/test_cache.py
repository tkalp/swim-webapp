"""Unit tests for CacheStore."""

import os
import tempfile
from datetime import datetime, timezone, timedelta

from swimrankings.cache import CacheStore
from swimrankings.models import Athlete, RaceResult, Stroke, Meet, MeetResult


class TestCacheStoreInit:
    def test_creates_db_file(self):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "test.db")
            store = CacheStore(db_path=path)
            assert os.path.exists(path)
            store.close()

    def test_creates_tables(self):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "test.db")
            store = CacheStore(db_path=path)
            cur = store.conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = {row[0] for row in cur.fetchall()}
            assert "athletes" in tables
            assert "results" in tables
            assert "meets" in tables
            assert "meet_results" in tables
            assert "fetch_log" in tables
            store.close()


class TestIsFresh:
    def _make_store(self, tmp_path):
        return CacheStore(db_path=str(tmp_path / "test.db"))

    def test_fresh_within_ttl(self, tmp_path):
        store = self._make_store(tmp_path)
        recent = datetime.now(timezone.utc).isoformat()
        assert store.is_fresh(recent, ttl_days=7) is True
        store.close()

    def test_expired_outside_ttl(self, tmp_path):
        store = self._make_store(tmp_path)
        old = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()
        assert store.is_fresh(old, ttl_days=7) is False
        store.close()

    def test_exactly_at_ttl_boundary(self, tmp_path):
        store = self._make_store(tmp_path)
        boundary = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        assert store.is_fresh(boundary, ttl_days=7) is False
        store.close()


class TestAthleteCache:
    def _make_store(self, tmp_path):
        return CacheStore(db_path=str(tmp_path / "test.db"))

    def test_put_and_get_athlete(self, tmp_path):
        store = self._make_store(tmp_path)
        a = Athlete(id="123", name="Test Swimmer", nation="GBR", year_of_birth="1994", gender="M", club="Derby SC")
        store.put_athlete(a)
        result = store.get_athlete("123")
        assert result is not None
        assert result.id == "123"
        assert result.name == "Test Swimmer"
        assert result.nation == "GBR"
        assert result.club == "Derby SC"
        store.close()

    def test_get_missing_athlete_returns_none(self, tmp_path):
        store = self._make_store(tmp_path)
        assert store.get_athlete("999") is None
        store.close()

    def test_athlete_expires_after_30_days(self, tmp_path):
        store = self._make_store(tmp_path)
        a = Athlete(id="123", name="Old")
        old_time = (datetime.now(timezone.utc) - timedelta(days=31)).isoformat()
        store.conn.execute(
            "INSERT INTO athletes (id, name, nation, year_of_birth, gender, club, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (a.id, a.name, "", "", "", "", old_time)
        )
        store.conn.commit()
        assert store.get_athlete("123") is None
        store.close()

    def test_upsert_athlete(self, tmp_path):
        store = self._make_store(tmp_path)
        store.put_athlete(Athlete(id="1", name="V1"))
        store.put_athlete(Athlete(id="1", name="V2"))
        result = store.get_athlete("1")
        assert result.name == "V2"
        store.close()

    def test_list_athletes(self, tmp_path):
        store = self._make_store(tmp_path)
        store.put_athlete(Athlete(id="1", name="Alice"))
        store.put_athlete(Athlete(id="2", name="Bob"))
        athletes = store.list_athletes()
        assert len(athletes) == 2
        names = {a.name for a in athletes}
        assert "Alice" in names
        assert "Bob" in names
        store.close()


class TestResultsCache:
    def _make_store(self, tmp_path):
        return CacheStore(db_path=str(tmp_path / "test.db"))

    def test_put_and_get_results(self, tmp_path):
        store = self._make_store(tmp_path)
        results = [
            RaceResult(event="100m Free", course="LCM", time="50.00", points="800",
                       date="1 Jan 2024", city="Paris", meet="Worlds"),
            RaceResult(event="200m Free", course="SCM", time="1:45.00", points="700",
                       date="15 Mar 2024", city="Berlin", meet="Euro Champs"),
        ]
        store.put_results("123", results)
        cached = store.get_results("123")
        assert cached is not None
        assert len(cached) == 2
        assert cached[0].event == "100m Free"
        assert cached[0].time == "50.00"
        assert cached[0].stroke == Stroke.FREESTYLE
        store.close()

    def test_get_results_never_fetched_returns_none(self, tmp_path):
        store = self._make_store(tmp_path)
        assert store.get_results("999") is None
        store.close()

    def test_results_never_expire(self, tmp_path):
        store = self._make_store(tmp_path)
        results = [RaceResult(event="100m Free", course="LCM", time="50.00")]
        store.put_results("123", results)
        old = (datetime.now(timezone.utc) - timedelta(days=365)).isoformat()
        store.conn.execute("UPDATE fetch_log SET fetched_at = ? WHERE key = ?", (old, "results:123"))
        store.conn.commit()
        cached = store.get_results("123")
        assert cached is not None
        assert len(cached) == 1
        store.close()

    def test_put_results_replaces_existing(self, tmp_path):
        store = self._make_store(tmp_path)
        store.put_results("123", [RaceResult(event="100m Free", course="LCM", time="50.00")])
        store.put_results("123", [RaceResult(event="200m Free", course="LCM", time="1:45.00")])
        cached = store.get_results("123")
        assert len(cached) == 1
        assert cached[0].event == "200m Free"
        store.close()


class TestBestsCache:
    def _make_store(self, tmp_path):
        return CacheStore(db_path=str(tmp_path / "test.db"))

    def test_put_and_get_bests(self, tmp_path):
        store = self._make_store(tmp_path)
        bests = [RaceResult(event="100m Breast", course="LCM", time="56.88", points="1000")]
        store.put_bests("123", bests)
        cached = store.get_bests("123")
        assert cached is not None
        assert len(cached) == 1
        assert cached[0].time == "56.88"
        store.close()

    def test_bests_expire_after_7_days(self, tmp_path):
        store = self._make_store(tmp_path)
        store.put_bests("123", [RaceResult(event="100m Free", course="LCM", time="50.00")])
        old = (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()
        store.conn.execute("UPDATE fetch_log SET fetched_at = ? WHERE key = ?", (old, "bests:123"))
        store.conn.commit()
        assert store.get_bests("123") is None
        store.close()

    def test_bests_and_results_are_separate(self, tmp_path):
        store = self._make_store(tmp_path)
        store.put_results("123", [RaceResult(event="100m Free", course="LCM", time="50.00")])
        store.put_bests("123", [RaceResult(event="100m Free", course="LCM", time="49.50")])
        results = store.get_results("123")
        bests = store.get_bests("123")
        assert len(results) == 1
        assert results[0].time == "50.00"
        assert len(bests) == 1
        assert bests[0].time == "49.50"
        store.close()


class TestMeetCache:
    def _make_store(self, tmp_path):
        return CacheStore(db_path=str(tmp_path / "test.db"))

    def test_put_and_get_meet(self, tmp_path):
        store = self._make_store(tmp_path)
        m = Meet(id="100", name="Summer Champs", date="1 Jul 2024", city="Paris", nation="FRA", course="LCM")
        store.put_meet(m)
        cached = store.get_meet("100")
        assert cached is not None
        assert cached.name == "Summer Champs"
        assert cached.course == "LCM"
        store.close()

    def test_get_missing_meet_returns_none(self, tmp_path):
        store = self._make_store(tmp_path)
        assert store.get_meet("999") is None
        store.close()

    def test_list_meets(self, tmp_path):
        store = self._make_store(tmp_path)
        store.put_meet(Meet(id="1", name="Meet A"))
        store.put_meet(Meet(id="2", name="Meet B"))
        meets = store.list_meets()
        assert len(meets) == 2
        store.close()


class TestMeetResultsCache:
    def _make_store(self, tmp_path):
        return CacheStore(db_path=str(tmp_path / "test.db"))

    def test_put_and_get_meet_results(self, tmp_path):
        store = self._make_store(tmp_path)
        results = [MeetResult(rank="1", athlete_name="X", athlete_id="1", nation="GBR",
                              time="56.88", points="1000", event="100m Breast", gender="M")]
        store.put_meet_results("100", results)
        cached = store.get_meet_results("100")
        assert cached is not None
        assert len(cached) == 1
        assert cached[0].time == "56.88"
        store.close()

    def test_get_never_fetched_returns_none(self, tmp_path):
        store = self._make_store(tmp_path)
        assert store.get_meet_results("999") is None
        store.close()


class TestQueryResults:
    def _make_store(self, tmp_path):
        return CacheStore(db_path=str(tmp_path / "test.db"))

    def test_query_all(self, tmp_path):
        store = self._make_store(tmp_path)
        store.put_results("123", [
            RaceResult(event="100m Freestyle", course="LCM", time="50.00"),
            RaceResult(event="100m Breaststroke", course="LCM", time="1:00.00"),
            RaceResult(event="100m Freestyle", course="SCM", time="48.00"),
        ])
        results = store.query_results("123")
        assert len(results) == 3
        store.close()

    def test_query_filter_event(self, tmp_path):
        store = self._make_store(tmp_path)
        store.put_results("123", [
            RaceResult(event="100m Freestyle", course="LCM", time="50.00"),
            RaceResult(event="100m Breaststroke", course="LCM", time="1:00.00"),
        ])
        results = store.query_results("123", event="Breast")
        assert len(results) == 1
        assert results[0].event == "100m Breaststroke"
        store.close()

    def test_query_filter_course(self, tmp_path):
        store = self._make_store(tmp_path)
        store.put_results("123", [
            RaceResult(event="100m Freestyle", course="LCM", time="50.00"),
            RaceResult(event="100m Freestyle", course="SCM", time="48.00"),
        ])
        results = store.query_results("123", course="SCM")
        assert len(results) == 1
        assert results[0].time == "48.00"
        store.close()

    def test_query_filter_stroke(self, tmp_path):
        store = self._make_store(tmp_path)
        store.put_results("123", [
            RaceResult(event="100m Freestyle", course="LCM", time="50.00"),
            RaceResult(event="100m Breaststroke", course="LCM", time="1:00.00"),
        ])
        results = store.query_results("123", stroke="breast")
        assert len(results) == 1
        assert results[0].event == "100m Breaststroke"
        store.close()


class TestCacheManagement:
    def _make_store(self, tmp_path):
        return CacheStore(db_path=str(tmp_path / "test.db"))

    def test_clear_all(self, tmp_path):
        store = self._make_store(tmp_path)
        store.put_athlete(Athlete(id="1", name="A"))
        store.put_results("1", [RaceResult(event="100m Free", course="LCM", time="50.00")])
        store.clear()
        assert store.get_athlete("1") is None
        assert store.get_results("1") is None
        assert store.list_athletes() == []
        store.close()

    def test_clear_single_athlete(self, tmp_path):
        store = self._make_store(tmp_path)
        store.put_athlete(Athlete(id="1", name="A"))
        store.put_athlete(Athlete(id="2", name="B"))
        store.put_results("1", [RaceResult(event="100m Free", course="LCM", time="50.00")])
        store.put_results("2", [RaceResult(event="200m Free", course="LCM", time="1:45.00")])
        store.clear(athlete_id="1")
        assert store.get_athlete("1") is None
        assert store.get_results("1") is None
        assert store.get_athlete("2") is not None
        assert store.get_results("2") is not None
        store.close()

    def test_stats(self, tmp_path):
        store = self._make_store(tmp_path)
        store.put_athlete(Athlete(id="1", name="A"))
        store.put_results("1", [RaceResult(event="100m Free", course="LCM", time="50.00")])
        store.put_meet(Meet(id="100", name="Worlds"))
        s = store.stats()
        assert s["athletes"] == 1
        assert s["results"] == 1
        assert s["meets"] == 1
        assert s["db_size_bytes"] > 0
        assert "oldest_fetch" in s
        store.close()
