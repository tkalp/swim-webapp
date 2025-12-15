"""Data models for swimming prediction system."""
from typing import Dict, Optional, Any, List
from dataclasses import dataclass


@dataclass
class RacePrediction:
    """Prediction for a specific event matchup between two swimmers.
    
    Attributes:
        event: Event name (e.g., "100m Freestyle SCM")
        swimmer_a_probability: Probability (0-100) that swimmer A wins
        swimmer_b_probability: Probability (0-100) that swimmer B wins
        confidence_level: Prediction confidence ("high", "medium", "low")
        predicted_differential: Expected time difference in seconds
        predicted_time_a: Predicted time for swimmer A in seconds
        predicted_time_b: Predicted time for swimmer B in seconds
        factors: Breakdown of prediction factors and their contributions
    """
    event: str
    swimmer_a_probability: float
    swimmer_b_probability: float
    confidence_level: str
    predicted_differential: float
    predicted_time_a: Optional[float]
    predicted_time_b: Optional[float]
    factors: Dict[str, float]


@dataclass
class PredictionAnalysis:
    """Complete prediction analysis for swimmer comparison across multiple events.
    
    Attributes:
        predictions: List of individual event predictions
        overall_favorite: Overall winner prediction ("swimmer_a", "swimmer_b", "even")
        average_confidence: Average confidence across all predictions (1-3 scale)
    """
    predictions: List[RacePrediction]
    overall_favorite: str
    average_confidence: float


@dataclass
class WorkoutContext:
    """Context data for a training workout session.
    
    Attributes:
        total_meters: Total distance covered in workout
        effort_level: Intensity rating on 1-10 scale
        session_date: Date of workout session (ISO format)
        workout_type: Type classification ('sprint', 'endurance', 'technique', 'mixed')
    """
    total_meters: float
    effort_level: Optional[int]
    session_date: str
    workout_type: str


@dataclass
class ImprovementPrediction:
    """Prediction for a single swimmer's improvement in a specific event.
    
    Attributes:
        event: Event name
        current_best: Current personal best time in seconds
        predicted_time: Predicted future time in seconds
        confidence_level: Prediction confidence ("high", "medium", "low")
        improvement_expected: Expected improvement in seconds (negative = faster)
        factors: Dictionary of prediction factors and analysis data
    """
    event: str
    current_best: float
    predicted_time: Optional[float]
    confidence_level: str
    improvement_expected: float
    factors: Dict[str, Any]
