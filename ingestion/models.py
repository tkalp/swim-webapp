"""Pydantic data models for the workout ingestion pipeline."""

from __future__ import annotations

import hashlib
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class TrainingFocus(str, Enum):
    SPRINT = "sprint"
    ENDURANCE = "endurance"
    TECHNIQUE = "technique"
    IM = "IM"
    RECOVERY = "recovery"
    RACE_PREP = "race_prep"
    MIXED = "mixed"


class EnergyZone(str, Enum):
    EN1 = "EN1"
    EN2 = "EN2"
    EN3 = "EN3"
    SP1 = "SP1"
    SP2 = "SP2"
    SP3 = "SP3"
    MIXED = "mixed"


class SwimLevel(str, Enum):
    BEGINNER = "beginner"
    AGE_GROUP = "age_group"
    SENIOR = "senior"
    MASTERS = "masters"


class DistanceUnit(str, Enum):
    YARDS = "yards"
    METERS = "meters"


class WorkoutSource(str, Enum):
    SCRAPED = "scraped"
    CURATED = "curated"
    AI_GENERATED = "ai_generated"
    COACH_CREATED = "coach_created"


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _clamp(value: int | float, lo: int | float, hi: int | float) -> int | float:
    """Clamp *value* to the range [lo, hi]."""
    return max(lo, min(hi, value))


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class RawWorkout(BaseModel):
    """A workout as first ingested — minimal structure, no classification."""

    title: str
    text: str
    source: str
    source_url: Optional[str] = None
    source_name: Optional[str] = None
    coach_notes: Optional[str] = None


class NormalizedWorkout(BaseModel):
    """A workout whose text has been cleaned and formatted into a document."""

    title: str
    text: str
    document: str  # Contains "Title: …\nWorkout: …" markers
    source: str
    source_url: Optional[str] = None
    source_name: Optional[str] = None
    coach_notes: Optional[str] = None

    @property
    def content_hash(self) -> str:
        """SHA-256 hex digest of the document field."""
        return hashlib.sha256(self.document.encode("utf-8")).hexdigest()


class WorkoutMetadata(BaseModel):
    """Classification metadata attached to a workout."""

    training_focus: TrainingFocus = TrainingFocus.MIXED
    energy_zone: Optional[EnergyZone] = None
    level: SwimLevel = SwimLevel.AGE_GROUP
    distance_unit: DistanceUnit = DistanceUnit.YARDS
    source: Optional[WorkoutSource] = None

    total_distance: int = 0
    estimated_minutes: int = 0

    pct_free: int = 0
    pct_back: int = 0
    pct_breast: int = 0
    pct_fly: int = 0
    pct_im: int = 0
    pct_kick: int = 0
    pct_drill: int = 0

    @field_validator(
        "pct_free", "pct_back", "pct_breast", "pct_fly",
        "pct_im", "pct_kick", "pct_drill",
        mode="before",
    )
    @classmethod
    def clamp_pct(cls, v: int) -> int:
        return int(_clamp(v, 0, 100))

    @field_validator("total_distance", mode="before")
    @classmethod
    def clamp_distance(cls, v: int) -> int:
        return int(max(0, v))

    @field_validator("estimated_minutes", mode="before")
    @classmethod
    def clamp_minutes(cls, v: int) -> int:
        return int(_clamp(v, 0, 300))


class ClassifiedWorkout(BaseModel):
    """A fully classified workout ready for ChromaDB ingestion."""

    title: str
    text: str
    document: str
    source: str
    source_url: Optional[str] = None
    source_name: Optional[str] = None
    coach_notes: Optional[str] = None
    metadata: WorkoutMetadata = Field(default_factory=WorkoutMetadata)

    @property
    def content_hash(self) -> str:
        """SHA-256 hex digest of the document field."""
        return hashlib.sha256(self.document.encode("utf-8")).hexdigest()
