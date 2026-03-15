"""FastAPI application entry point -- mounts routers and global exception handlers."""
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from dotenv import load_dotenv
import os

from app.routes import (
    ai_coach, workout_analysis, swimrankings, workout_tags,
    coach_connections, admin, training_sessions, coaches,
    workout_ratings, workout_sharing, auth, time_standards,
    practice_notes, permissions, notifications,
    squad_crud, calendar, attendance, schedules, workouts, workout_results,
    squad_analytics, squad_performance, squad_sync,
)
from app.routes.swimmers import router as swimmers_router
from app.middleware.logging_middleware import LoggingMiddleware
from app.domain.exceptions import ApplicationError
from app.utils import logger, log_error

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="Aquilus API",
    description="Backend API for Aquilus swimming app",
    version="1.0.0",
    redirect_slashes=False,
)

# Global exception handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors with detailed logging"""
    logger.warning(
        f"Validation error on {request.method} {request.url.path} | "
        f"errors={exc.errors()}"
    )
    log_error(exc, context="request_validation", path=str(request.url.path), method=request.method)
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": exc.errors(),
            "body": exc.body,
            "message": "Request validation failed. Please check your input data."
        }
    )


@app.exception_handler(ApplicationError)
async def application_error_handler(request: Request, exc: ApplicationError):
    """Handle domain exceptions with proper HTTP status codes."""
    logger.warning(
        f"Application error on {request.method} {request.url.path} | "
        f"error={type(exc).__name__}: {str(exc)} | status={exc.status_code}"
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.message,
            "type": type(exc).__name__,
        }
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all exception handler with detailed logging"""
    logger.error(
        f"Unhandled exception on {request.method} {request.url.path} | "
        f"error={type(exc).__name__}: {str(exc)}"
    )
    log_error(exc, context="global_exception", path=str(request.url.path), method=request.method)

    # Don't expose internal errors in production
    error_detail = str(exc) if os.getenv("DEBUG", "False").lower() == "true" else "Internal server error"

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": error_detail,
            "type": type(exc).__name__,
            "message": "An unexpected error occurred. Please try again or contact support if the issue persists."
        }
    )


# Add logging middleware FIRST (so it wraps everything)
app.add_middleware(LoggingMiddleware)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173"), "http://localhost:8000", "http://localhost"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(ai_coach.router)
app.include_router(workout_analysis.router)
app.include_router(swimrankings.router)
app.include_router(squad_analytics.router)
app.include_router(squad_performance.router)
app.include_router(squad_sync.router)
app.include_router(workout_tags.router)
app.include_router(coach_connections.router)
app.include_router(swimmers_router)
app.include_router(admin.router)
app.include_router(training_sessions.router)
app.include_router(coaches.router)
app.include_router(workout_ratings.router)
app.include_router(workout_sharing.router)
app.include_router(time_standards.router)
app.include_router(practice_notes.router)
app.include_router(permissions.router)
app.include_router(notifications.router)
app.include_router(squad_crud.router)
app.include_router(calendar.router)
app.include_router(attendance.router)
app.include_router(schedules.router)
app.include_router(workouts.router)
app.include_router(workout_results.router)


@app.get("/health")
async def health():
    """General health check"""
    logger.info("Health check requested")
    return {
        "status": "ok",
        "message": "Server is running"
    }


@app.on_event("startup")
async def startup_event():
    """Run on startup"""
    logger.info("=" * 60)
    logger.info("🚀 Starting Aquilus API...")
    logger.info(f"   Frontend: {os.getenv('FRONTEND_URL', 'http://localhost:5173')}")
    logger.info(f"   Logging: Enabled (console + file)")
    logger.info(f"   Debug Mode: {os.getenv('DEBUG', 'False')}")
    logger.info("=" * 60)