# AI Coach SP1: Workout Data Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a workout ingestion pipeline that populates ChromaDB with 750-1,200 richly-tagged swim workouts from scrapers, curated resources, and AI generation.

**Architecture:** Three data sources feed into a 4-stage pipeline: Normalizer (standardize text) → Classifier (Claude Haiku metadata extraction) → Validator (Pydantic schema enforcement) → ChromaDB Writer (deduped check-then-add). Standalone `ingestion/` package at repo root with CLI interface.

**Tech Stack:** Python 3.10+, ChromaDB 1.5.5, Anthropic SDK 0.84.0, Click (CLI), Pydantic v2, httpx, BeautifulSoup4

**Spec:** `docs/superpowers/specs/2026-03-19-ai-coach-sp1-data-pipeline-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `ingestion/__init__.py` | Package marker |
| `ingestion/models.py` | Pydantic models: `RawWorkout`, `NormalizedWorkout`, `ClassifiedWorkout`, `WorkoutMetadata` |
| `ingestion/normalizer.py` | Raw text → standard format with `Title:`/`Workout:` markers |
| `ingestion/classifier.py` | Async Claude Haiku calls → metadata JSON extraction |
| `ingestion/validator.py` | Pydantic validation with corrections for out-of-range values |
| `ingestion/chromadb_writer.py` | Check-then-add to ChromaDB with dedup via content hash |
| `ingestion/pipeline.py` | Orchestrator: normalize → classify → validate → write |
| `ingestion/scrapers/__init__.py` | Package marker |
| `ingestion/scrapers/base.py` | `BaseScraper` ABC with `scrape() → list[RawWorkout]` |
| `ingestion/scrapers/swimswam.py` | SwimSwam Workout of the Week scraper |
| `ingestion/scrapers/usms.py` | USMS workout library scraper |
| `ingestion/generators/__init__.py` | Package marker |
| `ingestion/generators/ai_generator.py` | Claude-based diverse workout generation |
| `ingestion/curated/__init__.py` | Package marker |
| `ingestion/curated/importer.py` | JSON file import |
| `ingestion/curated/data/coaching_books.json` | Curated workouts from coaching literature |
| `ingestion/curated/data/university_programs.json` | Curated workouts from university programs |
| `ingestion/curated/data/online_resources.json` | Curated workouts from forums/blogs |
| `ingestion/cli.py` | Click-based CLI entry point |
| `ingestion/requirements.txt` | Pinned dependencies |
| `ingestion/tests/__init__.py` | Test package marker |
| `ingestion/tests/test_models.py` | Tests for Pydantic models |
| `ingestion/tests/test_normalizer.py` | Tests for normalizer |
| `ingestion/tests/test_classifier.py` | Tests for classifier (mocked Claude) |
| `ingestion/tests/test_validator.py` | Tests for validator |
| `ingestion/tests/test_chromadb_writer.py` | Tests for writer (mocked ChromaDB) |
| `ingestion/tests/test_pipeline.py` | Integration tests for pipeline |

---

## Task 1: Project scaffolding and Pydantic models

**Files:**
- Create: `ingestion/__init__.py`
- Create: `ingestion/models.py`
- Create: `ingestion/requirements.txt`
- Create: `ingestion/tests/__init__.py`
- Create: `ingestion/tests/test_models.py`

- [ ] **Step 1: Create directory structure and requirements.txt**

```bash
mkdir -p ingestion/scrapers ingestion/generators ingestion/curated/data ingestion/tests
touch ingestion/__init__.py ingestion/scrapers/__init__.py ingestion/generators/__init__.py ingestion/curated/__init__.py ingestion/tests/__init__.py
```

Create `ingestion/requirements.txt`:
```
# Pin to same versions as backend/requirements.txt to avoid ChromaDB data format issues
chromadb==1.5.5
anthropic==0.84.0
httpx>=0.27,<1.0
beautifulsoup4>=4.12,<5.0
lxml>=5.0,<6.0
pydantic>=2.0,<3.0
click>=8.0,<9.0
python-dotenv>=1.0,<2.0
```

- [ ] **Step 2: Write failing tests for Pydantic models**

Create `ingestion/tests/test_models.py`:

```python
"""Tests for ingestion data models."""
import pytest
from ingestion.models import (
    RawWorkout,
    NormalizedWorkout,
    WorkoutMetadata,
    ClassifiedWorkout,
    TrainingFocus,
    EnergyZone,
    SwimLevel,
    DistanceUnit,
    WorkoutSource,
)


class TestRawWorkout:
    def test_minimal(self):
        w = RawWorkout(title="Test", text="Warm-up: 400 Free", source="scraped")
        assert w.title == "Test"
        assert w.source_url is None

    def test_full(self):
        w = RawWorkout(
            title="Sprint",
            text="8x50 Free @:40",
            source="scraped",
            source_url="https://swimswam.com/1",
            source_name="SwimSwam",
            coach_notes="Build each 50",
        )
        assert w.source_name == "SwimSwam"


class TestNormalizedWorkout:
    def test_document_format(self):
        w = NormalizedWorkout(
            title="Test",
            text="8x50 Free @:40",
            document="Title: Test\nWorkout:\n8x50 Free @:40",
            source="scraped",
        )
        assert "Title: Test" in w.document
        assert "Workout:" in w.document

    def test_content_hash_deterministic(self):
        w1 = NormalizedWorkout(title="A", text="same", document="Title: A\nWorkout:\nsame", source="scraped")
        w2 = NormalizedWorkout(title="A", text="same", document="Title: A\nWorkout:\nsame", source="scraped")
        assert w1.content_hash == w2.content_hash

    def test_content_hash_differs(self):
        w1 = NormalizedWorkout(title="A", text="one", document="Title: A\nWorkout:\none", source="scraped")
        w2 = NormalizedWorkout(title="A", text="two", document="Title: A\nWorkout:\ntwo", source="scraped")
        assert w1.content_hash != w2.content_hash


class TestWorkoutMetadata:
    def test_valid_enums(self):
        m = WorkoutMetadata(
            total_distance=3000,
            distance_unit="yards",
            estimated_minutes=45,
            training_focus="sprint",
            energy_zone="SP2",
            level="senior",
        )
        assert m.training_focus == TrainingFocus.SPRINT

    def test_defaults(self):
        m = WorkoutMetadata()
        assert m.training_focus == TrainingFocus.MIXED
        assert m.pct_free == 0
        assert m.total_distance == 0

    def test_pct_clamped(self):
        m = WorkoutMetadata(pct_free=150, pct_back=-10)
        assert m.pct_free == 100
        assert m.pct_back == 0


class TestClassifiedWorkout:
    def test_combines_normalized_and_metadata(self):
        cw = ClassifiedWorkout(
            title="Test",
            text="8x50",
            document="Title: Test\nWorkout:\n8x50",
            source="scraped",
            metadata=WorkoutMetadata(total_distance=400),
        )
        assert cw.metadata.total_distance == 400
        assert cw.content_hash  # auto-computed
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd ingestion && pip install -r requirements.txt && cd .. && python -m pytest ingestion/tests/test_models.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'ingestion.models'`

- [ ] **Step 4: Implement models**

Create `ingestion/models.py`:

```python
"""Data models for the ingestion pipeline."""

import hashlib
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, field_validator


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


class RawWorkout(BaseModel):
    """A workout as received from a scraper, import, or generator — before normalization."""
    title: str
    text: str
    source: str
    source_url: Optional[str] = None
    source_name: Optional[str] = None
    coach_notes: Optional[str] = None


class NormalizedWorkout(BaseModel):
    """A workout after normalization — standardized text with Title:/Workout: markers."""
    title: str
    text: str
    document: str  # Full text with Title:/Workout: markers
    source: str
    source_url: Optional[str] = None
    source_name: Optional[str] = None
    coach_notes: Optional[str] = None

    @property
    def content_hash(self) -> str:
        return hashlib.sha256(self.document.encode("utf-8")).hexdigest()


class WorkoutMetadata(BaseModel):
    """Structured metadata for a workout — filled by the classifier, validated by Pydantic."""
    total_distance: int = 0
    distance_unit: DistanceUnit = DistanceUnit.YARDS
    estimated_minutes: int = 0
    training_focus: TrainingFocus = TrainingFocus.MIXED
    energy_zone: EnergyZone = EnergyZone.MIXED
    level: SwimLevel = SwimLevel.AGE_GROUP
    pct_free: int = 0
    pct_back: int = 0
    pct_breast: int = 0
    pct_fly: int = 0
    pct_im: int = 0
    pct_swim: int = 0
    pct_kick: int = 0
    pct_drill: int = 0
    pct_pull: int = 0

    @field_validator(
        "pct_free", "pct_back", "pct_breast", "pct_fly", "pct_im",
        "pct_swim", "pct_kick", "pct_drill", "pct_pull",
        mode="before",
    )
    @classmethod
    def clamp_pct(cls, v):
        if isinstance(v, (int, float)):
            return max(0, min(100, int(v)))
        return 0

    @field_validator("total_distance", mode="before")
    @classmethod
    def clamp_distance(cls, v):
        if isinstance(v, (int, float)):
            return max(0, int(v))
        return 0

    @field_validator("estimated_minutes", mode="before")
    @classmethod
    def clamp_minutes(cls, v):
        if isinstance(v, (int, float)):
            return max(0, min(300, int(v)))
        return 0


class ClassifiedWorkout(BaseModel):
    """A workout with normalized text and classified metadata — ready for ChromaDB."""
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
        return hashlib.sha256(self.document.encode("utf-8")).hexdigest()
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
python -m pytest ingestion/tests/test_models.py -v
```

Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add ingestion/
git commit -m "feat(ingestion): scaffold project + Pydantic models for workout pipeline"
```

---

## Task 2: Normalizer

**Files:**
- Create: `ingestion/normalizer.py`
- Create: `ingestion/tests/test_normalizer.py`

- [ ] **Step 1: Write failing tests**

Create `ingestion/tests/test_normalizer.py`:

```python
"""Tests for workout normalizer."""
import pytest
from ingestion.models import RawWorkout, NormalizedWorkout
from ingestion.normalizer import normalize


class TestNormalize:
    def test_basic_workout(self):
        raw = RawWorkout(title="Test", text="Warm-up: 400 Free\n8x50 Free @:40", source="scraped")
        result = normalize(raw)
        assert isinstance(result, NormalizedWorkout)
        assert "Title: Test" in result.document
        assert "Workout:" in result.document
        assert "8x50 Free @:40" in result.document

    def test_strips_html(self):
        raw = RawWorkout(title="Test", text="<p>8x50 <b>Free</b> @:40</p>", source="scraped")
        result = normalize(raw)
        assert "<p>" not in result.text
        assert "<b>" not in result.text
        assert "8x50 Free @:40" in result.text

    def test_standardizes_notation(self):
        raw = RawWorkout(title="Test", text="4 × 100 Freestyle @1:30", source="scraped")
        result = normalize(raw)
        assert "4x100" in result.text
        assert "Free" in result.text

    def test_preserves_source_fields(self):
        raw = RawWorkout(
            title="Test", text="400 Free", source="scraped",
            source_url="https://example.com", source_name="Example",
            coach_notes="Focus on turns",
        )
        result = normalize(raw)
        assert result.source == "scraped"
        assert result.source_url == "https://example.com"
        assert result.coach_notes == "Focus on turns"

    def test_empty_text_returns_none(self):
        raw = RawWorkout(title="Test", text="", source="scraped")
        result = normalize(raw)
        assert result is None

    def test_whitespace_only_returns_none(self):
        raw = RawWorkout(title="Test", text="   \n\n  ", source="scraped")
        result = normalize(raw)
        assert result is None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python -m pytest ingestion/tests/test_normalizer.py -v
```

Expected: FAIL

- [ ] **Step 3: Implement normalizer**

Create `ingestion/normalizer.py`:

```python
"""Normalizer: raw workout text → standard format with Title:/Workout: markers."""

import re
import logging
from typing import Optional
from bs4 import BeautifulSoup
from ingestion.models import RawWorkout, NormalizedWorkout

logger = logging.getLogger(__name__)

# Notation standardization rules
_STROKE_MAP = {
    r"\bfreestyle\b": "Free",
    r"\bbackstroke\b": "Back",
    r"\bbreaststroke\b": "Breast",
    r"\bbutterfly\b": "Fly",
    r"\bindividual medley\b": "IM",
}

_NOTATION_FIXES = [
    (r"\s*[×x]\s*", "x"),          # "4 × 100" or "4 x 100" → "4x100"
    (r"(\d)x\s+(\d)", r"\1x\2"),   # "4x 100" → "4x100"
]


def _strip_html(text: str) -> str:
    """Remove HTML tags, keeping text content."""
    if "<" in text and ">" in text:
        soup = BeautifulSoup(text, "html.parser")
        return soup.get_text(separator="\n")
    return text


def _standardize_notation(text: str) -> str:
    """Standardize swim workout notation."""
    # Standardize stroke names (case-insensitive)
    for pattern, replacement in _STROKE_MAP.items():
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)

    # Fix notation patterns
    for pattern, replacement in _NOTATION_FIXES:
        text = re.sub(pattern, replacement, text)

    return text


def _clean_whitespace(text: str) -> str:
    """Normalize whitespace: collapse blank lines, strip trailing spaces."""
    lines = [line.rstrip() for line in text.splitlines()]
    # Collapse multiple blank lines into one
    cleaned = []
    prev_blank = False
    for line in lines:
        if not line:
            if not prev_blank:
                cleaned.append("")
            prev_blank = True
        else:
            cleaned.append(line)
            prev_blank = False
    return "\n".join(cleaned).strip()


def normalize(raw: RawWorkout) -> Optional[NormalizedWorkout]:
    """Normalize a raw workout into standard format.

    Returns None if the workout text is empty or whitespace-only.
    """
    text = raw.text.strip()
    if not text:
        return None

    # Stage 1: Strip HTML
    text = _strip_html(text)

    # Stage 2: Standardize notation
    text = _standardize_notation(text)

    # Stage 3: Clean whitespace
    text = _clean_whitespace(text)

    if not text:
        return None

    # Build document with Title:/Workout: markers
    document = f"Title: {raw.title}\nWorkout:\n{text}"

    return NormalizedWorkout(
        title=raw.title,
        text=text,
        document=document,
        source=raw.source,
        source_url=raw.source_url,
        source_name=raw.source_name,
        coach_notes=raw.coach_notes,
    )
```

- [ ] **Step 4: Run tests**

```bash
python -m pytest ingestion/tests/test_normalizer.py -v
```

Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add ingestion/normalizer.py ingestion/tests/test_normalizer.py
git commit -m "feat(ingestion): add workout normalizer with HTML stripping and notation standardization"
```

---

## Task 3: Validator (Pydantic-based)

**Files:**
- Create: `ingestion/validator.py`
- Create: `ingestion/tests/test_validator.py`

- [ ] **Step 1: Write failing tests**

Create `ingestion/tests/test_validator.py`:

```python
"""Tests for classifier output validator."""
import pytest
from ingestion.validator import validate_classifier_output


class TestValidateClassifierOutput:
    def test_valid_output(self):
        raw = {
            "total_distance": 3000,
            "distance_unit": "yards",
            "estimated_minutes": 45,
            "training_focus": "sprint",
            "energy_zone": "SP2",
            "level": "senior",
            "pct_free": 80, "pct_back": 10, "pct_breast": 5, "pct_fly": 5, "pct_im": 0,
            "pct_swim": 70, "pct_kick": 15, "pct_drill": 10, "pct_pull": 5,
        }
        meta = validate_classifier_output(raw)
        assert meta.training_focus.value == "sprint"
        assert meta.pct_free == 80

    def test_unknown_training_focus_defaults(self):
        raw = {"training_focus": "speed"}  # invalid enum
        meta = validate_classifier_output(raw)
        assert meta.training_focus.value == "mixed"

    def test_unknown_energy_zone_defaults(self):
        raw = {"energy_zone": "hard"}
        meta = validate_classifier_output(raw)
        assert meta.energy_zone.value == "mixed"

    def test_pct_out_of_range_clamped(self):
        raw = {"pct_free": 200, "pct_back": -50}
        meta = validate_classifier_output(raw)
        assert meta.pct_free == 100
        assert meta.pct_back == 0

    def test_empty_dict_returns_defaults(self):
        meta = validate_classifier_output({})
        assert meta.total_distance == 0
        assert meta.training_focus.value == "mixed"

    def test_none_input_returns_defaults(self):
        meta = validate_classifier_output(None)
        assert meta.training_focus.value == "mixed"

    def test_string_numbers_coerced(self):
        raw = {"total_distance": "3000", "pct_free": "80"}
        meta = validate_classifier_output(raw)
        assert meta.total_distance == 3000
        assert meta.pct_free == 80
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python -m pytest ingestion/tests/test_validator.py -v
```

- [ ] **Step 3: Implement validator**

Create `ingestion/validator.py`:

```python
"""Validator: sanitize and validate classifier output against the workout metadata schema."""

import logging
from ingestion.models import WorkoutMetadata, TrainingFocus, EnergyZone, SwimLevel, DistanceUnit

logger = logging.getLogger(__name__)

# Fuzzy mapping for common classifier mistakes
_FOCUS_ALIASES = {
    "speed": "sprint", "fast": "sprint", "power": "sprint",
    "aerobic": "endurance", "distance": "endurance", "base": "endurance",
    "drill": "technique", "form": "technique", "stroke": "technique",
    "warm up": "recovery", "warmup": "recovery", "easy": "recovery",
    "race": "race_prep", "taper": "race_prep", "competition": "race_prep",
    "medley": "IM", "im": "IM",
    "general": "mixed", "varied": "mixed", "all": "mixed",
}

_ZONE_ALIASES = {
    "easy": "EN1", "recovery": "EN1",
    "aerobic": "EN2", "moderate": "EN2", "steady": "EN2",
    "threshold": "EN3", "tempo": "EN3",
    "vo2max": "SP1", "vo2": "SP1", "hard": "SP1",
    "anaerobic": "SP2", "race": "SP2", "race_pace": "SP2",
    "sprint": "SP3", "max": "SP3", "all_out": "SP3",
    "general": "mixed", "varied": "mixed",
}


def _coerce_enum(value, enum_cls, aliases: dict, default):
    """Try to match a value to an enum, using aliases for fuzzy matching."""
    if value is None:
        return default
    val = str(value).strip().lower()
    # Direct match
    for member in enum_cls:
        if member.value.lower() == val:
            return member.value
    # Alias match
    if val in aliases:
        return aliases[val]
    logger.warning(f"Unknown enum value '{value}' for {enum_cls.__name__}, defaulting to '{default}'")
    return default


def validate_classifier_output(raw: dict | None) -> WorkoutMetadata:
    """Validate and sanitize classifier JSON output into a WorkoutMetadata model.

    Corrects out-of-range values and unknown enums rather than rejecting.
    """
    if not raw or not isinstance(raw, dict):
        return WorkoutMetadata()

    # Sanitize enums via fuzzy matching
    sanitized = dict(raw)
    sanitized["training_focus"] = _coerce_enum(
        raw.get("training_focus"), TrainingFocus, _FOCUS_ALIASES, "mixed"
    )
    sanitized["energy_zone"] = _coerce_enum(
        raw.get("energy_zone"), EnergyZone, _ZONE_ALIASES, "mixed"
    )
    sanitized["level"] = _coerce_enum(
        raw.get("level"), SwimLevel, {}, "age_group"
    )
    sanitized["distance_unit"] = _coerce_enum(
        raw.get("distance_unit"), DistanceUnit, {"yard": "yards", "meter": "meters", "m": "meters", "y": "yards"}, "yards"
    )

    # Coerce numeric strings
    for field in ["total_distance", "estimated_minutes",
                  "pct_free", "pct_back", "pct_breast", "pct_fly", "pct_im",
                  "pct_swim", "pct_kick", "pct_drill", "pct_pull"]:
        val = sanitized.get(field)
        if isinstance(val, str):
            try:
                sanitized[field] = int(float(val))
            except (ValueError, TypeError):
                sanitized[field] = 0

    # Let Pydantic handle clamping and type validation
    return WorkoutMetadata(**{k: v for k, v in sanitized.items() if k in WorkoutMetadata.model_fields})
```

- [ ] **Step 4: Run tests**

```bash
python -m pytest ingestion/tests/test_validator.py -v
```

Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add ingestion/validator.py ingestion/tests/test_validator.py
git commit -m "feat(ingestion): add classifier output validator with fuzzy enum matching"
```

---

## Task 4: Classifier (Claude Haiku)

**Files:**
- Create: `ingestion/classifier.py`
- Create: `ingestion/tests/test_classifier.py`

- [ ] **Step 1: Write failing tests**

Create `ingestion/tests/test_classifier.py`:

```python
"""Tests for workout classifier (Claude Haiku)."""
import json
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from ingestion.models import NormalizedWorkout, WorkoutMetadata
from ingestion.classifier import classify_workout, classify_batch


def _make_normalized(title="Test", text="8x50 Free @:40"):
    return NormalizedWorkout(
        title=title, text=text,
        document=f"Title: {title}\nWorkout:\n{text}",
        source="scraped",
    )


class TestClassifyWorkout:
    @pytest.mark.asyncio
    async def test_parses_valid_response(self):
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text=json.dumps({
            "total_distance": 3000,
            "distance_unit": "yards",
            "estimated_minutes": 45,
            "training_focus": "sprint",
            "energy_zone": "SP2",
            "level": "senior",
            "pct_free": 80, "pct_back": 0, "pct_breast": 0,
            "pct_fly": 0, "pct_im": 0,
            "pct_swim": 80, "pct_kick": 10, "pct_drill": 5, "pct_pull": 5,
        }))]

        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=mock_response)

        workout = _make_normalized()
        meta = await classify_workout(workout, client=mock_client)
        assert meta.training_focus.value == "sprint"
        assert meta.pct_free == 80

    @pytest.mark.asyncio
    async def test_invalid_json_returns_defaults(self):
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="not json at all")]

        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=mock_response)

        workout = _make_normalized()
        meta = await classify_workout(workout, client=mock_client)
        assert meta.training_focus.value == "mixed"  # default


class TestClassifyBatch:
    @pytest.mark.asyncio
    async def test_classifies_multiple(self):
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text=json.dumps({
            "total_distance": 2000,
            "distance_unit": "yards",
            "estimated_minutes": 30,
            "training_focus": "endurance",
            "energy_zone": "EN2",
            "level": "age_group",
            "pct_free": 100, "pct_back": 0, "pct_breast": 0,
            "pct_fly": 0, "pct_im": 0,
            "pct_swim": 100, "pct_kick": 0, "pct_drill": 0, "pct_pull": 0,
        }))]

        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=mock_response)

        workouts = [_make_normalized(f"Workout {i}") for i in range(3)]
        results = await classify_batch(workouts, client=mock_client, max_concurrent=2)
        assert len(results) == 3
        assert all(m.training_focus.value == "endurance" for m in results)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python -m pytest ingestion/tests/test_classifier.py -v
```

- [ ] **Step 3: Implement classifier**

Create `ingestion/classifier.py`:

```python
"""Classifier: use Claude Haiku to extract structured metadata from workout text."""

import json
import asyncio
import logging
from typing import Optional
from anthropic import AsyncAnthropic
from ingestion.models import NormalizedWorkout, WorkoutMetadata
from ingestion.validator import validate_classifier_output

logger = logging.getLogger(__name__)

CLASSIFIER_PROMPT = """Given this swim workout, classify it and extract structured metadata.
Return JSON only, no explanation.

Workout title: "{title}"
Workout text:
\"\"\"
{text}
\"\"\"

Energy zone definitions:
- EN1: Easy/recovery, very low intensity, conversational pace
- EN2: Aerobic/moderate, steady-state endurance, can sustain 30+ min
- EN3: Threshold, comfortably hard, lactate threshold pace
- SP1: VO2max, hard effort, sustainable for 3-8 minutes
- SP2: Anaerobic/race pace, very hard, 30sec-2min efforts
- SP3: Sprint/max effort, all-out, under 30sec

Return this exact JSON structure with these exact enum values:
{{
  "total_distance": <int, total meters or yards>,
  "distance_unit": "<yards|meters>",
  "estimated_minutes": <int>,
  "training_focus": "<sprint|endurance|technique|IM|recovery|race_prep|mixed>",
  "energy_zone": "<EN1|EN2|EN3|SP1|SP2|SP3|mixed>",
  "level": "<beginner|age_group|senior|masters>",
  "pct_free": <int 0-100>,
  "pct_back": <int 0-100>,
  "pct_breast": <int 0-100>,
  "pct_fly": <int 0-100>,
  "pct_im": <int 0-100>,
  "pct_swim": <int 0-100>,
  "pct_kick": <int 0-100>,
  "pct_drill": <int 0-100>,
  "pct_pull": <int 0-100>
}}"""


async def classify_workout(
    workout: NormalizedWorkout,
    client: Optional[AsyncAnthropic] = None,
) -> WorkoutMetadata:
    """Classify a single workout using Claude Haiku. Returns validated metadata."""
    if client is None:
        client = AsyncAnthropic()

    prompt = CLASSIFIER_PROMPT.format(title=workout.title, text=workout.text)

    try:
        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}],
        )
        raw_text = response.content[0].text.strip()

        # Extract JSON from response (handle markdown code blocks)
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
            raw_text = raw_text.strip()

        raw_json = json.loads(raw_text)
        return validate_classifier_output(raw_json)

    except json.JSONDecodeError:
        logger.warning(f"Invalid JSON from classifier for '{workout.title}', using defaults")
        return validate_classifier_output(None)
    except Exception as e:
        logger.error(f"Classifier error for '{workout.title}': {e}")
        return validate_classifier_output(None)


async def classify_batch(
    workouts: list[NormalizedWorkout],
    client: Optional[AsyncAnthropic] = None,
    max_concurrent: int = 10,
) -> list[WorkoutMetadata]:
    """Classify multiple workouts concurrently with a semaphore."""
    if client is None:
        client = AsyncAnthropic()

    semaphore = asyncio.Semaphore(max_concurrent)

    async def _classify_with_semaphore(w: NormalizedWorkout) -> WorkoutMetadata:
        async with semaphore:
            return await classify_workout(w, client=client)

    results = await asyncio.gather(*[_classify_with_semaphore(w) for w in workouts])
    return list(results)
```

- [ ] **Step 4: Run tests**

```bash
python -m pytest ingestion/tests/test_classifier.py -v
```

Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add ingestion/classifier.py ingestion/tests/test_classifier.py
git commit -m "feat(ingestion): add async classifier with Claude Haiku and concurrent batching"
```

---

## Task 5: ChromaDB Writer

**Files:**
- Create: `ingestion/chromadb_writer.py`
- Create: `ingestion/tests/test_chromadb_writer.py`

- [ ] **Step 1: Write failing tests**

Create `ingestion/tests/test_chromadb_writer.py`:

```python
"""Tests for ChromaDB writer."""
import pytest
from unittest.mock import MagicMock, patch
from ingestion.models import ClassifiedWorkout, WorkoutMetadata
from ingestion.chromadb_writer import ChromaDBWriter


def _make_classified(title="Test", text="8x50 Free"):
    return ClassifiedWorkout(
        title=title, text=text,
        document=f"Title: {title}\nWorkout:\n{text}",
        source="scraped",
        metadata=WorkoutMetadata(total_distance=400, training_focus="sprint"),
    )


class TestChromaDBWriter:
    def test_write_new_workout(self):
        mock_collection = MagicMock()
        mock_collection.get.return_value = {"ids": []}  # nothing exists

        writer = ChromaDBWriter(collection=mock_collection)
        workout = _make_classified()
        stats = writer.write([workout])

        mock_collection.add.assert_called_once()
        assert stats["added"] == 1
        assert stats["skipped"] == 0

    def test_skip_duplicate(self):
        workout = _make_classified()
        content_hash = workout.content_hash

        mock_collection = MagicMock()
        mock_collection.get.return_value = {"ids": [content_hash]}  # already exists

        writer = ChromaDBWriter(collection=mock_collection)
        stats = writer.write([workout])

        mock_collection.add.assert_not_called()
        assert stats["added"] == 0
        assert stats["skipped"] == 1

    def test_batch_writing(self):
        mock_collection = MagicMock()
        mock_collection.get.return_value = {"ids": []}

        writer = ChromaDBWriter(collection=mock_collection, batch_size=2)
        workouts = [_make_classified(f"W{i}", f"Set {i}") for i in range(5)]
        stats = writer.write(workouts)

        assert stats["added"] == 5
        # 5 workouts / batch_size 2 = 3 add() calls (2+2+1)
        assert mock_collection.add.call_count == 3

    def test_metadata_fields_correct(self):
        mock_collection = MagicMock()
        mock_collection.get.return_value = {"ids": []}

        writer = ChromaDBWriter(collection=mock_collection)
        workout = _make_classified()
        writer.write([workout])

        call_args = mock_collection.add.call_args
        metadata = call_args[1]["metadatas"][0]
        assert metadata["title"] == "Test"
        assert metadata["training_focus"] == "sprint"
        assert metadata["pct_free"] == 0  # default from WorkoutMetadata
        assert "ingested_at" in metadata
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python -m pytest ingestion/tests/test_chromadb_writer.py -v
```

- [ ] **Step 3: Implement writer**

Create `ingestion/chromadb_writer.py`:

```python
"""ChromaDB Writer: check-then-add with deduplication via content hash."""

import logging
from datetime import datetime, timezone
from typing import Optional
import chromadb
from ingestion.models import ClassifiedWorkout

logger = logging.getLogger(__name__)

COLLECTION_NAME = "swimming_workouts"


class ChromaDBWriter:
    """Writes classified workouts to ChromaDB with deduplication."""

    def __init__(
        self,
        collection=None,
        chroma_path: Optional[str] = None,
        batch_size: int = 50,
    ):
        if collection is not None:
            self._collection = collection
        else:
            if not chroma_path:
                raise ValueError("chroma_path is required when collection is not provided")
            client = chromadb.PersistentClient(path=chroma_path)
            self._collection = client.get_or_create_collection(name=COLLECTION_NAME)
        self._batch_size = batch_size

    def write(self, workouts: list[ClassifiedWorkout]) -> dict:
        """Write workouts to ChromaDB, skipping duplicates.

        Returns dict with 'added' and 'skipped' counts.
        """
        if not workouts:
            return {"added": 0, "skipped": 0}

        # Check which IDs already exist
        all_ids = [w.content_hash for w in workouts]
        existing = set()
        # Query in batches (ChromaDB get() has limits)
        for i in range(0, len(all_ids), self._batch_size):
            batch_ids = all_ids[i:i + self._batch_size]
            result = self._collection.get(ids=batch_ids)
            existing.update(result["ids"])

        # Filter to new workouts only
        new_workouts = [w for w in workouts if w.content_hash not in existing]
        skipped = len(workouts) - len(new_workouts)

        if skipped > 0:
            logger.info(f"Skipping {skipped} duplicate workout(s)")

        # Write in batches
        added = 0
        for i in range(0, len(new_workouts), self._batch_size):
            batch = new_workouts[i:i + self._batch_size]
            now = datetime.now(timezone.utc).isoformat()

            self._collection.add(
                ids=[w.content_hash for w in batch],
                documents=[w.document for w in batch],
                metadatas=[self._build_metadata(w, now) for w in batch],
            )
            added += len(batch)

        logger.info(f"Added {added} workout(s) to ChromaDB")
        return {"added": added, "skipped": skipped}

    def count(self) -> int:
        """Return total documents in the collection."""
        return self._collection.count()

    def stats(self) -> dict:
        """Return collection stats including source breakdown."""
        total = self._collection.count()
        stats = {"total": total, "by_source": {}}

        if total > 0:
            for source in ["scraped", "curated", "ai_generated", "coach_created"]:
                try:
                    result = self._collection.get(where={"source": source})
                    stats["by_source"][source] = len(result["ids"])
                except Exception:
                    stats["by_source"][source] = 0

        return stats

    @staticmethod
    def _build_metadata(workout: ClassifiedWorkout, ingested_at: str) -> dict:
        """Build ChromaDB metadata dict from a classified workout."""
        m = workout.metadata
        return {
            "title": workout.title,
            "total_distance": m.total_distance,
            "distance_unit": m.distance_unit.value if hasattr(m.distance_unit, "value") else str(m.distance_unit),
            "estimated_minutes": m.estimated_minutes,
            "training_focus": m.training_focus.value if hasattr(m.training_focus, "value") else str(m.training_focus),
            "energy_zone": m.energy_zone.value if hasattr(m.energy_zone, "value") else str(m.energy_zone),
            "level": m.level.value if hasattr(m.level, "value") else str(m.level),
            "pct_free": m.pct_free,
            "pct_back": m.pct_back,
            "pct_breast": m.pct_breast,
            "pct_fly": m.pct_fly,
            "pct_im": m.pct_im,
            "pct_swim": m.pct_swim,
            "pct_kick": m.pct_kick,
            "pct_drill": m.pct_drill,
            "pct_pull": m.pct_pull,
            "source": workout.source,
            "source_url": workout.source_url or "",
            "source_name": workout.source_name or "",
            "coach_notes": workout.coach_notes or "",
            "ingested_at": ingested_at,
        }
```

- [ ] **Step 4: Run tests**

```bash
python -m pytest ingestion/tests/test_chromadb_writer.py -v
```

Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add ingestion/chromadb_writer.py ingestion/tests/test_chromadb_writer.py
git commit -m "feat(ingestion): add ChromaDB writer with check-then-add dedup"
```

---

## Task 6: Pipeline orchestrator

**Files:**
- Create: `ingestion/pipeline.py`

- [ ] **Step 1: Implement pipeline**

Create `ingestion/pipeline.py`:

```python
"""Pipeline orchestrator: normalize → classify → validate → write."""

import asyncio
import logging
from typing import Optional
from anthropic import AsyncAnthropic
from ingestion.models import RawWorkout, ClassifiedWorkout
from ingestion.normalizer import normalize
from ingestion.classifier import classify_batch
from ingestion.chromadb_writer import ChromaDBWriter

logger = logging.getLogger(__name__)


async def run_pipeline(
    raw_workouts: list[RawWorkout],
    chroma_path: str,
    anthropic_client: Optional[AsyncAnthropic] = None,
    max_concurrent: int = 10,
    batch_size: int = 50,
    dry_run: bool = False,
) -> dict:
    """Run the full ingestion pipeline on a list of raw workouts.

    Returns stats dict with normalize/classify/write counts.
    """
    stats = {
        "input": len(raw_workouts),
        "normalized": 0,
        "classified": 0,
        "added": 0,
        "skipped": 0,
        "normalize_failed": 0,
    }

    # Stage 1: Normalize
    normalized = []
    for raw in raw_workouts:
        result = normalize(raw)
        if result is not None:
            normalized.append(result)
        else:
            stats["normalize_failed"] += 1
    stats["normalized"] = len(normalized)
    logger.info(f"Normalized {len(normalized)}/{len(raw_workouts)} workouts")

    if not normalized:
        return stats

    # Stage 2+3: Classify (includes validation via validate_classifier_output)
    metadata_list = await classify_batch(
        normalized, client=anthropic_client, max_concurrent=max_concurrent
    )
    stats["classified"] = len(metadata_list)
    logger.info(f"Classified {len(metadata_list)} workouts")

    # Build ClassifiedWorkouts
    classified = []
    for nw, meta in zip(normalized, metadata_list):
        classified.append(ClassifiedWorkout(
            title=nw.title,
            text=nw.text,
            document=nw.document,
            source=nw.source,
            source_url=nw.source_url,
            source_name=nw.source_name,
            coach_notes=nw.coach_notes,
            metadata=meta,
        ))

    # Stage 4: Write
    if dry_run:
        logger.info(f"[DRY RUN] Would write {len(classified)} workouts to ChromaDB")
        stats["added"] = 0
        stats["skipped"] = 0
    else:
        writer = ChromaDBWriter(chroma_path=chroma_path, batch_size=batch_size)
        write_stats = writer.write(classified)
        stats["added"] = write_stats["added"]
        stats["skipped"] = write_stats["skipped"]

    return stats
```

- [ ] **Step 2: Commit**

```bash
git add ingestion/pipeline.py
git commit -m "feat(ingestion): add pipeline orchestrator"
```

---

## Task 7: Base scraper + SwimSwam scraper

**Files:**
- Create: `ingestion/scrapers/base.py`
- Create: `ingestion/scrapers/swimswam.py`

- [ ] **Step 1: Implement base scraper**

Create `ingestion/scrapers/base.py`:

```python
"""Base scraper interface."""

from abc import ABC, abstractmethod
from ingestion.models import RawWorkout


class BaseScraper(ABC):
    """Abstract base for workout scrapers."""

    @abstractmethod
    def scrape(self) -> list[RawWorkout]:
        """Scrape workouts from the source. Returns a list of RawWorkout."""
        ...

    @property
    @abstractmethod
    def source_name(self) -> str:
        """Human-readable name for this source."""
        ...
```

- [ ] **Step 2: Implement SwimSwam scraper**

Create `ingestion/scrapers/swimswam.py`:

```python
"""SwimSwam Workout of the Week scraper."""

import re
import logging
import httpx
from bs4 import BeautifulSoup
from ingestion.models import RawWorkout
from ingestion.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

SWIMSWAM_SEARCH_URL = "https://swimswam.com/?s=workout+of+the+week"
SWIMSWAM_TAG_URL = "https://swimswam.com/tag/workout-of-the-week/page/{page}/"


class SwimSwamScraper(BaseScraper):
    """Scrape SwimSwam Workout of the Week articles."""

    source_name = "SwimSwam"

    def __init__(self, max_pages: int = 20):
        self._max_pages = max_pages
        self._client = httpx.Client(
            timeout=30,
            follow_redirects=True,
            headers={"User-Agent": "AquilusBot/1.0 (swim workout research)"},
        )

    def scrape(self) -> list[RawWorkout]:
        """Scrape workout articles from SwimSwam tag pages."""
        article_urls = self._discover_articles()
        logger.info(f"Discovered {len(article_urls)} SwimSwam workout articles")

        workouts = []
        for url in article_urls:
            try:
                workout = self._scrape_article(url)
                if workout:
                    workouts.append(workout)
            except Exception as e:
                logger.warning(f"Failed to scrape {url}: {e}")

        logger.info(f"Scraped {len(workouts)} workouts from SwimSwam")
        return workouts

    def _discover_articles(self) -> list[str]:
        """Find workout article URLs from tag pagination pages."""
        urls = []
        for page in range(1, self._max_pages + 1):
            try:
                resp = self._client.get(SWIMSWAM_TAG_URL.format(page=page))
                if resp.status_code != 200:
                    break
                soup = BeautifulSoup(resp.text, "html.parser")
                links = soup.select("h2.entry-title a, h2 a[href*='workout']")
                if not links:
                    break
                for link in links:
                    href = link.get("href", "")
                    if href and "workout" in href.lower():
                        urls.append(href)
                logger.debug(f"Page {page}: found {len(links)} links")
            except Exception as e:
                logger.warning(f"Failed to fetch SwimSwam page {page}: {e}")
                break
        return list(dict.fromkeys(urls))  # dedupe preserving order

    def _scrape_article(self, url: str) -> RawWorkout | None:
        """Extract workout text from a single SwimSwam article."""
        resp = self._client.get(url)
        if resp.status_code != 200:
            return None

        soup = BeautifulSoup(resp.text, "html.parser")

        # Title
        title_el = soup.select_one("h1.entry-title, h1")
        title = title_el.get_text(strip=True) if title_el else "SwimSwam Workout"

        # Content — the article body
        content_el = soup.select_one("div.entry-content, article .content")
        if not content_el:
            return None

        text = content_el.get_text(separator="\n", strip=True)

        # Filter: must contain workout-like patterns
        if not re.search(r"\d+\s*x\s*\d+", text, re.IGNORECASE):
            return None

        # Truncate to workout-relevant section (skip author bios, ads)
        lines = text.splitlines()
        workout_lines = []
        in_workout = False
        for line in lines:
            stripped = line.strip()
            if re.search(r"(warm|main|cool|set|x\s*\d|\d+\s*x)", stripped, re.IGNORECASE):
                in_workout = True
            if in_workout:
                workout_lines.append(stripped)
            # Stop at common end markers
            if in_workout and re.search(r"(about the author|courtesy|related|share this)", stripped, re.IGNORECASE):
                break

        if not workout_lines:
            return None

        return RawWorkout(
            title=title,
            text="\n".join(workout_lines),
            source="scraped",
            source_url=url,
            source_name="SwimSwam",
        )
```

- [ ] **Step 3: Commit**

```bash
git add ingestion/scrapers/
git commit -m "feat(ingestion): add base scraper + SwimSwam workout scraper"
```

---

## Task 8: USMS scraper

**Files:**
- Create: `ingestion/scrapers/usms.py`

- [ ] **Step 1: Implement USMS scraper**

Create `ingestion/scrapers/usms.py`. The USMS workout library is at `https://www.usms.org/workout-library`. The scraper should:
- Paginate through the workout library
- Extract workout title, text, distance from each workout page
- Return list of `RawWorkout` objects

```python
"""USMS (US Masters Swimming) workout library scraper."""

import re
import logging
import httpx
from bs4 import BeautifulSoup
from ingestion.models import RawWorkout
from ingestion.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

USMS_BASE = "https://www.usms.org"
USMS_WORKOUT_LIST = "https://www.usms.org/workout-library"


class USMSScraper(BaseScraper):
    """Scrape workouts from the USMS workout library."""

    source_name = "USMS"

    def __init__(self, max_pages: int = 30):
        self._max_pages = max_pages
        self._client = httpx.Client(
            timeout=30,
            follow_redirects=True,
            headers={"User-Agent": "AquilusBot/1.0 (swim workout research)"},
        )

    def scrape(self) -> list[RawWorkout]:
        """Scrape workout pages from USMS library."""
        workout_urls = self._discover_workouts()
        logger.info(f"Discovered {len(workout_urls)} USMS workout URLs")

        workouts = []
        for url in workout_urls:
            try:
                workout = self._scrape_workout(url)
                if workout:
                    workouts.append(workout)
            except Exception as e:
                logger.warning(f"Failed to scrape USMS workout {url}: {e}")

        logger.info(f"Scraped {len(workouts)} workouts from USMS")
        return workouts

    def _discover_workouts(self) -> list[str]:
        """Find workout detail URLs from the library listing."""
        urls = []
        for page in range(1, self._max_pages + 1):
            try:
                resp = self._client.get(USMS_WORKOUT_LIST, params={"page": page})
                if resp.status_code != 200:
                    break
                soup = BeautifulSoup(resp.text, "html.parser")
                links = soup.select("a[href*='workout']")
                page_urls = []
                for link in links:
                    href = link.get("href", "")
                    if "/workout-library/" in href and href not in urls:
                        full = href if href.startswith("http") else USMS_BASE + href
                        page_urls.append(full)
                if not page_urls:
                    break
                urls.extend(page_urls)
                logger.debug(f"USMS page {page}: found {len(page_urls)} workout links")
            except Exception as e:
                logger.warning(f"Failed to fetch USMS page {page}: {e}")
                break
        return list(dict.fromkeys(urls))

    def _scrape_workout(self, url: str) -> RawWorkout | None:
        """Extract workout from a USMS workout detail page."""
        resp = self._client.get(url)
        if resp.status_code != 200:
            return None

        soup = BeautifulSoup(resp.text, "html.parser")

        title_el = soup.select_one("h1, .workout-title")
        title = title_el.get_text(strip=True) if title_el else "USMS Workout"

        # Look for workout content in common containers
        content_el = (
            soup.select_one(".workout-content, .workout-body, .entry-content, article")
        )
        if not content_el:
            return None

        text = content_el.get_text(separator="\n", strip=True)

        # Must contain set notation
        if not re.search(r"\d+\s*x\s*\d+", text, re.IGNORECASE):
            return None

        return RawWorkout(
            title=title,
            text=text,
            source="scraped",
            source_url=url,
            source_name="USMS",
        )
```

- [ ] **Step 2: Commit**

```bash
git add ingestion/scrapers/usms.py
git commit -m "feat(ingestion): add USMS workout library scraper"
```

---

## Task 9: AI workout generator

**Files:**
- Create: `ingestion/generators/ai_generator.py`

- [ ] **Step 1: Implement AI generator**

Create `ingestion/generators/ai_generator.py`:

```python
"""AI workout generator: use Claude to generate diverse swim workouts across a parameter matrix."""

import asyncio
import random
import logging
from typing import Optional
from anthropic import AsyncAnthropic
from ingestion.models import RawWorkout

logger = logging.getLogger(__name__)

FOCUSES = ["sprint", "endurance", "technique", "IM", "recovery", "race_prep"]
LEVELS = ["age_group", "senior", "masters"]
DISTANCES = list(range(2000, 6500, 500))  # 2000-6000
STROKE_EMPHASIS = ["freestyle-heavy", "backstroke-heavy", "breaststroke-heavy", "butterfly-heavy", "IM", "mixed"]

GENERATION_PROMPT = """Generate a realistic competitive swim workout with these parameters:
- Training focus: {focus}
- Level: {level} ({level_desc})
- Target total distance: ~{distance} {unit}
- Stroke emphasis: {stroke_emphasis}

Requirements:
- Use standard notation: "8x50 Free @:45" (quantity x distance @ interval stroke)
- Include warm-up, main set, and cool-down
- Intervals must end in 0 or 5 (e.g., 1:30, :45, 2:05)
- Kick/drill sets should have significantly slower intervals than swim
- Be creative with set structure — vary the workout personality
- Include specific intervals appropriate for {level} swimmers
- Total distance should be approximately {distance} {unit}

Output ONLY the workout text. No explanations, no titles, no coaching philosophy.
Start directly with "Warm-up:" and end with the cool-down.
"""

LEVEL_DESCRIPTIONS = {
    "age_group": "competitive youth swimmers ages 10-17",
    "senior": "college-level or national-level adult swimmers",
    "masters": "adult fitness and competitive swimmers ages 25+",
}


async def generate_workouts(
    count: int = 300,
    unit: str = "yards",
    client: Optional[AsyncAnthropic] = None,
    max_concurrent: int = 10,
) -> list[RawWorkout]:
    """Generate diverse swim workouts using Claude.

    Samples from the parameter matrix to produce varied workouts.
    """
    if client is None:
        client = AsyncAnthropic()

    # Build parameter combinations and sample
    all_combos = [
        (f, l, d, s)
        for f in FOCUSES for l in LEVELS for d in DISTANCES for s in STROKE_EMPHASIS
    ]
    sample = random.sample(all_combos, min(count, len(all_combos)))

    logger.info(f"Generating {len(sample)} workouts from parameter matrix")

    semaphore = asyncio.Semaphore(max_concurrent)
    workouts = []

    async def _generate_one(focus, level, distance, stroke):
        async with semaphore:
            try:
                prompt = GENERATION_PROMPT.format(
                    focus=focus,
                    level=level,
                    level_desc=LEVEL_DESCRIPTIONS[level],
                    distance=distance,
                    unit=unit,
                    stroke_emphasis=stroke,
                )
                response = await client.messages.create(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=1500,
                    messages=[{"role": "user", "content": prompt}],
                )
                text = response.content[0].text.strip()
                if not text:
                    return None

                title = f"{distance}{unit[0].upper()} {focus.title()} - {stroke.replace('-', ' ').title()} ({level.replace('_', ' ').title()})"

                return RawWorkout(
                    title=title,
                    text=text,
                    source="ai_generated",
                    source_name="Claude AI Generator",
                )
            except Exception as e:
                logger.warning(f"Failed to generate workout ({focus}/{level}/{distance}/{stroke}): {e}")
                return None

    tasks = [_generate_one(f, l, d, s) for f, l, d, s in sample]
    results = await asyncio.gather(*tasks)
    workouts = [r for r in results if r is not None]

    logger.info(f"Generated {len(workouts)}/{len(sample)} workouts successfully")
    return workouts
```

- [ ] **Step 2: Commit**

```bash
git add ingestion/generators/
git commit -m "feat(ingestion): add AI workout generator with parameter matrix sampling"
```

---

## Task 10: Curated data importer + research compiled workouts

**Files:**
- Create: `ingestion/curated/importer.py`
- Create: `ingestion/curated/data/coaching_books.json`
- Create: `ingestion/curated/data/university_programs.json`
- Create: `ingestion/curated/data/online_resources.json`

- [ ] **Step 1: Implement JSON importer**

Create `ingestion/curated/importer.py`:

```python
"""Import curated workouts from JSON files."""

import json
import logging
from pathlib import Path
from ingestion.models import RawWorkout

logger = logging.getLogger(__name__)


def import_from_file(file_path: str) -> list[RawWorkout]:
    """Load workouts from a JSON file.

    Expected format: array of {title, text, source_name?, coach_notes?}
    """
    path = Path(file_path)
    if not path.exists():
        logger.error(f"File not found: {file_path}")
        return []

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        logger.error(f"Expected JSON array in {file_path}, got {type(data).__name__}")
        return []

    workouts = []
    for i, item in enumerate(data):
        if not isinstance(item, dict) or "text" not in item:
            logger.warning(f"Skipping invalid entry {i} in {file_path}")
            continue
        workouts.append(RawWorkout(
            title=item.get("title", f"Curated Workout {i+1}"),
            text=item["text"],
            source="curated",
            source_name=item.get("source_name", path.stem),
            coach_notes=item.get("coach_notes"),
        ))

    logger.info(f"Imported {len(workouts)} workouts from {file_path}")
    return workouts


def import_all_curated() -> list[RawWorkout]:
    """Import all curated data files from the data/ directory."""
    data_dir = Path(__file__).parent / "data"
    all_workouts = []
    for json_file in sorted(data_dir.glob("*.json")):
        all_workouts.extend(import_from_file(str(json_file)))
    return all_workouts
```

- [ ] **Step 2: Research and compile curated workout data**

This is a research task. The implementer should:
1. Search the web for publicly available swim workouts from coaching books, university programs, coaching forums, and blogs
2. Compile at least 50 workouts total across the 3 JSON files
3. Each workout must have `title`, `text` (the actual sets), and `source_name`

Create the three JSON files in `ingestion/curated/data/`. Each is an array of objects:
```json
[
  {
    "title": "Workout Name",
    "text": "Warm-up: 400 choice\nMain set: 8x100 Free @1:20 descend 1-4\nCool-down: 200 easy",
    "source_name": "Source Book/Site Name",
    "coach_notes": "Optional notes about this workout"
  }
]
```

Target: 15-20 per file, 50+ total.

- [ ] **Step 3: Commit**

```bash
git add ingestion/curated/
git commit -m "feat(ingestion): add curated workout importer + compiled workout data"
```

---

## Task 11: CLI

**Files:**
- Create: `ingestion/cli.py`

- [ ] **Step 1: Implement CLI**

Create `ingestion/cli.py`:

```python
"""CLI entry point for the ingestion pipeline."""

import os
import sys
import asyncio
import logging
import click
from pathlib import Path
from dotenv import load_dotenv

# Load backend .env for CHROMA_DB_PATH and ANTHROPIC_API_KEY
_backend_env = Path(__file__).parent.parent / "backend" / ".env"
if _backend_env.exists():
    load_dotenv(_backend_env)

logger = logging.getLogger("ingestion")


def _get_chroma_path(ctx_param: str | None) -> str:
    """Resolve ChromaDB path from CLI flag or env var."""
    path = ctx_param or os.getenv("CHROMA_DB_PATH")
    if not path:
        click.echo("Error: --chroma-path or CHROMA_DB_PATH env var required", err=True)
        sys.exit(1)
    return path


@click.group()
@click.option("--chroma-path", default=None, help="ChromaDB path (overrides CHROMA_DB_PATH env)")
@click.option("--verbose", is_flag=True, help="Enable debug logging")
@click.pass_context
def cli(ctx, chroma_path, verbose):
    """Aquilus workout ingestion pipeline."""
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    )
    ctx.ensure_object(dict)
    ctx.obj["chroma_path"] = chroma_path


@cli.command()
@click.option("--source", required=True, type=click.Choice(["swimswam", "usms"]))
@click.option("--dry-run", is_flag=True)
@click.pass_context
def scrape(ctx, source, dry_run):
    """Scrape workouts from a web source."""
    from ingestion.pipeline import run_pipeline

    if source == "swimswam":
        from ingestion.scrapers.swimswam import SwimSwamScraper
        scraper = SwimSwamScraper()
    elif source == "usms":
        from ingestion.scrapers.usms import USMSScraper
        scraper = USMSScraper()

    click.echo(f"Scraping {source}...")
    raw_workouts = scraper.scrape()
    click.echo(f"Found {len(raw_workouts)} workouts")

    chroma_path = _get_chroma_path(ctx.obj["chroma_path"])
    stats = asyncio.run(run_pipeline(raw_workouts, chroma_path, dry_run=dry_run))
    _print_stats(stats)


@cli.command(name="import")
@click.option("--file", "file_path", required=True, help="Path to JSON file")
@click.option("--dry-run", is_flag=True)
@click.pass_context
def import_cmd(ctx, file_path, dry_run):
    """Import curated workouts from a JSON file."""
    from ingestion.curated.importer import import_from_file
    from ingestion.pipeline import run_pipeline

    raw_workouts = import_from_file(file_path)
    click.echo(f"Loaded {len(raw_workouts)} workouts from {file_path}")

    chroma_path = _get_chroma_path(ctx.obj["chroma_path"])
    stats = asyncio.run(run_pipeline(raw_workouts, chroma_path, dry_run=dry_run))
    _print_stats(stats)


@cli.command()
@click.option("--count", default=300, help="Number of workouts to generate")
@click.option("--dry-run", is_flag=True)
@click.pass_context
def generate(ctx, count, dry_run):
    """Generate AI workouts using Claude."""
    from ingestion.generators.ai_generator import generate_workouts
    from ingestion.pipeline import run_pipeline

    click.echo(f"Generating {count} workouts...")
    raw_workouts = asyncio.run(generate_workouts(count=count))
    click.echo(f"Generated {len(raw_workouts)} workouts")

    chroma_path = _get_chroma_path(ctx.obj["chroma_path"])
    stats = asyncio.run(run_pipeline(raw_workouts, chroma_path, dry_run=dry_run))
    _print_stats(stats)


@cli.command(name="run-all")
@click.option("--dry-run", is_flag=True)
@click.pass_context
def run_all(ctx, dry_run):
    """Run full pipeline: scrape + import curated + generate AI workouts."""
    from ingestion.scrapers.swimswam import SwimSwamScraper
    from ingestion.scrapers.usms import USMSScraper
    from ingestion.curated.importer import import_all_curated
    from ingestion.generators.ai_generator import generate_workouts
    from ingestion.pipeline import run_pipeline

    chroma_path = _get_chroma_path(ctx.obj["chroma_path"])
    all_raw = []

    # Scrapers
    for ScraperCls in [SwimSwamScraper, USMSScraper]:
        scraper = ScraperCls()
        click.echo(f"Scraping {scraper.source_name}...")
        all_raw.extend(scraper.scrape())

    # Curated
    click.echo("Importing curated workouts...")
    all_raw.extend(import_all_curated())

    # AI-generated
    click.echo("Generating AI workouts...")
    ai_workouts = asyncio.run(generate_workouts(count=300))
    all_raw.extend(ai_workouts)

    click.echo(f"\nTotal raw workouts: {len(all_raw)}")
    stats = asyncio.run(run_pipeline(all_raw, chroma_path, dry_run=dry_run))
    _print_stats(stats)


@cli.command()
@click.pass_context
def status(ctx):
    """Show ChromaDB collection stats."""
    from ingestion.chromadb_writer import ChromaDBWriter

    chroma_path = _get_chroma_path(ctx.obj["chroma_path"])
    writer = ChromaDBWriter(chroma_path=chroma_path)
    stats = writer.stats()

    click.echo(f"\nCollection: swimming_workouts")
    click.echo(f"Total workouts: {stats['total']}")
    click.echo(f"\nBy source:")
    for source, count in stats.get("by_source", {}).items():
        click.echo(f"  {source}: {count}")


@cli.command()
@click.option("--output", required=True, help="Output file path")
@click.pass_context
def export(ctx, output):
    """Export all workouts to JSON for backup."""
    import json
    import chromadb

    chroma_path = _get_chroma_path(ctx.obj["chroma_path"])
    client = chromadb.PersistentClient(path=chroma_path)
    collection = client.get_or_create_collection(name="swimming_workouts")

    result = collection.get(include=["documents", "metadatas"])
    data = []
    for i, doc_id in enumerate(result["ids"]):
        data.append({
            "id": doc_id,
            "document": result["documents"][i],
            "metadata": result["metadatas"][i],
        })

    with open(output, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    click.echo(f"Exported {len(data)} workouts to {output}")


def _print_stats(stats: dict):
    """Pretty-print pipeline stats."""
    click.echo(f"\n--- Pipeline Results ---")
    click.echo(f"Input:            {stats.get('input', 0)}")
    click.echo(f"Normalized:       {stats.get('normalized', 0)}")
    click.echo(f"Classified:       {stats.get('classified', 0)}")
    click.echo(f"Added to ChromaDB: {stats.get('added', 0)}")
    click.echo(f"Skipped (dupes):  {stats.get('skipped', 0)}")
    if stats.get("normalize_failed"):
        click.echo(f"Normalize failed: {stats['normalize_failed']}")


if __name__ == "__main__":
    cli()
```

- [ ] **Step 2: Verify CLI runs**

```bash
python -m ingestion.cli --help
python -m ingestion.cli status --chroma-path ./test_chroma
```

- [ ] **Step 3: Commit**

```bash
git add ingestion/cli.py
git commit -m "feat(ingestion): add Click CLI with scrape/import/generate/status/export commands"
```

---

## Task 12: End-to-end test and final verification

**Files:** None (verification only)

- [ ] **Step 1: Run all unit tests**

```bash
python -m pytest ingestion/tests/ -v
```

Expected: All tests PASS

- [ ] **Step 2: Run a dry-run pipeline with a small curated file**

Create a small test file and run:
```bash
python -m ingestion.cli import --file ingestion/curated/data/coaching_books.json --chroma-path ./test_chroma --dry-run
```

Expected: Shows normalized/classified counts without writing

- [ ] **Step 3: Run status command**

```bash
python -m ingestion.cli status --chroma-path ./test_chroma
```

Expected: Shows collection stats (0 if dry-run only)

- [ ] **Step 4: Run a real small import**

```bash
python -m ingestion.cli import --file ingestion/curated/data/coaching_books.json --chroma-path ./test_chroma
python -m ingestion.cli status --chroma-path ./test_chroma
```

Expected: Shows workouts added, status reflects the count

- [ ] **Step 5: Clean up test data and commit**

```bash
rm -rf ./test_chroma
git add -A
git commit -m "feat(ingestion): complete SP1 workout data pipeline"
```
