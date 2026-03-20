"""
API endpoints for real-time workout analysis
"""

import time
from collections import defaultdict
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.services.workout_analyzer import WorkoutAnalyzer
from app.middleware.auth import get_current_user_id
from app.utils import logger, log_error

router = APIRouter(prefix="/workout-analysis", tags=["workout-analysis"])

# Create singleton analyzer instance to avoid repeated initialization
_analyzer_instance = None

def get_analyzer() -> WorkoutAnalyzer:
    """Get or create singleton WorkoutAnalyzer instance"""
    global _analyzer_instance
    if _analyzer_instance is None:
        logger.info("Initializing WorkoutAnalyzer singleton instance")
        _analyzer_instance = WorkoutAnalyzer()
    return _analyzer_instance

class WorkoutAnalysisRequest(BaseModel):
    workout_text: str
    workout_id: str = "CUSTOM"

# ---------------------------------------------------------------------------
# Rate limiting (in-memory, per-user)
# ---------------------------------------------------------------------------

_rate_limits: dict[str, list[float]] = defaultdict(list)
_RATE_LIMIT = 10
_RATE_WINDOW = 60  # seconds


def _check_rate_limit(user_id: str) -> bool:
    """Return True if the user is within the rate limit, False otherwise."""
    now = time.time()
    _rate_limits[user_id] = [t for t in _rate_limits[user_id] if now - t < _RATE_WINDOW]
    if len(_rate_limits[user_id]) >= _RATE_LIMIT:
        return False
    _rate_limits[user_id].append(now)
    return True


@router.post("/analyze")
async def analyze_workout_text(
    request: WorkoutAnalysisRequest,
    user_id: str = Depends(get_current_user_id),
) -> Dict[str, Any]:
    """Analyze workout text using LLM parser (primary) with regex fallback.

    Returns structured sections, totals, breakdowns, and estimated duration.
    Rate-limited to 10 requests per minute per user.
    """
    if not _check_rate_limit(user_id):
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Max 10 analyses per minute.",
        )

    logger.info(
        f"Workout analysis requested | "
        f"user={user_id} | workout_id={request.workout_id} | "
        f"text_length={len(request.workout_text)}"
    )

    try:
        analyzer = get_analyzer()
        analysis = await analyzer.analyze_workout_v2(request.workout_text)

        logger.info(
            f"Workout analysis completed | "
            f"user={user_id} | parser={analysis.get('parser_used')} | "
            f"total_meters={analysis.get('total_meters', 0)}"
        )

        return {"success": True, "data": analysis}

    except ValueError as e:
        logger.warning(f"Invalid workout text from user {user_id}: {str(e)}")
        log_error(e, context="analyze_workout", user_id=user_id, error_type="validation")
        raise HTTPException(status_code=400, detail=f"Invalid workout format: {str(e)}")

    except Exception as e:
        logger.error(f"Failed to analyze workout for user {user_id}")
        log_error(e, context="analyze_workout", user_id=user_id, workout_id=request.workout_id)
        raise HTTPException(status_code=500, detail=f"Error analyzing workout: {str(e)}")

@router.post("/quick-stats")
async def get_quick_workout_stats(
    request: WorkoutAnalysisRequest,
    user_id: str = Depends(get_current_user_id),
) -> Dict[str, Any]:
    """Get quick stats (total meters + total sets) using the regex parser.

    This is a lightweight endpoint for form display — no LLM call.
    """
    logger.debug(f"Quick stats requested | workout_id={request.workout_id}")

    try:
        analyzer = get_analyzer()
        analysis = analyzer.analyze_workout(request.workout_text, request.workout_id)
        return {
            "success": True,
            "data": {
                "total_meters": analysis.get("total_meters", 0),
                "total_sets": analysis.get("total_sets", 0),
            },
        }
    except Exception as e:
        logger.error(f"Failed to generate quick stats for workout {request.workout_id}")
        log_error(e, context="quick_stats", workout_id=request.workout_id)
        return {
            "success": False,
            "error": str(e),
            "data": {"total_meters": 0, "total_sets": 0},
        }