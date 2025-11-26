"""
API endpoints for real-time workout analysis
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any

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

@router.post("/analyze")
async def analyze_workout_text(
    request: WorkoutAnalysisRequest,
    user_id: str = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """
    Real-time analysis of workout text as user types
    
    Requires authentication. User must be logged in.
    
    Parses the workout description and returns:
    - Total distance and time estimates
    - Stroke breakdown and percentages
    - Activity breakdown (swim/kick/pull/drill)
    - Energy zone distribution
    - Set details and classification
    """
    logger.info(
        f"Workout analysis requested | "
        f"user={user_id} | workout_id={request.workout_id} | "
        f"text_length={len(request.workout_text)}"
    )
    
    try:
        analyzer = get_analyzer()  # Use singleton instance
        analysis = analyzer.analyze_workout_enhanced(request.workout_text, request.workout_id)
        
        # Add classification
        if 'error' not in analysis:
            classification = analyzer.get_workout_classification(analysis)
            analysis['classification'] = classification
            
            logger.info(
                f"Workout analysis completed | "
                f"user={user_id} | workout_id={request.workout_id} | "
                f"total_meters={analysis.get('total_meters', 0)} | "
                f"classification={classification}"
            )
        else:
            logger.warning(
                f"Workout analysis returned error | "
                f"user={user_id} | error={analysis.get('error')}"
            )
        
        return {
            "success": True,
            "data": analysis
        }
        
    except ValueError as e:
        # Client errors (bad input)
        logger.warning(f"Invalid workout text from user {user_id}: {str(e)}")
        log_error(e, context="analyze_workout", user_id=user_id, error_type="validation")
        raise HTTPException(status_code=400, detail=f"Invalid workout format: {str(e)}")
        
    except Exception as e:
        logger.error(f"Failed to analyze workout for user {user_id}")
        log_error(e, context="analyze_workout", user_id=user_id, workout_id=request.workout_id)
        raise HTTPException(status_code=500, detail=f"Error analyzing workout: {str(e)}")

@router.post("/quick-stats")
async def get_quick_workout_stats(request: WorkoutAnalysisRequest) -> Dict[str, Any]:
    """
    Get quick stats for display in forms (lighter analysis)
    """
    logger.debug(f"Quick stats requested | workout_id={request.workout_id}")
    
    try:
        analyzer = get_analyzer()  # Use singleton instance
        analysis = analyzer.analyze_workout(request.workout_text, request.workout_id)
        
        # Return only the essential stats for form display
        quick_stats = {
            "total_meters": analysis.get('total_meters', 0),
            "estimated_duration_minutes": analysis.get('estimated_duration_minutes', 0),
            "swim_time_minutes": analysis.get('swim_time_minutes', 0),
            "rest_time_minutes": analysis.get('rest_time_minutes', 0),
            "total_sets": analysis.get('total_sets', 0),
            "classification": analyzer.get_workout_classification(analysis) if 'error' not in analysis else "Invalid Workout"
        }
        
        logger.debug(
            f"Quick stats generated | "
            f"total_meters={quick_stats['total_meters']} | "
            f"classification={quick_stats['classification']}"
        )
        
        return {
            "success": True,
            "data": quick_stats
        }
        
    except Exception as e:
        logger.error(f"Failed to generate quick stats for workout {request.workout_id}")
        log_error(e, context="quick_stats", workout_id=request.workout_id)
        return {
            "success": False,
            "error": str(e),
            "data": {
                "total_meters": 0,
                "estimated_duration_minutes": 0,
                "swim_time_minutes": 0,
                "rest_time_minutes": 0,
                "total_sets": 0,
                "classification": "Parse Error"
            }
        }