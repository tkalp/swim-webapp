"""
API endpoints for real-time workout analysis
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any

from app.services.workout_analyzer import WorkoutAnalyzer

router = APIRouter(prefix="/api/workout-analysis", tags=["workout-analysis"])

# Create singleton analyzer instance to avoid repeated initialization
_analyzer_instance = None

def get_analyzer() -> WorkoutAnalyzer:
    """Get or create singleton WorkoutAnalyzer instance"""
    global _analyzer_instance
    if _analyzer_instance is None:
        _analyzer_instance = WorkoutAnalyzer()
    return _analyzer_instance

class WorkoutAnalysisRequest(BaseModel):
    workout_text: str
    workout_id: str = "CUSTOM"

@router.post("/analyze")
async def analyze_workout_text(request: WorkoutAnalysisRequest) -> Dict[str, Any]:
    """
    Real-time analysis of workout text as user types
    
    Parses the workout description and returns:
    - Total distance and time estimates
    - Stroke breakdown and percentages
    - Activity breakdown (swim/kick/pull/drill)
    - Energy zone distribution
    - Set details and classification
    """
    try:
        analyzer = get_analyzer()  # Use singleton instance
        analysis = analyzer.analyze_workout(request.workout_text, request.workout_id)
        
        # Add classification
        if 'error' not in analysis:
            classification = analyzer.get_workout_classification(analysis)
            analysis['classification'] = classification
        
        return {
            "success": True,
            "data": analysis
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error analyzing workout: {str(e)}")

@router.post("/quick-stats")
async def get_quick_workout_stats(request: WorkoutAnalysisRequest) -> Dict[str, Any]:
    """
    Get quick stats for display in forms (lighter analysis)
    """
    try:
        analyzer = get_analyzer()  # Use singleton instance
        analysis = analyzer.analyze_workout(request.workout_text, request.workout_id)
        
        # Return only the essential stats for form display
        return {
            "success": True,
            "data": {
                "total_meters": analysis.get('total_meters', 0),
                "estimated_duration_minutes": analysis.get('estimated_duration_minutes', 0),
                "swim_time_minutes": analysis.get('swim_time_minutes', 0),
                "rest_time_minutes": analysis.get('rest_time_minutes', 0),
                "total_sets": analysis.get('total_sets', 0),
                "classification": analyzer.get_workout_classification(analysis) if 'error' not in analysis else "Invalid Workout"
            }
        }
        
    except Exception as e:
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