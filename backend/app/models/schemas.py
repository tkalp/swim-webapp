"""Pydantic request/response models shared across multiple route modules."""
from pydantic import BaseModel
from typing import Optional


class GenerateWorkoutRequest(BaseModel):
    prompt: str
    bestTimes: Optional[dict[str, str]] = None


class GenerateWorkoutResponse(BaseModel):
    workout: str
    athlete_paces: Optional[str] = None


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
    analysis: Optional[dict] = None  # Workout analysis data (stroke breakdown, activity breakdown, etc.)


class GenerateWorkoutTitleResponse(BaseModel):
    """Response containing the generated title"""
    title: str
    cached: bool = False


class HealthResponse(BaseModel):
    status: str
    chromadb: Optional[str] = None
    message: Optional[str] = None