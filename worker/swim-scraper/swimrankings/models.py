import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


def parse_time(time_str: str) -> float:
    """Convert a swim time string to seconds.

    Handles formats: "25.95", "1:06.29", "1:02:03.45".
    Returns float('inf') for unparseable values (DNF, empty, etc.).
    """
    time_str = time_str.strip()
    if not time_str:
        return math.inf
    parts = time_str.split(":")
    try:
        if len(parts) == 1:
            return float(parts[0])
        elif len(parts) == 2:
            return float(parts[0]) * 60 + float(parts[1])
        elif len(parts) == 3:
            return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
    except (ValueError, IndexError):
        pass
    return math.inf


class Stroke(Enum):
    FREESTYLE = "Freestyle"
    BACKSTROKE = "Backstroke"
    BREASTSTROKE = "Breaststroke"
    BUTTERFLY = "Butterfly"
    MEDLEY = "Medley"
    UNKNOWN = "Unknown"

    @classmethod
    def from_event(cls, event_name: str) -> "Stroke":
        """Derive stroke type from event name using word-boundary matching."""
        import re
        name = event_name
        patterns = [
            (cls.BREASTSTROKE, r'\b(?:breaststroke|breast)\b'),
            (cls.BACKSTROKE, r'\b(?:backstroke|back)\b'),
            (cls.BUTTERFLY, r'\b(?:butterfly|fly)\b'),
            (cls.MEDLEY, r'\b(?:medley|im)\b'),
            (cls.FREESTYLE, r'\b(?:freestyle|free)\b'),
        ]
        for stroke, pattern in patterns:
            if re.search(pattern, name, re.IGNORECASE):
                return stroke
        return cls.UNKNOWN


@dataclass
class Athlete:
    id: str
    name: str
    nation: str = ""
    year_of_birth: str = ""
    gender: str = ""
    club: str = ""

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "nation": self.nation,
            "year_of_birth": self.year_of_birth,
            "gender": self.gender,
            "club": self.club,
        }


@dataclass
class RaceResult:
    event: str
    course: str
    time: str
    points: str = ""
    date: str = ""
    city: str = ""
    meet: str = ""
    stroke: Optional[Stroke] = None

    def __post_init__(self):
        if self.stroke is None:
            self.stroke = Stroke.from_event(self.event)

    def to_dict(self) -> dict:
        return {
            "event": self.event,
            "course": self.course,
            "time": self.time,
            "points": self.points,
            "date": self.date,
            "city": self.city,
            "meet": self.meet,
            "stroke": self.stroke.value if self.stroke else None,
        }


@dataclass
class Meet:
    id: str
    name: str
    date: str = ""
    city: str = ""
    nation: str = ""
    course: str = ""

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "date": self.date,
            "city": self.city,
            "nation": self.nation,
            "course": self.course,
        }


@dataclass
class AthleteHistory:
    athlete_id: str
    athlete_name: str
    events: list = field(default_factory=list)
    seasons: list = field(default_factory=list)
    results: list = field(default_factory=list)

    @property
    def total_results(self) -> int:
        return len(self.results)

    def to_dict(self) -> dict:
        return {
            "athlete_id": self.athlete_id,
            "athlete_name": self.athlete_name,
            "events": self.events,
            "seasons": self.seasons,
            "results": [r.to_dict() for r in self.results],
        }


@dataclass
class MeetResult:
    rank: str
    athlete_name: str
    athlete_id: str
    nation: str
    time: str
    points: str
    event: str
    gender: str

    def to_dict(self) -> dict:
        return {
            "rank": self.rank,
            "athlete_name": self.athlete_name,
            "athlete_id": self.athlete_id,
            "nation": self.nation,
            "time": self.time,
            "points": self.points,
            "event": self.event,
            "gender": self.gender,
        }


@dataclass
class Ranking:
    rank: str
    athlete: Athlete
    time: str
    points: str
    meet: str
    date: str

    def to_dict(self) -> dict:
        return {
            "rank": self.rank,
            "athlete_id": self.athlete.id,
            "athlete_name": self.athlete.name,
            "athlete_nation": self.athlete.nation,
            "time": self.time,
            "points": self.points,
            "meet": self.meet,
            "date": self.date,
        }


@dataclass
class QualificationStandard:
    name: str
    event: str
    course: str
    gender: str
    cut_time: str

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "event": self.event,
            "course": self.course,
            "gender": self.gender,
            "cut_time": self.cut_time,
        }


@dataclass
class ComparisonRow:
    event: str
    course: str
    time_a: str
    time_b: str
    points_a: str
    points_b: str
    diff: str

    def to_dict(self) -> dict:
        return {
            "event": self.event,
            "course": self.course,
            "time_a": self.time_a,
            "time_b": self.time_b,
            "points_a": self.points_a,
            "points_b": self.points_b,
            "diff": self.diff,
        }


@dataclass
class Comparison:
    athlete_a: Athlete
    athlete_b: Athlete
    events: list[ComparisonRow] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "athlete_a": self.athlete_a.to_dict(),
            "athlete_b": self.athlete_b.to_dict(),
            "events": [e.to_dict() for e in self.events],
        }
