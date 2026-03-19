"""AI Coach endpoints -- workout generation, description, and title via Claude + ChromaDB."""
import asyncio
from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.schemas import (
    GenerateWorkoutRequest,
    GenerateWorkoutResponse,
    GenerateWorkoutDescriptionRequest,
    GenerateWorkoutDescriptionResponse,
    GenerateWorkoutTitleRequest,
    GenerateWorkoutTitleResponse,
    HealthResponse,
)
from app.services.ai_coach import (
    generate_workout,
    generate_workout_description,
    generate_workout_title,
    check_chromadb,
)
from app.infrastructure.db import get_db
from app.middleware.auth import get_current_user, get_current_user_id
from app.utils import logger, log_error

router = APIRouter(prefix="/ai-coach", tags=["AI Coach"])


@router.post("/generate", response_model=GenerateWorkoutResponse)
async def generate_workout_endpoint(
    request: GenerateWorkoutRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a swimming workout using two-stage retrieval + Anthropic Claude.

    Stage 1: ChromaDB metadata-filtered vector search (global pool).
    Stage 2: Coach style profile, recent workouts, coaching notes (PostgreSQL).

    Requires authentication. User must be logged in.
    """
    logger.info(
        f"Generating workout for user {user_id} | "
        f"has_best_times={bool(request.bestTimes)}"
    )

    try:
        from app.services.coach_style_service import get_coach_by_user_id

        coach = await get_coach_by_user_id(db, user_id)
        coach_id = str(coach.id) if coach else None

        result = await generate_workout(
            prompt=request.prompt,
            best_times=request.bestTimes,
            coach_id=coach_id,
            db=db,
        )

        logger.info(f"Successfully generated workout for user {user_id}")
        return GenerateWorkoutResponse(
            workout=result.get("workout", ""),
            athlete_paces=result.get("athlete_paces"),
        )

    except ValueError as e:
        # Client errors (bad input)
        logger.warning(f"Invalid workout request from user {user_id}: {str(e)}")
        log_error(e, context="generate_workout", user_id=user_id, error_type="validation")
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        # Server errors
        logger.error(f"Failed to generate workout for user {user_id}")
        log_error(e, context="generate_workout", user_id=user_id)
        raise HTTPException(status_code=500, detail=f"Failed to generate workout: {str(e)}")


@router.post("/generate-description", response_model=GenerateWorkoutDescriptionResponse)
async def generate_description_endpoint(
    request: GenerateWorkoutDescriptionRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Generate a concise 1-sentence description for a workout using Claude AI.
    
    This endpoint is designed for fast, real-time generation during workout creation/editing.
    
    Requires authentication. User must be logged in.
    """
    logger.info(
        f"Generating workout description for user {user_id} | "
        f"workout_name='{request.workout_name}'"
    )
    
    try:
        loop = asyncio.get_event_loop()
        description = await loop.run_in_executor(
            None,
            lambda: generate_workout_description(
                workout_name=request.workout_name,
                raw_description=request.raw_description,
                total_meters=request.total_meters,
                effort_level=request.effort_level,
            ),
        )

        logger.info(f"Successfully generated description for user {user_id}")
        return GenerateWorkoutDescriptionResponse(
            description=description,
            cached=False
        )
        
    except ValueError as e:
        # Client errors (bad input)
        logger.warning(f"Invalid description request from user {user_id}: {str(e)}")
        log_error(e, context="generate_description", user_id=user_id, error_type="validation")
        raise HTTPException(status_code=400, detail=str(e))
        
    except Exception as e:
        # Server errors
        logger.error(f"Failed to generate description for user {user_id}")
        log_error(e, context="generate_description", user_id=user_id)
        raise HTTPException(status_code=500, detail=f"Failed to generate description: {str(e)}")


@router.post("/generate-title", response_model=GenerateWorkoutTitleResponse)
async def generate_title_endpoint(
    request: GenerateWorkoutTitleRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Generate a concise, catchy title for a workout using Claude AI.
    
    This endpoint analyzes the full workout text and creates a memorable
    title (max 60 characters) that captures the workout's essence.
    
    Requires authentication. User must be logged in.
    """
    logger.info(
        f"Generating workout title for user {user_id} | "
        f"raw_description_length={len(request.raw_description)}"
    )
    
    try:
        loop = asyncio.get_event_loop()
        title = await loop.run_in_executor(
            None,
            lambda: generate_workout_title(
                raw_description=request.raw_description,
                total_meters=request.total_meters,
                effort_level=request.effort_level,
                analysis=request.analysis,
            ),
        )

        logger.info(f"Successfully generated title for user {user_id}")
        return GenerateWorkoutTitleResponse(
            title=title,
            cached=False
        )
        
    except ValueError as e:
        # Client errors (bad input)
        logger.warning(f"Invalid title request from user {user_id}: {str(e)}")
        log_error(e, context="generate_title", user_id=user_id, error_type="validation")
        raise HTTPException(status_code=400, detail=str(e))
        
    except Exception as e:
        # Server errors
        logger.error(f"Failed to generate title for user {user_id}")
        log_error(e, context="generate_title", user_id=user_id)
        raise HTTPException(status_code=500, detail=f"Failed to generate title: {str(e)}")


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Check if ChromaDB is connected and ready"""
    logger.debug("Health check requested for ChromaDB")
    
    try:
        is_healthy, message = check_chromadb()
        
        if is_healthy:
            logger.info("ChromaDB health check: OK")
            return HealthResponse(
                status="ok",
                chromadb="connected"
            )
        else:
            logger.warning(f"ChromaDB health check failed: {message}")
            return HealthResponse(
                status="error",
                chromadb="not connected",
                message=message
            )
    except Exception as e:
        logger.error("ChromaDB health check crashed")
        log_error(e, context="chromadb_health_check")
        return HealthResponse(
            status="error",
            chromadb="error",
            message=str(e)
        )