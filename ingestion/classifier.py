"""Async classifier that calls Claude Haiku to extract workout metadata.

Provides single-workout classification and concurrent batch classification
with semaphore-based concurrency control.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import TYPE_CHECKING

from ingestion.models import NormalizedWorkout, WorkoutMetadata
from ingestion.validator import validate_classifier_output

if TYPE_CHECKING:
    from anthropic import AsyncAnthropic

logger = logging.getLogger(__name__)

MODEL = "claude-haiku-4-5-20251001"
MAX_TOKENS = 500

# ---------------------------------------------------------------------------
# Energy zone definitions included in the classification prompt
# ---------------------------------------------------------------------------

ENERGY_ZONE_DEFINITIONS = """\
- EN1: Easy/recovery, very low intensity
- EN2: Aerobic/moderate, steady-state endurance
- EN3: Threshold, comfortably hard
- SP1: VO2max, hard effort
- SP2: Anaerobic/race pace, very hard
- SP3: Sprint/max effort, all-out
- mixed: Multiple energy zones in a single workout"""

# ---------------------------------------------------------------------------
# Prompt templates
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = (
    "You are a swim coaching assistant that analyzes workout text and returns "
    "structured JSON metadata. Return ONLY a JSON object, no explanation."
)

_CLASSIFY_PROMPT = """\
Analyze this swim workout and return a JSON object with the following fields:

- total_distance (int): total yardage/meters in the workout
- distance_unit (string): "yards" or "meters"
- estimated_minutes (int): estimated duration in minutes
- training_focus (string): one of "sprint", "endurance", "technique", "IM", "recovery", "race_prep", "mixed"
- energy_zone (string): one of "EN1", "EN2", "EN3", "SP1", "SP2", "SP3", "mixed"
- level (string): one of "beginner", "age_group", "senior", "masters"
- pct_free (int 0-100): percentage of workout that is freestyle
- pct_back (int 0-100): percentage that is backstroke
- pct_breast (int 0-100): percentage that is breaststroke
- pct_fly (int 0-100): percentage that is butterfly
- pct_im (int 0-100): percentage that is individual medley
- pct_kick (int 0-100): percentage that is kick sets
- pct_drill (int 0-100): percentage that is drill sets

Energy zone definitions:
{energy_zones}

Workout title: {title}
Workout text:
{text}"""

_RETRY_PROMPT = """\
Return only a JSON object with these fields: total_distance, distance_unit, \
estimated_minutes, training_focus, energy_zone, level, pct_free, pct_back, \
pct_breast, pct_fly, pct_im, pct_kick, pct_drill.

Workout: {title}
{text}"""


# ---------------------------------------------------------------------------
# JSON extraction helpers
# ---------------------------------------------------------------------------

_CODE_BLOCK_RE = re.compile(r"```(?:json)?\s*\n?(.*?)\n?\s*```", re.DOTALL)


def _extract_json(text: str) -> dict | None:
    """Parse JSON from *text*, stripping markdown code-block wrappers if present."""
    # Try stripping code fences first
    match = _CODE_BLOCK_RE.search(text)
    candidate = match.group(1).strip() if match else text.strip()
    try:
        parsed = json.loads(candidate)
        if isinstance(parsed, dict):
            return parsed
    except (json.JSONDecodeError, ValueError):
        pass
    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def classify_workout(
    workout: NormalizedWorkout,
    client: AsyncAnthropic | None = None,
) -> WorkoutMetadata:
    """Classify a single workout by calling Claude Haiku.

    On invalid JSON the function retries once with a simpler prompt.
    If both attempts fail, returns default metadata.

    Parameters
    ----------
    workout:
        The normalized workout to classify.
    client:
        An AsyncAnthropic client instance. If None, one is created.

    Returns
    -------
    WorkoutMetadata
        Validated classification metadata.
    """
    if client is None:
        from anthropic import AsyncAnthropic as _Client
        client = _Client()

    # --- First attempt ---
    prompt = _CLASSIFY_PROMPT.format(
        energy_zones=ENERGY_ZONE_DEFINITIONS,
        title=workout.title,
        text=workout.text,
    )
    raw_dict = await _call_and_parse(client, prompt)
    if raw_dict is not None:
        return validate_classifier_output(raw_dict)

    # --- Retry with simpler prompt ---
    logger.warning("First classify attempt failed for '%s', retrying", workout.title)
    retry_prompt = _RETRY_PROMPT.format(title=workout.title, text=workout.text)
    raw_dict = await _call_and_parse(client, retry_prompt)
    if raw_dict is not None:
        return validate_classifier_output(raw_dict)

    # --- Both failed — return defaults ---
    logger.error("Both classify attempts failed for '%s', using defaults", workout.title)
    return validate_classifier_output(None)


async def classify_batch(
    workouts: list[NormalizedWorkout],
    client: AsyncAnthropic | None = None,
    max_concurrent: int = 10,
) -> list[WorkoutMetadata]:
    """Classify multiple workouts concurrently.

    Uses an asyncio.Semaphore to limit the number of in-flight API calls.

    Parameters
    ----------
    workouts:
        List of normalized workouts to classify.
    client:
        Shared AsyncAnthropic client. If None, one is created.
    max_concurrent:
        Maximum number of concurrent classification calls.

    Returns
    -------
    list[WorkoutMetadata]
        Results in the same order as the input list.
    """
    if client is None:
        from anthropic import AsyncAnthropic as _Client
        client = _Client()

    semaphore = asyncio.Semaphore(max_concurrent)

    async def _limited(workout: NormalizedWorkout) -> WorkoutMetadata:
        async with semaphore:
            return await classify_workout(workout, client=client)

    return list(await asyncio.gather(*[_limited(w) for w in workouts]))


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


async def _call_and_parse(client: AsyncAnthropic, user_prompt: str) -> dict | None:
    """Call Claude and attempt to parse the response as JSON."""
    try:
        response = await client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        text = response.content[0].text
        return _extract_json(text)
    except Exception:
        logger.exception("Anthropic API call failed")
        return None
