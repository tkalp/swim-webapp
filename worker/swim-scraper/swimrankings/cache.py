"""SQLite-backed cache for swimrankings data.

Provides transparent caching with TTL support, offline queries,
and cache management. Uses a fetch_log table to distinguish
"never fetched" from "fetched but empty".
"""

import os
import sqlite3
from datetime import datetime, timezone, timedelta

from .models import Athlete, RaceResult, Meet, MeetResult, Stroke


SCHEMA = """
CREATE TABLE IF NOT EXISTS athletes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    nation TEXT DEFAULT '',
    year_of_birth TEXT DEFAULT '',
    gender TEXT DEFAULT '',
    club TEXT DEFAULT '',
    fetched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    athlete_id TEXT NOT NULL,
    event TEXT NOT NULL,
    course TEXT NOT NULL,
    time TEXT NOT NULL,
    points TEXT DEFAULT '',
    date TEXT DEFAULT '',
    city TEXT DEFAULT '',
    meet TEXT DEFAULT '',
    stroke TEXT DEFAULT '',
    is_personal_best INTEGER DEFAULT 0,
    fetched_at TEXT NOT NULL,
    FOREIGN KEY (athlete_id) REFERENCES athletes(id)
);

CREATE TABLE IF NOT EXISTS meets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    date TEXT DEFAULT '',
    city TEXT DEFAULT '',
    nation TEXT DEFAULT '',
    course TEXT DEFAULT '',
    fetched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meet_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meet_id TEXT NOT NULL,
    rank TEXT DEFAULT '',
    athlete_name TEXT DEFAULT '',
    athlete_id TEXT DEFAULT '',
    nation TEXT DEFAULT '',
    time TEXT NOT NULL,
    points TEXT DEFAULT '',
    event TEXT DEFAULT '',
    gender TEXT DEFAULT '',
    fetched_at TEXT NOT NULL,
    FOREIGN KEY (meet_id) REFERENCES meets(id)
);

CREATE TABLE IF NOT EXISTS fetch_log (
    key TEXT PRIMARY KEY,
    fetched_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_results_athlete ON results(athlete_id);
CREATE INDEX IF NOT EXISTS idx_results_athlete_event ON results(athlete_id, event, course);
CREATE INDEX IF NOT EXISTS idx_meet_results_meet ON meet_results(meet_id);
"""


class CacheStore:
    """SQLite-backed cache for swimrankings data."""

    ATHLETE_TTL_DAYS = 30
    BESTS_TTL_DAYS = 7

    def __init__(self, db_path: str = "~/.swimrankings_cache.db"):
        """Open/create SQLite DB and run schema migrations."""
        self.db_path = os.path.expanduser(db_path)
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript(SCHEMA)

    def close(self):
        """Close the database connection."""
        if self.conn:
            self.conn.close()
            self.conn = None

    def _now(self) -> str:
        """Current UTC time as ISO 8601 string."""
        return datetime.now(timezone.utc).isoformat()

    def is_fresh(self, fetched_at: str, ttl_days: int) -> bool:
        """Check if a fetched_at timestamp is within TTL."""
        fetched = datetime.fromisoformat(fetched_at)
        if fetched.tzinfo is None:
            fetched = fetched.replace(tzinfo=timezone.utc)
        cutoff = datetime.now(timezone.utc) - timedelta(days=ttl_days)
        return fetched > cutoff

    # --- Athlete ---

    def get_athlete(self, athlete_id: str) -> Athlete | None:
        """Get cached athlete. Returns None if missing or expired (30 days)."""
        row = self.conn.execute(
            "SELECT * FROM athletes WHERE id = ?", (athlete_id,)
        ).fetchone()
        if row is None:
            return None
        if not self.is_fresh(row["fetched_at"], self.ATHLETE_TTL_DAYS):
            return None
        return Athlete(
            id=row["id"], name=row["name"], nation=row["nation"],
            year_of_birth=row["year_of_birth"], gender=row["gender"],
            club=row["club"],
        )

    def put_athlete(self, athlete: Athlete) -> None:
        """Upsert an athlete into the cache."""
        self.conn.execute(
            """INSERT OR REPLACE INTO athletes
               (id, name, nation, year_of_birth, gender, club, fetched_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (athlete.id, athlete.name, athlete.nation, athlete.year_of_birth,
             athlete.gender, athlete.club, self._now()),
        )
        self.conn.commit()

    def list_athletes(self) -> list[Athlete]:
        """List all cached athletes (regardless of TTL)."""
        rows = self.conn.execute("SELECT * FROM athletes ORDER BY name").fetchall()
        return [
            Athlete(id=r["id"], name=r["name"], nation=r["nation"],
                    year_of_birth=r["year_of_birth"], gender=r["gender"], club=r["club"])
            for r in rows
        ]

    # --- Results (history) ---

    def get_results(self, athlete_id: str) -> list[RaceResult] | None:
        """Get cached history results. Returns None if never fetched."""
        log_row = self.conn.execute(
            "SELECT fetched_at FROM fetch_log WHERE key = ?",
            (f"results:{athlete_id}",)
        ).fetchone()
        if log_row is None:
            return None
        rows = self.conn.execute(
            "SELECT * FROM results WHERE athlete_id = ? AND is_personal_best = 0",
            (athlete_id,)
        ).fetchall()
        return [self._row_to_result(r) for r in rows]

    def put_results(self, athlete_id: str, results: list[RaceResult]) -> None:
        """Replace all history results for an athlete."""
        now = self._now()
        with self.conn:
            self.conn.execute(
                "DELETE FROM results WHERE athlete_id = ? AND is_personal_best = 0",
                (athlete_id,)
            )
            for r in results:
                self._insert_result(r, athlete_id, is_pb=0, fetched_at=now)
            self.conn.execute(
                "INSERT OR REPLACE INTO fetch_log (key, fetched_at) VALUES (?, ?)",
                (f"results:{athlete_id}", now)
            )

    # --- Personal Bests ---

    def get_bests(self, athlete_id: str) -> list[RaceResult] | None:
        """Get cached PBs. Returns None if never fetched or expired (7 days)."""
        log_row = self.conn.execute(
            "SELECT fetched_at FROM fetch_log WHERE key = ?",
            (f"bests:{athlete_id}",)
        ).fetchone()
        if log_row is None:
            return None
        if not self.is_fresh(log_row["fetched_at"], self.BESTS_TTL_DAYS):
            return None
        rows = self.conn.execute(
            "SELECT * FROM results WHERE athlete_id = ? AND is_personal_best = 1",
            (athlete_id,)
        ).fetchall()
        return [self._row_to_result(r) for r in rows]

    def put_bests(self, athlete_id: str, bests: list[RaceResult]) -> None:
        """Replace all PB results for an athlete."""
        now = self._now()
        with self.conn:
            self.conn.execute(
                "DELETE FROM results WHERE athlete_id = ? AND is_personal_best = 1",
                (athlete_id,)
            )
            for r in bests:
                self._insert_result(r, athlete_id, is_pb=1, fetched_at=now)
            self.conn.execute(
                "INSERT OR REPLACE INTO fetch_log (key, fetched_at) VALUES (?, ?)",
                (f"bests:{athlete_id}", now)
            )

    # --- Meets ---

    def get_meet(self, meet_id: str) -> Meet | None:
        """Get cached meet details. Never expires."""
        row = self.conn.execute(
            "SELECT * FROM meets WHERE id = ?", (meet_id,)
        ).fetchone()
        if row is None:
            return None
        return Meet(
            id=row["id"], name=row["name"], date=row["date"],
            city=row["city"], nation=row["nation"], course=row["course"],
        )

    def put_meet(self, meet: Meet) -> None:
        """Upsert a meet into the cache."""
        self.conn.execute(
            """INSERT OR REPLACE INTO meets
               (id, name, date, city, nation, course, fetched_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (meet.id, meet.name, meet.date, meet.city,
             meet.nation, meet.course, self._now()),
        )
        self.conn.commit()

    def list_meets(self) -> list[Meet]:
        """List all cached meets."""
        rows = self.conn.execute("SELECT * FROM meets ORDER BY name").fetchall()
        return [
            Meet(id=r["id"], name=r["name"], date=r["date"],
                 city=r["city"], nation=r["nation"], course=r["course"])
            for r in rows
        ]

    # --- Meet Results ---

    def get_meet_results(self, meet_id: str) -> list[MeetResult] | None:
        """Get cached meet results. Returns None if never fetched. Never expires."""
        log_row = self.conn.execute(
            "SELECT fetched_at FROM fetch_log WHERE key = ?",
            (f"meet_results:{meet_id}",)
        ).fetchone()
        if log_row is None:
            return None
        rows = self.conn.execute(
            "SELECT * FROM meet_results WHERE meet_id = ?", (meet_id,)
        ).fetchall()
        return [
            MeetResult(rank=r["rank"], athlete_name=r["athlete_name"],
                       athlete_id=r["athlete_id"], nation=r["nation"],
                       time=r["time"], points=r["points"],
                       event=r["event"], gender=r["gender"])
            for r in rows
        ]

    def put_meet_results(self, meet_id: str, results: list[MeetResult]) -> None:
        """Replace all results for a meet."""
        now = self._now()
        with self.conn:
            self.conn.execute("DELETE FROM meet_results WHERE meet_id = ?", (meet_id,))
            for r in results:
                self.conn.execute(
                    """INSERT INTO meet_results
                       (meet_id, rank, athlete_name, athlete_id, nation, time, points, event, gender, fetched_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (meet_id, r.rank, r.athlete_name, r.athlete_id, r.nation,
                     r.time, r.points, r.event, r.gender, now),
                )
            self.conn.execute(
                "INSERT OR REPLACE INTO fetch_log (key, fetched_at) VALUES (?, ?)",
                (f"meet_results:{meet_id}", now)
            )

    # --- Offline Queries ---

    def query_results(self, athlete_id: str, event: str | None = None,
                      course: str | None = None, stroke: str | None = None,
                      season: str | None = None) -> list[RaceResult]:
        """Query cached results with optional filters."""
        rows = self.conn.execute(
            "SELECT * FROM results WHERE athlete_id = ?", (athlete_id,)
        ).fetchall()
        results = [self._row_to_result(r) for r in rows]

        if event:
            query = event.lower()
            results = [r for r in results if query in r.event.lower()]
        if course:
            results = [r for r in results if r.course == course]
        if stroke:
            stroke_map = {"free": Stroke.FREESTYLE, "back": Stroke.BACKSTROKE,
                          "breast": Stroke.BREASTSTROKE, "fly": Stroke.BUTTERFLY, "medley": Stroke.MEDLEY}
            target = stroke_map.get(stroke.lower())
            if target:
                results = [r for r in results if r.stroke == target]
        if season:
            results = [r for r in results if season in r.date]

        return results

    # --- Management ---

    def clear(self, athlete_id: str | None = None) -> None:
        """Wipe cache. If athlete_id given, only wipe that athlete's data."""
        with self.conn:
            if athlete_id:
                self.conn.execute("DELETE FROM athletes WHERE id = ?", (athlete_id,))
                self.conn.execute("DELETE FROM results WHERE athlete_id = ?", (athlete_id,))
                self.conn.execute("DELETE FROM fetch_log WHERE key LIKE ?", (f"%:{athlete_id}",))
            else:
                self.conn.execute("DELETE FROM athletes")
                self.conn.execute("DELETE FROM results")
                self.conn.execute("DELETE FROM meets")
                self.conn.execute("DELETE FROM meet_results")
                self.conn.execute("DELETE FROM fetch_log")

    def stats(self) -> dict:
        """Return cache statistics."""
        athletes = self.conn.execute("SELECT COUNT(*) FROM athletes").fetchone()[0]
        results = self.conn.execute("SELECT COUNT(*) FROM results").fetchone()[0]
        meets = self.conn.execute("SELECT COUNT(*) FROM meets").fetchone()[0]
        meet_results_count = self.conn.execute("SELECT COUNT(*) FROM meet_results").fetchone()[0]

        db_size = os.path.getsize(self.db_path) if os.path.exists(self.db_path) else 0

        oldest_row = self.conn.execute(
            "SELECT MIN(fetched_at) FROM fetch_log"
        ).fetchone()
        oldest = oldest_row[0] if oldest_row and oldest_row[0] else ""

        return {
            "athletes": athletes,
            "results": results,
            "meets": meets,
            "meet_results": meet_results_count,
            "db_size_bytes": db_size,
            "oldest_fetch": oldest,
        }

    # --- Internal helpers ---

    def _insert_result(self, r: RaceResult, athlete_id: str, is_pb: int, fetched_at: str):
        """Insert a single RaceResult row."""
        stroke_val = r.stroke.value if r.stroke else ""
        self.conn.execute(
            """INSERT INTO results
               (athlete_id, event, course, time, points, date, city, meet, stroke, is_personal_best, fetched_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (athlete_id, r.event, r.course, r.time, r.points, r.date,
             r.city, r.meet, stroke_val, is_pb, fetched_at),
        )

    def _row_to_result(self, row) -> RaceResult:
        """Convert a SQLite row to a RaceResult."""
        stroke = None
        if row["stroke"]:
            try:
                stroke = Stroke(row["stroke"])
            except ValueError:
                stroke = Stroke.UNKNOWN
        return RaceResult(
            event=row["event"], course=row["course"], time=row["time"],
            points=row["points"], date=row["date"], city=row["city"],
            meet=row["meet"], stroke=stroke,
        )
