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
    examples: list[ExampleWorkout]


class HealthResponse(BaseModel):
    status: str
    chromadb: Optional[str] = None
    message: Optional[str] = None