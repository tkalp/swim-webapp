# backend/app/routes/ai_coach.py
from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
from app.models.schemas import (
    GenerateWorkoutRequest,
    GenerateWorkoutResponse,
    HealthResponse,
)
from app.services.chroma_service import (
    generate_workout,
    check_chromadb,
)
from app.middleware.auth import get_current_user, get_current_user_id
from app.utils import logger, log_error

router = APIRouter(prefix="/ai-coach", tags=["AI Coach"])


@router.post("/generate", response_model=GenerateWorkoutResponse)
async def generate_workout_endpoint(
    request: GenerateWorkoutRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Generate a swimming workout using ChromaDB + Anthropic Claude
    
    Requires authentication. User must be logged in.
    """
    logger.info(
        f"Generating workout for user {user_id} | "
        f"has_best_times={bool(request.bestTimes)}"
    )
    
    try:
        result = generate_workout(
            prompt=request.prompt,
            best_times=request.bestTimes,
        )
        
        logger.info(f"Successfully generated workout for user {user_id}")
        return result
        
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