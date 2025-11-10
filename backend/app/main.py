# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

from app.routes import ai_coach, swimmer_analytics, workout_analysis

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="Aquilus API",
    description="Backend API for Aquilus swimming app",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(ai_coach.router)
app.include_router(swimmer_analytics.router)
app.include_router(workout_analysis.router)


@app.get("/health")
async def health():
    """General health check"""
    return {
        "status": "ok",
        "message": "Server is running"
    }


@app.on_event("startup")
async def startup_event():
    """Run on startup"""
    print("🚀 Starting Aquilus API...")
    print(f"   Frontend: {os.getenv('FRONTEND_URL', 'http://localhost:5173')}")