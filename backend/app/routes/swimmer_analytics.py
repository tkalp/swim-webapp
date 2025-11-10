"""
API endpoints for swimmer analytics and intelligent data aggregation
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List
import os
from supabase import create_client, Client

from app.services.swimmer_data_aggregator import SwimmerDataAggregator
from app.middleware.auth import get_current_user_id
from app.utils import logger, log_error, log_database_query

router = APIRouter(prefix="/api/swimmer-analytics", tags=["swimmer-analytics"])

def get_supabase_client() -> Client:
    """Get Supabase client with service role for analytics (bypasses RLS)"""
    supabase_url = os.getenv("SUPABASE_URL")
    # Use service role key for backend analytics to bypass RLS
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    
    if not supabase_url or not supabase_key:
        logger.error("Supabase configuration missing - cannot create client")
        raise HTTPException(status_code=500, detail="Supabase configuration missing")
    
    logger.debug("Creating Supabase client for analytics")
    return create_client(supabase_url, supabase_key)

def get_data_aggregator(supabase: Client = Depends(get_supabase_client)) -> SwimmerDataAggregator:
    """Get swimmer data aggregator instance"""
    logger.debug("Creating SwimmerDataAggregator instance")
    return SwimmerDataAggregator(supabase)

@router.get("/swimmer/{swimmer_id}/performance-timeline")
async def get_swimmer_performance_timeline(
    swimmer_id: str,
    days_back: int = 90,
    user_id: str = Depends(get_current_user_id),
    aggregator: SwimmerDataAggregator = Depends(get_data_aggregator)
) -> Dict[str, Any]:
    """
    Get comprehensive performance timeline analysis for a swimmer
    
    Requires authentication. User must be logged in.
    
    This is the intelligent analysis you've been waiting for - not just pretty charts,
    but actual insights into performance trends, plateaus, and actionable recommendations.
    """
    logger.info(
        f"Performance timeline requested | "
        f"user={user_id} | swimmer={swimmer_id} | days_back={days_back}"
    )
    
    try:
        timeline = aggregator.get_swimmer_performance_timeline(swimmer_id, days_back)
        
        if "error" in timeline:
            logger.warning(f"Performance timeline not found for swimmer {swimmer_id}")
            raise HTTPException(status_code=404, detail=timeline["error"])
        
        logger.info(
            f"Performance timeline generated | "
            f"swimmer={swimmer_id} | "
            f"strokes_analyzed={len(timeline.get('stroke_trends', {}))}"
        )
        
        return {
            "success": True,
            "data": timeline,
            "insights_summary": {
                "total_strokes_analyzed": len(timeline.get("stroke_trends", {})),
                "plateaus_detected": len(timeline.get("plateau_analysis", {})),
                "actionable_recommendations": len(timeline.get("recommendations", [])),
                "analysis_depth": "comprehensive" if timeline.get("training_response") else "basic"
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to analyze performance timeline for swimmer {swimmer_id}")
        log_error(e, context="performance_timeline", swimmer_id=swimmer_id, user_id=user_id)
        raise HTTPException(status_code=500, detail=f"Error analyzing performance timeline: {str(e)}")

@router.get("/workout/{workout_id}/effectiveness")
async def get_workout_effectiveness(
    workout_id: str,
    user_id: str = Depends(get_current_user_id),
    aggregator: SwimmerDataAggregator = Depends(get_data_aggregator)
) -> Dict[str, Any]:
    """
    Get intelligent effectiveness analysis for a specific workout
    
    Requires authentication. User must be logged in.
    
    This analyzes performance impact, coach satisfaction, attendance patterns,
    and technique development to give you a complete picture of workout effectiveness.
    """
    logger.info(f"Workout effectiveness requested | user={user_id} | workout={workout_id}")
    
    try:
        effectiveness = aggregator.get_workout_effectiveness_scores(workout_id)
        
        if "error" in effectiveness:
            logger.warning(f"Workout effectiveness data not found for workout {workout_id}")
            raise HTTPException(status_code=404, detail=effectiveness["error"])
        
        # Add intelligence summary
        score = effectiveness.get("effectiveness_score", 0)
        performance_impact = effectiveness.get("performance_impact", {})
        
        intelligence_summary = {
            "overall_grade": _get_effectiveness_grade(score),
            "primary_strength": _identify_primary_strength(effectiveness),
            "improvement_priority": _identify_improvement_priority(effectiveness),
            "data_confidence": _assess_data_confidence(effectiveness)
        }
        
        logger.info(
            f"Workout effectiveness analyzed | "
            f"workout={workout_id} | score={score:.2f} | "
            f"grade={intelligence_summary['overall_grade']}"
        )
        
        return {
            "success": True,
            "data": effectiveness,
            "intelligence_summary": intelligence_summary
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to analyze workout effectiveness for workout {workout_id}")
        log_error(e, context="workout_effectiveness", workout_id=workout_id, user_id=user_id)
        raise HTTPException(status_code=500, detail=f"Error analyzing workout effectiveness: {str(e)}")

@router.get("/swimmer/{swimmer_id}/coaching-feedback-patterns")
async def get_coaching_feedback_patterns(
    swimmer_id: str,
    user_id: str = Depends(get_current_user_id),
    aggregator: SwimmerDataAggregator = Depends(get_data_aggregator)
) -> Dict[str, Any]:
    """
    Get intelligent analysis of coaching feedback patterns
    
    Requires authentication. User must be logged in.
    
    This correlates qualitative coach feedback with quantitative performance outcomes
    to identify intervention effectiveness and predict future performance.
    """
    logger.info(f"Coaching feedback patterns requested | user={user_id} | swimmer={swimmer_id}")
    
    try:
        patterns = aggregator.get_coach_feedback_patterns(swimmer_id)
        
        if "error" in patterns:
            logger.warning(f"Coaching feedback patterns not found for swimmer {swimmer_id}")
            raise HTTPException(status_code=404, detail=patterns["error"])
        
        # Add predictive insights
        predictive_insights = {
            "trend_direction": _extract_trend_direction(patterns),
            "intervention_success_rate": _calculate_intervention_success(patterns),
            "recommended_focus": _extract_recommended_focus(patterns),
            "confidence_level": _assess_prediction_confidence(patterns)
        }
        
        logger.info(
            f"Coaching feedback patterns analyzed | "
            f"swimmer={swimmer_id} | "
            f"trend={predictive_insights['trend_direction']}"
        )
        
        return {
            "success": True,
            "data": patterns,
            "predictive_insights": predictive_insights
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to analyze coaching feedback patterns for swimmer {swimmer_id}")
        log_error(e, context="coaching_feedback_patterns", swimmer_id=swimmer_id, user_id=user_id)
        raise HTTPException(status_code=500, detail=f"Error analyzing feedback patterns: {str(e)}")

@router.get("/swimmer/{swimmer_id}/comprehensive-analysis")
async def get_comprehensive_swimmer_analysis(
    swimmer_id: str,
    days_back: int = 90,
    user_id: str = Depends(get_current_user_id),
    aggregator: SwimmerDataAggregator = Depends(get_data_aggregator)
) -> Dict[str, Any]:
    """
    Get comprehensive intelligent analysis combining all data sources
    
    Requires authentication. User must be logged in.
    
    This is the full intelligence suite - performance trends, coaching feedback correlation,
    and actionable recommendations for breakthrough performance.
    """
    try:
        # Get all analysis components
        timeline = aggregator.get_swimmer_performance_timeline(swimmer_id, days_back)
        feedback_patterns = aggregator.get_coach_feedback_patterns(swimmer_id)
        
        # Combine insights for meta-analysis
        meta_insights = _generate_meta_insights(timeline, feedback_patterns)
        
        return {
            "success": True,
            "swimmer_id": swimmer_id,
            "analysis_period_days": days_back,
            "performance_timeline": timeline,
            "feedback_patterns": feedback_patterns,
            "meta_insights": meta_insights,
            "breakthrough_recommendations": _generate_breakthrough_recommendations(timeline, feedback_patterns)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error performing comprehensive analysis: {str(e)}")

# Helper functions for intelligent analysis summaries
def _get_effectiveness_grade(score: float) -> str:
    """Convert effectiveness score to letter grade"""
    if score >= 90:
        return "A"
    elif score >= 80:
        return "B"
    elif score >= 70:
        return "C"
    elif score >= 60:
        return "D"
    else:
        return "F"

def _identify_primary_strength(effectiveness: Dict) -> str:
    """Identify the primary strength of the workout"""
    scores = {}
    
    if effectiveness.get("performance_impact", {}).get("avg_improvement_percent", 0) > 2:
        scores["performance"] = effectiveness["performance_impact"]["avg_improvement_percent"]
    
    if effectiveness.get("coach_satisfaction", {}).get("avg_overall_rating", 0) >= 4:
        scores["satisfaction"] = effectiveness["coach_satisfaction"]["avg_overall_rating"]
    
    if effectiveness.get("attendance_impact", {}).get("vs_other_workouts", 0) > 0:
        scores["attendance"] = effectiveness["attendance_impact"]["vs_other_workouts"]
    
    return max(scores.keys(), key=lambda k: scores[k]) if scores else "needs_improvement"

def _identify_improvement_priority(effectiveness: Dict) -> str:
    """Identify what needs the most improvement"""
    if effectiveness.get("performance_impact", {}).get("positive_impact_rate", 1) < 0.6:
        return "performance_impact"
    elif effectiveness.get("coach_satisfaction", {}).get("avg_overall_rating", 5) < 3.5:
        return "coach_satisfaction"
    elif effectiveness.get("attendance_impact", {}).get("vs_other_workouts", 0) < -2:
        return "attendance_retention"
    else:
        return "optimization"

def _assess_data_confidence(effectiveness: Dict) -> str:
    """Assess confidence level in the analysis"""
    sample_sizes = [
        effectiveness.get("performance_impact", {}).get("sample_size", 0),
        effectiveness.get("coach_satisfaction", {}).get("sample_size", 0),
        effectiveness.get("attendance_impact", {}).get("sample_size", 0)
    ]
    
    avg_sample_size = sum(sample_sizes) / len(sample_sizes) if sample_sizes else 0
    
    if avg_sample_size >= 10:
        return "high"
    elif avg_sample_size >= 5:
        return "moderate"
    else:
        return "low"

def _extract_trend_direction(patterns: Dict) -> str:
    """Extract overall trend direction from feedback patterns"""
    rating_trends = patterns.get("rating_trends", {})
    overall_trend = rating_trends.get("overall_trend", {})
    return overall_trend.get("direction", "unknown")

def _calculate_intervention_success(patterns: Dict) -> float:
    """Calculate intervention success rate"""
    intervention_data = patterns.get("intervention_effectiveness", {})
    return intervention_data.get("success_rate", 0.0)

def _extract_recommended_focus(patterns: Dict) -> str:
    """Extract recommended focus area"""
    predictions = patterns.get("predictions", {})
    return predictions.get("recommended_focus", "balanced_training")

def _assess_prediction_confidence(patterns: Dict) -> str:
    """Assess confidence in predictions"""
    correlation_data = patterns.get("feedback_performance_correlation", {})
    predictive_value = correlation_data.get("predictive_value", "low")
    return predictive_value

def _generate_meta_insights(timeline: Dict, feedback_patterns: Dict) -> Dict:
    """Generate meta-insights by combining multiple analysis streams"""
    insights = {}
    
    # Correlation between performance trends and feedback trends
    perf_plateaus = len(timeline.get("plateau_analysis", {}))
    feedback_trend = feedback_patterns.get("rating_trends", {}).get("overall_trend", {}).get("direction", "stable")
    
    if perf_plateaus > 0 and feedback_trend == "declining":
        insights["performance_feedback_correlation"] = "negative_spiral"
    elif perf_plateaus == 0 and feedback_trend == "improving":
        insights["performance_feedback_correlation"] = "positive_momentum"
    else:
        insights["performance_feedback_correlation"] = "mixed_signals"
    
    # Training effectiveness assessment
    stroke_trends = timeline.get("stroke_trends", {})
    declining_strokes = [stroke for stroke, data in stroke_trends.items() if data.get("trend_direction") == "declining"]
    
    insights["training_effectiveness"] = {
        "declining_stroke_count": len(declining_strokes),
        "intervention_needed": len(declining_strokes) > 1,
        "focus_recommendation": declining_strokes[0] if declining_strokes else "maintain_current_training"
    }
    
    return insights

def _generate_breakthrough_recommendations(timeline: Dict, feedback_patterns: Dict) -> List[str]:
    """Generate breakthrough recommendations based on combined analysis"""
    recommendations = []
    
    # Performance-based recommendations
    plateaus = timeline.get("plateau_analysis", {})
    if plateaus:
        recommendations.append("BREAKTHROUGH NEEDED: Multiple performance plateaus detected - implement periodization")
    
    # Feedback-based recommendations  
    intervention_success = feedback_patterns.get("intervention_effectiveness", {}).get("success_rate", 0)
    if intervention_success < 0.5:
        recommendations.append("COACHING STRATEGY: Current interventions showing low success rate - review approach")
    
    # Meta-analysis recommendations
    correlation = feedback_patterns.get("feedback_performance_correlation", {}).get("correlation_strength", "weak")
    if correlation in ["weak", "very_weak"]:
        recommendations.append("DATA INTELLIGENCE: Weak feedback-performance correlation - enhance measurement precision")
    
    if not recommendations:
        recommendations.append("OPTIMIZATION: Performance stable - focus on marginal gains and consistency")
    
    return recommendations