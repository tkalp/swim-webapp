"""Modular swimming race prediction system.

This package provides comprehensive prediction capabilities for swimming performance,
including head-to-head race outcome predictions and individual improvement forecasting.
"""

from .models import (
    RacePrediction,
    PredictionAnalysis,
    WorkoutContext,
    ImprovementPrediction
)

from .prediction_service import PredictionService
from .statistical_analysis import ImprovementAnalyzer
from .achievement_validator import AchievementValidator
from .gap_analyzer import GapAnalyzer

__all__ = [
    'RacePrediction',
    'PredictionAnalysis',
    'WorkoutContext',
    'ImprovementPrediction',
    'PredictionService',
    'ImprovementAnalyzer',
    'AchievementValidator',
    'GapAnalyzer'
]
