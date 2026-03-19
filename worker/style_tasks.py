"""
Celery task for recomputing a coach's style profile using Claude Haiku.

Analyzes a coach's recent workout templates to extract coaching patterns,
preferences, and style characteristics. The resulting profile is stored
as JSONB on the coach row for use in AI-powered workout generation.
"""

import json
import logging
import re
from datetime import datetime, timezone

import anthropic
from sqlalchemy import select

from worker.database import get_db
from worker.celery_app import celery_app
from app.infrastructure.models import Coach, WorkoutTemplate

logger = logging.getLogger('style_tasks')

STYLE_ANALYSIS_PROMPT = """\
You are analyzing swim workouts written by a coach to extract their coaching style profile.

Below are their most recent workouts. Analyze the patterns and return a JSON object with these fields:

- "warm_up_pattern": string — how they typically structure warm-ups
- "preferred_distances": string — common set distances they use
- "interval_style": string — their rest/interval philosophy
- "notation_style": string — abbreviations and formatting conventions they use
- "stroke_emphasis": string — which strokes are emphasized most
- "activity_mix": string — balance of swim/kick/drill/pull
- "set_structure": string — descending, pyramids, broken sets, straight sets, etc.
- "personality": string — coaching voice and approach
- "typical_volume": string — usual total distance range per session
- "coaching_cues": array of strings — common phrases or cues they use

Return ONLY valid JSON, no markdown fences, no extra text.

--- WORKOUTS ---
{workouts_text}
"""

MIN_WORKOUTS = 3
MAX_WORKOUTS = 20
HAIKU_MODEL = "claude-haiku-4-5-20251001"


def _parse_json_response(text: str) -> dict:
    """Parse JSON from Claude response, handling optional markdown code fences."""
    cleaned = text.strip()
    # Strip markdown code block if present
    match = re.match(r"^```(?:json)?\s*\n?(.*?)\n?\s*```$", cleaned, re.DOTALL)
    if match:
        cleaned = match.group(1).strip()
    return json.loads(cleaned)


def _format_workouts(workouts) -> str:
    """Format workout templates into text for the prompt."""
    parts = []
    for w in workouts:
        name = w.name or "Untitled"
        body = w.raw_description or w.description or ""
        parts.append(f"--- {name} ---\n{body}\n")
    return "\n".join(parts)


@celery_app.task(
    bind=True,
    name='worker.style_tasks.recompute_coach_style_task',
    soft_time_limit=120,
    time_limit=180,
)
def recompute_coach_style_task(self, coach_id: str) -> dict:
    """
    Recompute a coach's style profile by analyzing their recent workouts
    with Claude Haiku.

    Args:
        coach_id: UUID of the coach whose style to analyze.

    Returns:
        Dict with status and workout_count.
    """
    session = get_db()
    try:
        # Fetch recent workouts
        stmt = (
            select(WorkoutTemplate)
            .where(WorkoutTemplate.create_by_coach == coach_id)
            .where(WorkoutTemplate.raw_description.isnot(None))
            .order_by(WorkoutTemplate.created_at.desc())
            .limit(MAX_WORKOUTS)
        )
        workouts = session.execute(stmt).scalars().all()

        # Not enough data — clear profile and skip
        if len(workouts) < MIN_WORKOUTS:
            logger.info(
                f"Coach {coach_id}: only {len(workouts)} workouts, "
                f"need {MIN_WORKOUTS} — clearing style_profile"
            )
            session.execute(
                select(Coach).where(Coach.id == coach_id).with_for_update()
            )
            coach = session.get(Coach, coach_id)
            if coach:
                coach.style_profile = None
                session.commit()
            return {"status": "skipped", "workout_count": len(workouts)}

        # Build prompt
        workouts_text = _format_workouts(workouts)
        prompt = STYLE_ANALYSIS_PROMPT.format(workouts_text=workouts_text)

        # Call Claude Haiku (sync client)
        client = anthropic.Anthropic()
        message = client.messages.create(
            model=HAIKU_MODEL,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )

        response_text = message.content[0].text

        # Parse response
        try:
            profile = _parse_json_response(response_text)
        except json.JSONDecodeError as e:
            logger.error(
                f"Coach {coach_id}: failed to parse Haiku response as JSON: {e}\n"
                f"Raw response: {response_text[:500]}"
            )
            return {"status": "error", "error": f"JSONDecodeError: {str(e)}"}

        # Enrich with metadata
        profile["workout_count"] = len(workouts)
        profile["last_analyzed_at"] = datetime.now(timezone.utc).isoformat()

        # Persist to coach row
        coach = session.get(Coach, coach_id)
        if coach:
            coach.style_profile = profile
            session.commit()
            logger.info(
                f"Coach {coach_id}: style_profile updated "
                f"(analyzed {len(workouts)} workouts)"
            )
        else:
            logger.warning(f"Coach {coach_id} not found when saving style_profile")
            return {"status": "error", "error": "Coach not found"}

        return {"status": "success", "workout_count": len(workouts)}

    except json.JSONDecodeError as e:
        logger.error(f"Coach {coach_id}: JSON parse error: {e}")
        session.rollback()
        return {"status": "error", "error": f"JSONDecodeError: {str(e)}"}
    except Exception as e:
        logger.error(f"Coach {coach_id}: style recompute failed: {e}", exc_info=True)
        session.rollback()
        return {"status": "error", "error": f"{type(e).__name__}: {str(e)}"}
    finally:
        session.close()
