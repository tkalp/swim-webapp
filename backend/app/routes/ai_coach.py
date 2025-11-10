# backend/app/routes/ai_coach.py
from fastapi import APIRouter, HTTPException
from app.models.schemas import (
    GenerateWorkoutRequest,
    GenerateWorkoutResponse,
    HealthResponse,
)
from app.services.chroma_service import (
    generate_workout,
    check_chromadb,
)

router = APIRouter(prefix="/api/ai-coach", tags=["AI Coach"])


@router.post("/generate", response_model=GenerateWorkoutResponse)
async def generate_workout_endpoint(request: GenerateWorkoutRequest):
    """Generate a swimming workout using ChromaDB + LLM"""
    try:
        result = generate_workout(
            prompt=request.prompt,
            provider=request.provider,
            api_key=request.apiKey,
            num_examples=request.numExamples,
            best_times=request.bestTimes,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Check if ChromaDB is connected and ready"""
    is_healthy, message = check_chromadb()
    
    if is_healthy:
        return HealthResponse(
            status="ok",
            chromadb="connected"
        )
    else:
        return HealthResponse(
            status="error",
            chromadb="not connected",
            message=message
        )