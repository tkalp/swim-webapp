# backend/app/models/schemas.py
from pydantic import BaseModel
from typing import Literal, Optional


class ExampleWorkout(BaseModel):
    id: str
    title: str
    url: str
    relevance: float


class GenerateWorkoutRequest(BaseModel):
    prompt: str
    bestTimes: Optional[dict[str, str]] = None


class GenerateWorkoutResponse(BaseModel):
    workout: str
    examples: Optional[list[ExampleWorkout]] = None  # Kept for backwards compatibility but not returned


class GenerateWorkoutDescriptionRequest(BaseModel):
    """Request to generate a concise workout description"""
    workout_name: str
    raw_description: str
    total_meters: Optional[int] = None
    effort_level: Optional[int] = None


class GenerateWorkoutDescriptionResponse(BaseModel):
    """Response containing the generated description"""
    description: str
    cached: bool = False


class GenerateWorkoutTitleRequest(BaseModel):
    """Request to generate a concise workout title"""
    raw_description: str
    total_meters: Optional[int] = None
    effort_level: Optional[int] = None


class GenerateWorkoutTitleResponse(BaseModel):
    """Response containing the generated title"""
    title: str
    cached: bool = False


class HealthResponse(BaseModel):
    status: str
    chromadb: Optional[str] = None
    message: Optional[str] = None