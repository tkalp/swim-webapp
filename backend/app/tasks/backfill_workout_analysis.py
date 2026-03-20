"""
One-time backfill task: re-analyze existing workouts that have raw_description
but no json_description, using the V2 analyzer (LLM primary, regex fallback).
"""

import asyncio
from typing import Any, Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db import AsyncSessionLocal
from app.infrastructure.models import WorkoutTemplate
from app.services.workout_analyzer import WorkoutAnalyzer
from app.utils import logger


def backfill_single_workout(analysis: dict[str, Any]) -> Optional[dict[str, Any]]:
    """Transform a V2 analysis result into the sections+totals format used by SaveWorkoutModal.

    Returns None if analysis has no useful data (0 meters, no sections).
    """
    if not analysis.get("sections") or analysis.get("total_meters", 0) == 0:
        return None

    return {
        "sections": analysis["sections"],
        "totals": {
            "total_meters": analysis.get("total_meters", 0),
            "total_sets": analysis.get("total_sets", 0),
            "estimated_duration_minutes": analysis.get("estimated_duration_minutes", 0),
            "rest_time_minutes": analysis.get("rest_time_minutes", 0),
            "stroke_breakdown": analysis.get("stroke_breakdown", {}),
            "activity_breakdown": analysis.get("activity_breakdown", {}),
            "energy_zone_breakdown": analysis.get("energy_zone_breakdown", {}),
        },
    }


async def run_backfill(delay_seconds: float = 1.5) -> dict[str, int]:
    """Run the backfill: find workouts with NULL json_description, analyze, and update."""
    analyzer = WorkoutAnalyzer()
    summary: dict[str, int] = {"total": 0, "succeeded": 0, "failed": 0, "skipped": 0}

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(WorkoutTemplate.id, WorkoutTemplate.raw_description)
            .where(WorkoutTemplate.json_description.is_(None))
            .where(WorkoutTemplate.raw_description.isnot(None))
            .where(WorkoutTemplate.raw_description != "")
        )
        rows = result.all()

    summary["total"] = len(rows)
    logger.info(f"Backfill: found {len(rows)} workouts to process")

    for workout_id, raw_description in rows:
        try:
            analysis = await analyzer.analyze_workout_v2(raw_description)
            json_desc = backfill_single_workout(analysis)

            if json_desc is None:
                logger.info(f"Backfill: skipping workout {workout_id} — no useful data extracted")
                summary["skipped"] += 1
                continue

            async with AsyncSessionLocal() as db:
                await db.execute(
                    update(WorkoutTemplate)
                    .where(WorkoutTemplate.id == workout_id)
                    .values(
                        json_description=json_desc,
                        total_meters=analysis.get("total_meters", 0),
                        estimated_time_minutes=analysis.get("estimated_duration_minutes", 0),
                    )
                )
                await db.commit()

            parser = analysis.get("parser_used", "unknown")
            meters = analysis.get("total_meters", 0)
            logger.info(f"Backfill: processed workout {workout_id} — parser={parser}, meters={meters}")
            summary["succeeded"] += 1

        except Exception as e:
            logger.error(f"Backfill: failed workout {workout_id} — {e} (text length={len(raw_description)})")
            summary["failed"] += 1

        if delay_seconds > 0:
            await asyncio.sleep(delay_seconds)

    logger.info(f"Backfill complete: {summary}")
    return summary
