# AI Coach SP2: Two-Stage RAG & Coach Style Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-stage vector search with two-stage retrieval (global ChromaDB pool + coach's personal workouts from PostgreSQL) and build a coach style engine that learns from saved workouts.

**Architecture:** Alembic migration adds `style_profile` (JSONB) + `coaching_style_notes` (Text) to `coach` table and indexes `workout_template.create_by_coach`. A new `coach_style_service.py` handles style CRUD and Celery-triggered analysis. The existing `workout_generator.py` is rewritten for two-stage retrieval with a richer prompt that includes coach style + examples + global pool results.

**Tech Stack:** FastAPI, SQLAlchemy async, Alembic, Celery, Claude Haiku (style analysis), Claude Sonnet (workout generation), ChromaDB

**Spec:** `docs/superpowers/specs/2026-03-19-ai-coach-sp2-rag-coach-style-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `backend/alembic/versions/xxxx_add_coach_style_columns.py` | Migration: style_profile + coaching_style_notes on coach, index on workout_template.create_by_coach |
| `backend/app/services/coach_style_service.py` | Style profile CRUD, analysis prompt, recomputation logic |
| `backend/app/routes/coach_style.py` | 3 endpoints: GET style, PUT style-notes, POST recompute |
| `worker/style_tasks.py` | Celery task: `recompute_coach_style_task` |

### Modified Files
| File | Changes |
|------|---------|
| `backend/app/infrastructure/models.py` | Add `style_profile`, `coaching_style_notes` to Coach; add `__table_args__` with index to WorkoutTemplate |
| `backend/app/services/ai_coach/workout_generator.py` | Rewrite `generate_workout()` for two-stage retrieval |
| `backend/app/services/ai_coach/prompt_builder.py` | Add `build_style_context()`, `build_coach_examples()` |
| `backend/app/services/ai_coach/client.py` | Update `generate_with_claude()` to accept richer prompt sections |
| `backend/app/routes/ai_coach.py` | Pass coach_id into generate flow, resolve coach from user_id |
| `backend/app/routes/workouts.py` | Dispatch style recomputation Celery task on workout create/update |
| `backend/app/main.py` | Register coach_style router |
| `worker/celery_app.py` | Register style task module |

---

## Task 1: Alembic migration + SQLAlchemy model changes

**Files:**
- Create: `backend/alembic/versions/xxxx_add_coach_style_columns.py`
- Modify: `backend/app/infrastructure/models.py`

- [ ] **Step 1: Add columns to Coach model**

In `backend/app/infrastructure/models.py`, add to the `Coach` class (after `updated_at`, before relationships):

```python
style_profile: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
coaching_style_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
```

- [ ] **Step 2: Add `__table_args__` to WorkoutTemplate model**

In `backend/app/infrastructure/models.py`, add to `WorkoutTemplate` class (after the class docstring or `__tablename__`):

```python
__table_args__ = (
    Index("ix_workout_template_create_by_coach", "create_by_coach"),
)
```

Requires `from sqlalchemy import Index` (likely already imported).

- [ ] **Step 3: Create Alembic migration**

Create `backend/alembic/versions/f1a2b3c4d5e6_add_coach_style_columns.py`:

```python
"""add coach style columns and workout template index

Revision ID: f1a2b3c4d5e6
Revises: c080fc5d3fbf
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'c080fc5d3fbf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('coach', sa.Column('style_profile', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('coach', sa.Column('coaching_style_notes', sa.Text(), nullable=True))
    op.create_index('ix_workout_template_create_by_coach', 'workout_template', ['create_by_coach'])


def downgrade() -> None:
    op.drop_index('ix_workout_template_create_by_coach', table_name='workout_template')
    op.drop_column('coach', 'coaching_style_notes')
    op.drop_column('coach', 'style_profile')
```

- [ ] **Step 4: Run migration**

```bash
cd backend && alembic upgrade head
```

- [ ] **Step 5: Verify columns exist**

```bash
psql -U aquilus -d aquilus -c "\d coach" | grep -E "style_profile|coaching_style_notes"
psql -U aquilus -d aquilus -c "\di ix_workout_template_create_by_coach"
```

- [ ] **Step 6: Commit**

```bash
git add backend/alembic/versions/f1a2b3c4d5e6_add_coach_style_columns.py backend/app/infrastructure/models.py
git commit -m "feat(sp2): add coach style columns + workout_template index migration"
```

---

## Task 2: Coach style service

**Files:**
- Create: `backend/app/services/coach_style_service.py`

- [ ] **Step 1: Implement the service**

Create `backend/app/services/coach_style_service.py`:

```python
"""Coach style profile service.

Handles CRUD for coaching style data and dispatches analysis tasks.
"""

import logging
from typing import Optional
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.models import Coach, WorkoutTemplate
from app.utils import logger

MIN_WORKOUTS_FOR_PROFILE = 3
MAX_WORKOUTS_FOR_ANALYSIS = 20


async def get_coach_by_user_id(db: AsyncSession, user_id: str) -> Optional[Coach]:
    """Resolve coach record from user_id."""
    result = await db.execute(select(Coach).where(Coach.user_id == user_id))
    return result.scalar_one_or_none()


async def get_style(db: AsyncSession, coach_id: str) -> dict:
    """Get coach style profile + notes + workout count."""
    result = await db.execute(
        select(Coach.style_profile, Coach.coaching_style_notes).where(Coach.id == coach_id)
    )
    row = result.first()
    if not row:
        return {"style_profile": None, "coaching_style_notes": None, "workout_count": 0}

    # Count coach's workouts
    count_result = await db.execute(
        select(WorkoutTemplate.id).where(WorkoutTemplate.create_by_coach == coach_id)
    )
    workout_count = len(count_result.all())

    return {
        "style_profile": row.style_profile,
        "coaching_style_notes": row.coaching_style_notes,
        "workout_count": workout_count,
    }


async def update_style_notes(db: AsyncSession, coach_id: str, notes: str) -> str:
    """Update the coach's free-text coaching style notes."""
    await db.execute(
        update(Coach).where(Coach.id == coach_id).values(coaching_style_notes=notes)
    )
    await db.commit()
    return notes


async def get_coach_recent_workouts(
    db: AsyncSession, coach_id: str, limit: int = MAX_WORKOUTS_FOR_ANALYSIS
) -> list[dict]:
    """Get coach's most recent workout templates for style analysis."""
    result = await db.execute(
        select(WorkoutTemplate.name, WorkoutTemplate.raw_description)
        .where(WorkoutTemplate.create_by_coach == coach_id)
        .order_by(WorkoutTemplate.created_at.desc())
        .limit(limit)
    )
    return [{"name": r.name or "", "raw_description": r.raw_description or ""} for r in result.all()]


async def get_coach_example_workouts(db: AsyncSession, coach_id: str, limit: int = 3) -> list[dict]:
    """Get coach's most recent workouts for prompt context (Stage 2 retrieval)."""
    return await get_coach_recent_workouts(db, coach_id, limit=limit)


async def save_style_profile(db: AsyncSession, coach_id: str, profile: dict) -> None:
    """Persist computed style profile to the coach record."""
    await db.execute(
        update(Coach).where(Coach.id == coach_id).values(style_profile=profile)
    )
    await db.commit()


def dispatch_style_recomputation(coach_id: str) -> None:
    """Fire-and-forget Celery task to recompute coach's style profile."""
    try:
        from app.celery_app import celery_app
        celery_app.send_task(
            "worker.style_tasks.recompute_coach_style_task",
            kwargs={"coach_id": str(coach_id)},
        )
        logger.info(f"Dispatched style recomputation for coach {coach_id}")
    except Exception as e:
        logger.warning(f"Failed to dispatch style recomputation: {e}")
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/coach_style_service.py
git commit -m "feat(sp2): add coach style service — CRUD, workout queries, Celery dispatch"
```

---

## Task 3: Celery style recomputation task

**Files:**
- Create: `worker/style_tasks.py`
- Modify: `worker/celery_app.py`

- [ ] **Step 1: Implement the Celery task**

Create `worker/style_tasks.py`:

```python
"""Celery task for recomputing a coach's style profile via Claude Haiku."""

import json
import logging
from datetime import datetime, timezone

from worker.database import get_db
from worker.celery_app import celery_app
from sqlalchemy import select, update, func

logger = logging.getLogger("style_tasks")

STYLE_ANALYSIS_PROMPT = """Analyze these swim workouts written by the same coach and extract their coaching style.
Return JSON only, no explanation.

Workouts:
\"\"\"
{workouts_text}
\"\"\"

Return this exact JSON structure:
{{
  "warm_up_pattern": "<how they typically structure warm-ups>",
  "preferred_distances": "<most common set distances and preferences>",
  "interval_style": "<rest patterns, interval philosophy>",
  "notation_style": "<stroke abbreviations, formatting conventions>",
  "stroke_emphasis": "<which strokes they emphasize>",
  "activity_mix": "<swim/kick/drill/pull balance>",
  "set_structure": "<favorite set types: descending, pyramids, broken, etc.>",
  "personality": "<overall coaching voice and approach>",
  "typical_volume": "<usual total distance range>",
  "coaching_cues": ["<common phrases they use>"]
}}"""


@celery_app.task(name="worker.style_tasks.recompute_coach_style_task")
def recompute_coach_style_task(coach_id: str) -> dict:
    """Recompute a coach's style profile from their saved workouts."""
    from app.infrastructure.models import Coach, WorkoutTemplate

    session = get_db()
    try:
        # Get coach's recent workouts
        result = session.execute(
            select(WorkoutTemplate.name, WorkoutTemplate.raw_description)
            .where(WorkoutTemplate.create_by_coach == coach_id)
            .order_by(WorkoutTemplate.created_at.desc())
            .limit(20)
        )
        workouts = result.all()

        if len(workouts) < 3:
            logger.info(f"Coach {coach_id} has {len(workouts)} workouts — too few for style analysis, clearing profile")
            session.execute(
                update(Coach).where(Coach.id == coach_id).values(style_profile=None)
            )
            session.commit()
            return {"status": "skipped", "reason": "too_few_workouts", "count": len(workouts)}

        # Format workouts for analysis
        workouts_text = ""
        for w in workouts:
            workouts_text += f"--- {w.name or 'Untitled'} ---\n{w.raw_description or ''}\n\n"

        # Call Claude Haiku for style analysis
        import anthropic
        client = anthropic.Anthropic()
        prompt = STYLE_ANALYSIS_PROMPT.format(workouts_text=workouts_text)

        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=800,
            messages=[{"role": "user", "content": prompt}],
        )

        raw_text = response.content[0].text.strip()

        # Parse JSON (handle markdown code blocks)
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
            raw_text = raw_text.strip()

        profile = json.loads(raw_text)

        # Add metadata
        profile["workout_count"] = len(workouts)
        profile["last_analyzed_at"] = datetime.now(timezone.utc).isoformat()

        # Save to DB
        session.execute(
            update(Coach).where(Coach.id == coach_id).values(style_profile=profile)
        )
        session.commit()

        logger.info(f"Style profile recomputed for coach {coach_id} ({len(workouts)} workouts)")
        return {"status": "success", "workout_count": len(workouts)}

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse style analysis JSON for coach {coach_id}: {e}")
        return {"status": "error", "reason": "json_parse_error"}
    except Exception as e:
        logger.error(f"Style recomputation failed for coach {coach_id}: {e}")
        return {"status": "error", "reason": str(e)}
    finally:
        session.close()
```

- [ ] **Step 2: Register task module in celery_app.py**

In `worker/celery_app.py`, update the `include` list:

```python
celery_app = Celery(
    'aquilus',
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=['worker.sync_tasks', 'worker.style_tasks']
)
```

- [ ] **Step 3: Commit**

```bash
git add worker/style_tasks.py worker/celery_app.py
git commit -m "feat(sp2): add Celery task for coach style profile recomputation"
```

---

## Task 4: Coach style API routes

**Files:**
- Create: `backend/app/routes/coach_style.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Implement routes**

Create `backend/app/routes/coach_style.py`:

```python
"""Coach style profile endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db import get_db
from app.middleware.auth import get_current_user_id
from app.services.coach_style_service import (
    get_coach_by_user_id,
    get_style,
    update_style_notes,
    dispatch_style_recomputation,
)

router = APIRouter(prefix="/coaches/me/style", tags=["Coach Style"])


class StyleResponse(BaseModel):
    style_profile: Optional[dict] = None
    coaching_style_notes: Optional[str] = None
    workout_count: int = 0


class StyleNotesRequest(BaseModel):
    coaching_style_notes: str = Field(max_length=2000)


class StyleNotesResponse(BaseModel):
    coaching_style_notes: str


class RecomputeResponse(BaseModel):
    status: str


@router.get("", response_model=StyleResponse)
async def get_coach_style(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get the current coach's style profile and notes."""
    coach = await get_coach_by_user_id(db, user_id)
    if not coach:
        raise HTTPException(status_code=404, detail="Coach profile not found")
    return await get_style(db, str(coach.id))


@router.put("/notes", response_model=StyleNotesResponse)
async def update_coaching_style_notes(
    body: StyleNotesRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update the coach's free-text coaching style notes (max 2000 chars)."""
    coach = await get_coach_by_user_id(db, user_id)
    if not coach:
        raise HTTPException(status_code=404, detail="Coach profile not found")
    notes = await update_style_notes(db, str(coach.id), body.coaching_style_notes)
    return {"coaching_style_notes": notes}


@router.post("/recompute", response_model=RecomputeResponse)
async def recompute_style(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger style profile recomputation."""
    coach = await get_coach_by_user_id(db, user_id)
    if not coach:
        raise HTTPException(status_code=404, detail="Coach profile not found")
    dispatch_style_recomputation(str(coach.id))
    return {"status": "queued"}
```

- [ ] **Step 2: Register router in main.py**

In `backend/app/main.py`, add the import and include:

```python
from app.routes.coach_style import router as coach_style_router
# ... in the app setup:
app.include_router(coach_style_router)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/routes/coach_style.py backend/app/main.py
git commit -m "feat(sp2): add coach style API — GET style, PUT notes, POST recompute"
```

---

## Task 5: Wire workout save → style recomputation

**Files:**
- Modify: `backend/app/routes/workouts.py`

- [ ] **Step 1: Add Celery dispatch to workout create**

In `backend/app/routes/workouts.py`, after the `create_workout` endpoint's `await db.commit()` + `await db.refresh(workout)` and before `return`:

```python
    # Dispatch style profile recomputation if coach is set
    if workout.create_by_coach:
        from app.services.coach_style_service import dispatch_style_recomputation
        dispatch_style_recomputation(str(workout.create_by_coach))
```

- [ ] **Step 2: Add same dispatch to workout update endpoint**

Find the update/PUT endpoint in `workouts.py` and add the same dispatch after commit.

- [ ] **Step 3: Commit**

```bash
git add backend/app/routes/workouts.py
git commit -m "feat(sp2): trigger style recomputation on workout create/update"
```

---

## Task 6: Rewrite prompt builder for coach style context

**Files:**
- Modify: `backend/app/services/ai_coach/prompt_builder.py`

- [ ] **Step 1: Add style context builders**

Add these functions to `prompt_builder.py`:

```python
def build_style_context(style_profile: dict | None) -> str:
    """Format the coach's computed style profile for the prompt."""
    if not style_profile:
        return ""

    lines = ["COACHING STYLE PROFILE:"]
    field_labels = {
        "warm_up_pattern": "Warm-up pattern",
        "preferred_distances": "Preferred distances",
        "interval_style": "Interval style",
        "notation_style": "Notation style",
        "stroke_emphasis": "Stroke emphasis",
        "activity_mix": "Activity mix",
        "set_structure": "Set structure",
        "personality": "Personality",
        "typical_volume": "Typical volume",
    }

    for key, label in field_labels.items():
        value = style_profile.get(key)
        if value:
            lines.append(f"- {label}: {value}")

    cues = style_profile.get("coaching_cues", [])
    if cues:
        lines.append(f"- Common coaching cues: {', '.join(cues)}")

    return "\n".join(lines)


def build_coach_notes_context(coaching_style_notes: str | None) -> str:
    """Format the coach's free-text style notes for the prompt."""
    if not coaching_style_notes:
        return ""
    return f'COACH\'S STYLE NOTES:\n"{coaching_style_notes}"'


def build_coach_examples(workouts: list[dict]) -> str:
    """Format the coach's recent workouts as prompt examples."""
    if not workouts:
        return ""

    lines = ["RECENT WORKOUTS BY THIS COACH (match this style):"]
    for w in workouts:
        name = w.get("name", "Untitled")
        desc = w.get("raw_description", "")
        if desc:
            lines.append(f"---\n{name}\n{desc}")

    return "\n".join(lines)
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/ai_coach/prompt_builder.py
git commit -m "feat(sp2): add style context, coach notes, and coach examples prompt builders"
```

---

## Task 7: Rewrite workout generator for two-stage retrieval

**Files:**
- Modify: `backend/app/services/ai_coach/workout_generator.py`
- Modify: `backend/app/services/ai_coach/client.py`
- Modify: `backend/app/routes/ai_coach.py`

This is the core integration task.

- [ ] **Step 1: Add metadata filter extraction to workout_generator.py**

Add a function to extract ChromaDB `where` filters from the prompt:

```python
_FOCUS_KEYWORDS = {
    "sprint": ["sprint", "fast", "speed", "race pace"],
    "endurance": ["endurance", "distance", "aerobic", "long"],
    "technique": ["technique", "drill", "form", "stroke work"],
    "IM": ["IM", "medley", "individual medley"],
    "recovery": ["recovery", "easy", "warm down", "cooldown"],
    "race_prep": ["race prep", "taper", "competition", "meet prep"],
}


def _extract_metadata_filter(prompt: str) -> dict | None:
    """Extract ChromaDB where filter from prompt keywords."""
    prompt_lower = prompt.lower()
    for focus, keywords in _FOCUS_KEYWORDS.items():
        if any(kw in prompt_lower for kw in keywords):
            return {"training_focus": focus}
    return None
```

- [ ] **Step 2: Rewrite `generate_workout()` for two-stage retrieval**

Replace the existing `generate_workout()` with a new version that:
1. Accepts `coach_id` and `db` session as optional params
2. Does metadata-filtered ChromaDB search (Stage 1)
3. Queries coach's recent workouts + style profile from PostgreSQL (Stage 2)
4. Assembles the full prompt with all sections
5. Calls Claude

```python
async def generate_workout(
    prompt: str,
    best_times: dict | None = None,
    coach_id: str | None = None,
    db=None,
) -> dict:
    """Generate a workout using two-stage retrieval + coach style."""
    from app.services.coach_style_service import (
        get_coach_example_workouts,
        get_style,
    )
    from .prompt_builder import (
        build_athlete_context,
        build_style_context,
        build_coach_notes_context,
        build_coach_examples,
    )

    # Stage 1: Global pool (ChromaDB)
    metadata_filter = _extract_metadata_filter(prompt)
    global_examples = search_similar_workouts(prompt, n_results=5, where=metadata_filter)
    global_context = build_context(global_examples)

    # Stage 2: Coach's personal context (PostgreSQL)
    style_context = ""
    coach_notes_context = ""
    coach_examples_context = ""

    if coach_id and db:
        style_data = await get_style(db, coach_id)
        style_context = build_style_context(style_data.get("style_profile"))
        coach_notes_context = build_coach_notes_context(style_data.get("coaching_style_notes"))

        coach_workouts = await get_coach_example_workouts(db, coach_id, limit=3)
        coach_examples_context = build_coach_examples(coach_workouts)

    # Athlete data
    athlete_context = ""
    if best_times:
        athlete_context = build_athlete_context(best_times)

    # Assemble full context
    sections = [
        s for s in [
            style_context,
            coach_notes_context,
            coach_examples_context,
            global_context,
            athlete_context,
        ] if s
    ]
    full_context = "\n\n".join(sections)

    # Generate
    api_key = os.getenv("ANTHROPIC_API_KEY")
    workout_text = generate_with_claude(prompt, full_context, api_key)

    return {
        "workout": workout_text,
        "athlete_paces": athlete_context if athlete_context else None,
    }
```

- [ ] **Step 3: Update `search_similar_workouts()` to accept where filter**

Modify the existing function signature and ChromaDB query:

```python
def search_similar_workouts(query: str, n_results: int = 5, where: dict | None = None) -> list[dict]:
```

In the query call:
```python
query_params = {"query_texts": [query], "n_results": min(n_results, count)}
if where:
    query_params["where"] = where
results = collection.query(**query_params)
```

- [ ] **Step 4: Update the route to pass coach_id**

In `backend/app/routes/ai_coach.py`, modify `generate_workout_endpoint`:

```python
@router.post("/generate", response_model=GenerateWorkoutResponse)
async def generate_workout_endpoint(
    request: GenerateWorkoutRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Generate a workout using two-stage retrieval + coach personalization."""
    # Resolve coach_id from user_id
    from app.services.coach_style_service import get_coach_by_user_id
    coach = await get_coach_by_user_id(db, user_id)
    coach_id = str(coach.id) if coach else None

    try:
        loop = asyncio.get_event_loop()
        result = await generate_workout(
            prompt=request.prompt,
            best_times=request.bestTimes,
            coach_id=coach_id,
            db=db,
        )
        return GenerateWorkoutResponse(
            workout=result.get("workout", ""),
            athlete_paces=result.get("athlete_paces"),
        )
    except Exception as e:
        logger.error(f"Workout generation failed: {e}")
        log_error(e, context="generate_workout", user_id=user_id)
        raise HTTPException(status_code=500, detail="Failed to generate workout")
```

Add `from sqlalchemy.ext.asyncio import AsyncSession` and `from app.infrastructure.db import get_db` to the route imports.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/ai_coach/workout_generator.py backend/app/services/ai_coach/prompt_builder.py backend/app/routes/ai_coach.py
git commit -m "feat(sp2): two-stage retrieval — global ChromaDB pool + coach style context"
```

---

## Task 8: Update `generate_with_claude()` prompt structure

**Files:**
- Modify: `backend/app/services/ai_coach/client.py`

- [ ] **Step 1: Update the prompt template**

The existing `generate_with_claude()` builds a hardcoded prompt. Update it so the `context` parameter now includes all the assembled sections (style + coach examples + global examples + athlete data). The prompt should end with:

```
Generate a workout that matches this coach's writing style, notation, and training philosophy.
```

Keep the existing format requirements (concise, no philosophy paragraphs, proper notation).

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/ai_coach/client.py
git commit -m "feat(sp2): update Claude prompt to include coach style personalization"
```

---

## Task 9: Verify full flow end-to-end

**Files:** None (verification only)

- [ ] **Step 1: Verify migration applied**

```bash
cd backend && alembic current
```

Expected: shows the new revision as head.

- [ ] **Step 2: Verify new endpoints**

```bash
# Health check
curl http://localhost:8000/coaches/me/style -H "Authorization: Bearer <token>"

# Update notes
curl -X PUT http://localhost:8000/coaches/me/style/notes \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"coaching_style_notes": "I focus on technique and DPS"}'

# Trigger recompute
curl -X POST http://localhost:8000/coaches/me/style/recompute \
  -H "Authorization: Bearer <token>"
```

- [ ] **Step 3: Test workout generation with style**

Create 3+ workouts as a coach, then generate a new workout. Verify the output reflects the coach's style from their saved workouts.

- [ ] **Step 4: Verify Celery task fires on workout save**

Check worker logs after creating a workout — should see style recomputation task dispatched and completed.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(sp2): complete two-stage RAG + coach style engine integration"
```
