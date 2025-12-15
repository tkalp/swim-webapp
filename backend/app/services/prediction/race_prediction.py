"""Head-to-head race prediction engine."""
from typing import Dict, Any, List, Optional
import statistics
from .models import RacePrediction, PredictionAnalysis
from .time_utils import DifferentialCalculator
from .statistical_analysis import (
    ImprovementAnalyzer,
    TrendPredictor,
    ConfidenceCalculator
)
from .event_relationships import EventDataExtractor, RelatedDataSupplementer


class RacePredictorEngine:
    """Engine for predicting head-to-head race outcomes."""
    
    # Prediction weight factors
    WEIGHT_CURRENT_DIFFERENTIAL = 0.50  # 50% weight on current time difference
    WEIGHT_IMPROVEMENT_RATE = 0.30     # 30% weight on improvement per attempt
    WEIGHT_CONSISTENCY = 0.15           # 15% weight on consistency
    WEIGHT_RECENT_FORM = 0.05          # 5% weight on recent performances
    
    @classmethod
    def predict_race(
        cls,
        event: str,
        swimmer_a_data: Dict[str, Any],
        swimmer_b_data: Dict[str, Any],
        trend_comparison: Optional[Dict[str, Any]] = None
    ) -> RacePrediction:
        """Predict the outcome of a head-to-head race.
        
        Args:
            event: Event name
            swimmer_a_data: Dict with 'time', 'age', 'all_times', 'recent_times'
            swimmer_b_data: Dict with 'time', 'age', 'all_times', 'recent_times'
            trend_comparison: Optional trend analysis data
            
        Returns:
            RacePrediction with probabilities and confidence
        """
        factors = {}
        
        # Extract times
        time_a = swimmer_a_data.get('time')
        time_b = swimmer_b_data.get('time')
        swimmer_a_times = swimmer_a_data.get('all_times', [])
        swimmer_b_times = swimmer_b_data.get('all_times', [])
        recent_a = swimmer_a_data.get('recent_times', [])
        recent_b = swimmer_b_data.get('recent_times', [])
        
        # Factor 1: Current time differential (50%)
        factors['current_differential'] = cls._calculate_differential_factor(
            time_a, time_b
        )
        
        # Factor 2: Improvement rate per attempt (30%)
        factors['improvement_rate'] = cls._calculate_improvement_factor(
            swimmer_a_times, swimmer_b_times
        )
        
        # Factor 3: Consistency (15%)
        factors['consistency'] = cls._calculate_consistency_factor(
            swimmer_a_times, swimmer_b_times
        )
        
        # Factor 4: Recent form (5%)
        factors['recent_form'] = cls._calculate_recent_form_factor(
            recent_a, recent_b
        )
        
        # Calculate total probability
        total_score = sum(factors.values())
        swimmer_a_probability = total_score * 100
        swimmer_b_probability = (1 - total_score) * 100
        
        # Determine confidence level
        confidence_level = ConfidenceCalculator.calculate_confidence(
            probability_margin=abs(swimmer_a_probability - 50),
            has_trend_data=trend_comparison is not None,
            has_recent_form=len(recent_a) + len(recent_b) >= 4
        )
        
        # Predict differential
        predicted_differential = cls._predict_differential(
            time_a, time_b,
            swimmer_a_times, swimmer_b_times
        )
        
        # Predict future times
        predicted_time_a = cls._predict_swimmer_time(time_a, swimmer_a_times)
        predicted_time_b = cls._predict_swimmer_time(time_b, swimmer_b_times)
        
        return RacePrediction(
            event=event,
            swimmer_a_probability=round(swimmer_a_probability, 1),
            swimmer_b_probability=round(swimmer_b_probability, 1),
            confidence_level=confidence_level,
            predicted_differential=round(predicted_differential, 2),
            predicted_time_a=round(predicted_time_a, 2) if predicted_time_a else None,
            predicted_time_b=round(predicted_time_b, 2) if predicted_time_b else None,
            factors={k: round(v, 3) for k, v in factors.items()}
        )
    
    @classmethod
    def _calculate_differential_factor(
        cls,
        time_a: Optional[float],
        time_b: Optional[float]
    ) -> float:
        """Calculate current differential factor (50% weight)."""
        if time_a and time_b:
            differential = time_b - time_a  # Positive = A is faster
            score = DifferentialCalculator.differential_to_score(differential)
            return score * cls.WEIGHT_CURRENT_DIFFERENTIAL
        else:
            return 0.5 * cls.WEIGHT_CURRENT_DIFFERENTIAL
    
    @classmethod
    def _calculate_improvement_factor(
        cls,
        times_a: List[float],
        times_b: List[float]
    ) -> float:
        """Calculate improvement rate factor (30% weight)."""
        if times_a and len(times_a) >= 2 and times_b and len(times_b) >= 2:
            rate_a = ImprovementAnalyzer.calculate_improvement_per_attempt(times_a)
            rate_b = ImprovementAnalyzer.calculate_improvement_per_attempt(times_b)
            
            # More negative = faster improvement
            # Scale by factor to make comparable to time differential
            rate_diff = (rate_b - rate_a) * 5
            score = DifferentialCalculator.differential_to_score(rate_diff)
            return score * cls.WEIGHT_IMPROVEMENT_RATE
        else:
            return 0.5 * cls.WEIGHT_IMPROVEMENT_RATE
    
    @classmethod
    def _calculate_consistency_factor(
        cls,
        times_a: List[float],
        times_b: List[float]
    ) -> float:
        """Calculate consistency factor (15% weight)."""
        if times_a and len(times_a) >= 3 and times_b and len(times_b) >= 3:
            recent_a = times_a[-5:]
            recent_b = times_b[-5:]
            
            std_a = ImprovementAnalyzer.calculate_consistency(recent_a)
            std_b = ImprovementAnalyzer.calculate_consistency(recent_b)
            
            # Lower std = more consistent = better
            consistency_diff = (std_b - std_a) * 0.5
            score = DifferentialCalculator.differential_to_score(consistency_diff)
            return score * cls.WEIGHT_CONSISTENCY
        else:
            return 0.5 * cls.WEIGHT_CONSISTENCY
    
    @classmethod
    def _calculate_recent_form_factor(
        cls,
        recent_a: List[float],
        recent_b: List[float]
    ) -> float:
        """Calculate recent form factor (5% weight)."""
        if recent_a and recent_b:
            avg_recent_a = statistics.mean(recent_a)
            avg_recent_b = statistics.mean(recent_b)
            recent_diff = avg_recent_b - avg_recent_a
            score = DifferentialCalculator.differential_to_score(recent_diff)
            return score * cls.WEIGHT_RECENT_FORM
        else:
            return 0.5 * cls.WEIGHT_RECENT_FORM
    
    @staticmethod
    def _predict_differential(
        time_a: Optional[float],
        time_b: Optional[float],
        times_a: List[float],
        times_b: List[float]
    ) -> float:
        """Predict time differential at future race."""
        if not time_a or not time_b:
            return 0.0
        
        current_diff = abs(time_b - time_a)
        
        # Apply improvement rate adjustments
        if times_a and len(times_a) >= 2 and times_b and len(times_b) >= 2:
            rate_a = ImprovementAnalyzer.calculate_improvement_per_attempt(times_a)
            rate_b = ImprovementAnalyzer.calculate_improvement_per_attempt(times_b)
            rate_diff = abs(rate_b - rate_a)
            
            # Assume 3 attempts before race
            trend_adjustment = rate_diff * 3
            predicted_differential = max(0, current_diff - trend_adjustment)
        else:
            predicted_differential = current_diff
        
        return predicted_differential
    
    @staticmethod
    def _predict_swimmer_time(
        current_time: Optional[float],
        all_times: List[float]
    ) -> Optional[float]:
        """Predict future time for a swimmer."""
        if not current_time:
            return None
        
        if all_times and len(all_times) >= 2:
            return TrendPredictor.predict_future_time(
                current_best=current_time,
                all_times=all_times,
                attempts_until_race=3
            )
        else:
            return current_time


class ComparisonAnalyzer:
    """Analyze complete head-to-head comparison across multiple events."""
    
    @staticmethod
    def predict_all_events(
        head_to_head_events: List[Dict[str, Any]],
        trend_analysis: Optional[Dict[str, Any]] = None,
        swimmer_a_all_results: Optional[List[Dict[str, Any]]] = None,
        swimmer_b_all_results: Optional[List[Dict[str, Any]]] = None
    ) -> PredictionAnalysis:
        """Predict outcomes for all events in a head-to-head comparison.
        
        Args:
            head_to_head_events: List of event comparison data
            trend_analysis: Optional overall trend analysis
            swimmer_a_all_results: All results for swimmer A
            swimmer_b_all_results: All results for swimmer B
            
        Returns:
            PredictionAnalysis with predictions for all events
        """
        predictions = []
        
        for event_data in head_to_head_events:
            swimmer_a_info = event_data.get('swimmer_a')
            swimmer_b_info = event_data.get('swimmer_b')
            
            if not swimmer_a_info or not swimmer_b_info:
                continue
            
            # Get event-specific trend
            event_trend = ComparisonAnalyzer._get_event_trend(
                event_data, trend_analysis
            )
            
            # Collect historical times
            event_key = event_data.get('event_key', '')
            swimmer_a_all_times = ComparisonAnalyzer._collect_event_times(
                swimmer_a_all_results, event_key
            )
            swimmer_b_all_times = ComparisonAnalyzer._collect_event_times(
                swimmer_b_all_results, event_key
            )
            
            # Get recent times (last 5)
            swimmer_a_recent = swimmer_a_all_times[-5:] if swimmer_a_all_times else []
            swimmer_b_recent = swimmer_b_all_times[-5:] if swimmer_b_all_times else []
            
            prediction = RacePredictorEngine.predict_race(
                event=event_data.get('event', 'Unknown Event'),
                swimmer_a_data={
                    'time': swimmer_a_info.get('time_seconds'),
                    'age': swimmer_a_info.get('age'),
                    'all_times': swimmer_a_all_times,
                    'recent_times': swimmer_a_recent
                },
                swimmer_b_data={
                    'time': swimmer_b_info.get('time_seconds'),
                    'age': swimmer_b_info.get('age'),
                    'all_times': swimmer_b_all_times,
                    'recent_times': swimmer_b_recent
                },
                trend_comparison=event_trend
            )
            
            predictions.append(prediction)
        
        if not predictions:
            return PredictionAnalysis(
                predictions=[],
                overall_favorite='even',
                average_confidence=0.0
            )
        
        # Determine overall favorite
        overall_favorite = ComparisonAnalyzer._determine_overall_favorite(predictions)
        
        # Calculate average confidence
        avg_confidence = ComparisonAnalyzer._calculate_average_confidence(predictions)
        
        return PredictionAnalysis(
            predictions=predictions,
            overall_favorite=overall_favorite,
            average_confidence=round(avg_confidence, 1)
        )
    
    @staticmethod
    def _get_event_trend(
        event_data: Dict[str, Any],
        trend_analysis: Optional[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """Extract event-specific trend from overall analysis."""
        if not trend_analysis or not trend_analysis.get('by_event'):
            return None
        
        event_key = event_data.get('event_key', '')
        return trend_analysis.get('by_event', {}).get(event_key)
    
    @staticmethod
    def _collect_event_times(
        all_results: Optional[List[Dict[str, Any]]],
        event_key: str
    ) -> List[float]:
        """Collect all times for an event, supplementing with related events if needed."""
        if not all_results:
            return []
        
        # Get direct event times
        all_times = EventDataExtractor.get_event_times(all_results, event_key)
        
        # Supplement with related events if limited data
        if len(all_times) < 3:
            related_times = RelatedDataSupplementer.get_related_times(
                all_results, event_key, max_related=3
            )
            all_times.extend(related_times)
        
        return all_times
    
    @staticmethod
    def _determine_overall_favorite(predictions: List[RacePrediction]) -> str:
        """Determine overall favorite based on individual event predictions."""
        swimmer_a_wins = sum(1 for p in predictions if p.swimmer_a_probability > 50)
        swimmer_b_wins = sum(1 for p in predictions if p.swimmer_b_probability > 50)
        
        if swimmer_a_wins > swimmer_b_wins:
            return 'swimmer_a'
        elif swimmer_b_wins > swimmer_a_wins:
            return 'swimmer_b'
        else:
            return 'even'
    
    @staticmethod
    def _calculate_average_confidence(predictions: List[RacePrediction]) -> float:
        """Calculate average confidence across all predictions."""
        confidence_values = {'high': 3, 'medium': 2, 'low': 1}
        
        if not predictions:
            return 0.0
        
        return statistics.mean([
            confidence_values.get(p.confidence_level, 1) for p in predictions
        ])
