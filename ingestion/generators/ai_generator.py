"""AI workout generator using Claude Haiku with parameter matrix sampling."""

from __future__ import annotations

import asyncio
import logging
import random
from typing import Optional

import anthropic

from ingestion.models import RawWorkout

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Parameter matrix
# ---------------------------------------------------------------------------

FOCUSES: list[str] = [
    "sprint",
    "endurance",
    "technique",
    "IM",
    "recovery",
    "race_prep",
]

LEVELS: dict[str, str] = {
    "age_group": "competitive age-group swimmers (12-17 years old)",
    "senior": "senior/college-level competitive swimmers",
    "masters": "adult masters swimmers (fitness-oriented, mixed ability)",
}

DISTANCES: list[int] = list(range(2000, 6500, 500))  # 2000-6000 inclusive

STROKE_EMPHASIS: list[str] = [
    "freestyle-heavy",
    "backstroke-heavy",
    "breaststroke-heavy",
    "butterfly-heavy",
    "IM",
    "mixed",
]

# Total combinations: 6 focuses * 3 levels * 9 distances * 6 strokes = 972
TOTAL_COMBOS: int = len(FOCUSES) * len(LEVELS) * len(DISTANCES) * len(STROKE_EMPHASIS)

MODEL: str = "claude-haiku-4-5-20251001"


# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------

def _build_prompt(
    focus: str,
    level: str,
    level_description: str,
    distance: int,
    stroke_emphasis: str,
    unit: str,
) -> str:
    """Build the generation prompt for a single workout."""
    return f"""Write a competitive swim workout with these parameters:
- Total distance: approximately {distance} {unit}
- Training focus: {focus}
- Stroke emphasis: {stroke_emphasis}
- Level: {level_description}

Requirements:
- Use standard swim notation: "8x50 Free @:45", "4x100 IM @1:30"
- Include warm-up, main set, and cool-down sections
- All intervals must end in 0 or 5 (e.g., :45, 1:30, 2:05)
- Kick and drill sets should have slower intervals than swim sets
- Be creative with set structure — vary rep counts, use descend/build patterns, broken swims, negative splits
- Output ONLY the workout text with set descriptions, no titles, no philosophy, no explanations"""


# ---------------------------------------------------------------------------
# Single generation
# ---------------------------------------------------------------------------

async def _generate_one(
    client: anthropic.AsyncAnthropic,
    semaphore: asyncio.Semaphore,
    focus: str,
    level: str,
    level_description: str,
    distance: int,
    stroke_emphasis: str,
    unit: str,
) -> Optional[RawWorkout]:
    """Generate a single workout via Claude Haiku, respecting the semaphore."""
    unit_letter = "y" if unit == "yards" else "m"
    title = f"{distance}{unit_letter} {focus} - {stroke_emphasis} ({level})"

    prompt = _build_prompt(focus, level, level_description, distance, stroke_emphasis, unit)

    async with semaphore:
        try:
            response = await client.messages.create(
                model=MODEL,
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            )
            text = response.content[0].text.strip()
            if not text:
                logger.warning("Empty response for workout: %s", title)
                return None

            return RawWorkout(
                title=title,
                text=text,
                source="ai_generated",
                source_name="Claude AI Generator",
            )
        except Exception:
            logger.exception("Failed to generate workout: %s", title)
            return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def generate_workouts(
    count: int = 300,
    unit: str = "yards",
    client: Optional[anthropic.AsyncAnthropic] = None,
    max_concurrent: int = 10,
) -> list[RawWorkout]:
    """Generate *count* AI workouts by sampling from the parameter matrix.

    Args:
        count: Number of workouts to generate (sampled from 972 total combos).
        unit: Distance unit — ``"yards"`` or ``"meters"``.
        client: An ``AsyncAnthropic`` client.  Created automatically if *None*.
        max_concurrent: Maximum number of concurrent API calls.

    Returns:
        A list of successfully generated ``RawWorkout`` instances.
    """
    if client is None:
        client = anthropic.AsyncAnthropic()

    # Build full matrix and sample
    combos: list[tuple[str, str, str, int, str]] = [
        (focus, level, desc, distance, stroke)
        for focus in FOCUSES
        for level, desc in LEVELS.items()
        for distance in DISTANCES
        for stroke in STROKE_EMPHASIS
    ]

    sample_size = min(count, len(combos))
    selected = random.sample(combos, sample_size)

    logger.info(
        "Generating %d workouts (%d total combos, unit=%s, concurrency=%d)",
        sample_size,
        len(combos),
        unit,
        max_concurrent,
    )

    semaphore = asyncio.Semaphore(max_concurrent)

    tasks = [
        _generate_one(client, semaphore, focus, level, desc, distance, stroke, unit)
        for focus, level, desc, distance, stroke in selected
    ]

    results = await asyncio.gather(*tasks)

    workouts = [w for w in results if w is not None]
    logger.info(
        "Generated %d/%d workouts successfully (%d failures)",
        len(workouts),
        sample_size,
        sample_size - len(workouts),
    )
    return workouts
