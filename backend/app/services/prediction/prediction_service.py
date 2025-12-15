"""Swimming race prediction service - Refactored modular version.

This service provides comprehensive prediction capabilities:
1. Head-to-head race outcome predictions
2. Individual swimmer improvement predictions

The prediction system uses:
- Statistical analysis of historical performance trends
- Physiological constraint modeling
- Training context integration
- Multi-factor weighted predictions
"""
from typing import Dict, Optional, Any, List

from .models import (
    RacePrediction,
    PredictionAnalysis,
    WorkoutContext,
    ImprovementPrediction
)
from .race_prediction import RacePredictorEngine, ComparisonAnalyzer
from .improvement_prediction import ImprovementPredictorEngine


class PredictionService:
    """Main service interface for swimming predictions.
    
    This service delegates to specialized prediction engines while maintaining
    backward compatibility with the original API.
    """
    
    # Expose weight factors for transparency
    WEIGHT_CURRENT_DIFFERENTIAL = RacePredictorEngine.WEIGHT_CURRENT_DIFFERENTIAL
    WEIGHT_IMPROVEMENT_RATE = RacePredictorEngine.WEIGHT_IMPROVEMENT_RATE
    WEIGHT_CONSISTENCY = RacePredictorEngine.WEIGHT_CONSISTENCY
    WEIGHT_RECENT_FORM = RacePredictorEngine.WEIGHT_RECENT_FORM
    
    @staticmethod
    def predict_race_outcome(
        event: str,
        swimmer_a_data: Dict[str, Any],
        swimmer_b_data: Dict[str, Any],
        trend_comparison: Optional[Dict[str, Any]] = None
    ) -> RacePrediction:
        """Predict the outcome of a head-to-head race.
        
        Uses multi-factor weighted prediction:
        - 50% current time differential
        - 30% improvement rate trends
        - 15% performance consistency
        - 5% recent form
        
        Args:
            event: Event name (e.g., "100m Freestyle SCM")
            swimmer_a_data: Dict with 'time', 'age', 'all_times', 'recent_times'
            swimmer_b_data: Dict with 'time', 'age', 'all_times', 'recent_times'
            trend_comparison: Optional trend analysis data
            
        Returns:
            RacePrediction with probabilities, confidence, and factor breakdown
        
        Example:
            >>> prediction = PredictionService.predict_race_outcome(
            ...     event="100m Freestyle SCM",
            ...     swimmer_a_data={'time': 56.2, 'all_times': [57.1, 56.8, 56.2]},
            ...     swimmer_b_data={'time': 57.5, 'all_times': [58.0, 57.8, 57.5]}
            ... )
            >>> print(f"Winner probability: {prediction.swimmer_a_probability}%")
        """
        return RacePredictorEngine.predict_race(
            event=event,
            swimmer_a_data=swimmer_a_data,
            swimmer_b_data=swimmer_b_data,
            trend_comparison=trend_comparison
        )
    
    @staticmethod
    def predict_all_events(
        head_to_head_events: List[Dict[str, Any]],
        trend_analysis: Optional[Dict[str, Any]] = None,
        swimmer_a_all_results: Optional[List[Dict[str, Any]]] = None,
        swimmer_b_all_results: Optional[List[Dict[str, Any]]] = None
    ) -> PredictionAnalysis:
        """Predict outcomes for all events in a head-to-head comparison.
        
        Analyzes multiple events to determine overall favorite and average confidence.
        Automatically supplements limited data with related event times.
        
        Args:
            head_to_head_events: List of event comparison data
            trend_analysis: Optional overall trend analysis
            swimmer_a_all_results: All results for swimmer A
            swimmer_b_all_results: All results for swimmer B
            
        Returns:
            PredictionAnalysis with predictions for all events and overall summary
        
        Example:
            >>> analysis = PredictionService.predict_all_events(
            ...     head_to_head_events=events,
            ...     swimmer_a_all_results=swimmer_a_history,
            ...     swimmer_b_all_results=swimmer_b_history
            ... )
            >>> print(f"Overall favorite: {analysis.overall_favorite}")
        """
        return ComparisonAnalyzer.predict_all_events(
            head_to_head_events=head_to_head_events,
            trend_analysis=trend_analysis,
            swimmer_a_all_results=swimmer_a_all_results,
            swimmer_b_all_results=swimmer_b_all_results
        )
    
    @staticmethod
    def predict_improvement(
        event: str,
        current_best: float,
        all_times: List[float],
        attempts_until_target: int = 3,
        attendance_rate: Optional[float] = None,
        squad_improvement_rate: Optional[float] = None,
        recent_workouts: Optional[List[WorkoutContext]] = None,
        days_since_last_result: Optional[int] = None,
        swimmer_age: Optional[int] = None
    ) -> ImprovementPrediction:
        """Predict improvement for a single swimmer in a specific event.
        
        Comprehensive prediction using:
        - Historical performance trends
        - Physiological constraints (elite benchmarks, diminishing returns)
        - Training context (attendance, workout alignment)
        - Age-group specific adjustments
        - Squad performance comparison
        
        Args:
            event: Event name (e.g., "100m Free Swim SCM")
            current_best: Current best time in seconds
            all_times: All historical times in chronological order (oldest first)
            attempts_until_target: Number of future attempts to predict (default 3)
            attendance_rate: Optional attendance percentage (0-100) for last 30 days
            squad_improvement_rate: Optional squad average improvement rate
            recent_workouts: Optional list of recent workout contexts (last 30 days)
            days_since_last_result: Optional days since last competitive result
            swimmer_age: Optional swimmer age in years
            
        Returns:
            ImprovementPrediction with predicted time, confidence, and factor analysis
        
        Example:
            >>> prediction = PredictionService.predict_improvement(
            ...     event="100m Freestyle SCM",
            ...     current_best=56.2,
            ...     all_times=[57.8, 57.1, 56.8, 56.2],
            ...     attendance_rate=85.0,
            ...     swimmer_age=15
            ... )
            >>> print(f"Predicted time: {prediction.predicted_time}s")
            >>> print(f"Expected improvement: {prediction.improvement_expected}s")
        """
        return ImprovementPredictorEngine.predict_improvement(
            event=event,
            current_best=current_best,
            all_times=all_times,
            attempts_until_target=attempts_until_target,
            attendance_rate=attendance_rate,
            squad_improvement_rate=squad_improvement_rate,
            recent_workouts=recent_workouts,
            days_since_last_result=days_since_last_result,
            swimmer_age=swimmer_age
        )


# Backward compatibility aliases
PredictionService.predict_race_outcome.__name__ = 'predict_race_outcome'
PredictionService.predict_all_events.__name__ = 'predict_all_events'
PredictionService.predict_improvement.__name__ = 'predict_improvement'
