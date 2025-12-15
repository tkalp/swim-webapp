"""Statistical analysis utilities for swimming performance data."""
from typing import List, Optional
import statistics


class ImprovementAnalyzer:
    """Analyze improvement trends from historical performance data."""
    
    @staticmethod
    def calculate_improvement_per_attempt(
        times: List[float],
        window_size: int = 5
    ) -> float:
        """Calculate average improvement per attempt using recent performances.
        
        Uses a sliding window to focus on recent form rather than entire history.
        
        Args:
            times: List of times in chronological order (oldest first)
            window_size: Number of recent attempts to consider (default 5)
            
        Returns:
            Average improvement per attempt (negative = getting faster)
        """
        if len(times) < 2:
            return 0.0
        
        # Focus on recent attempts
        recent_times = times[-window_size:] if len(times) > window_size else times
        
        if len(recent_times) < 2:
            return 0.0
        
        # Calculate improvement between consecutive attempts
        improvements = []
        for i in range(1, len(recent_times)):
            improvement = recent_times[i] - recent_times[i-1]
            improvements.append(improvement)
        
        return statistics.mean(improvements) if improvements else 0.0
    
    @staticmethod
    def calculate_consistency(times: List[float]) -> float:
        """Calculate consistency score from time variability.
        
        Uses standard deviation normalized to best time.
        Lower scores indicate more consistent performance.
        
        Args:
            times: List of times (at least 2 required)
            
        Returns:
            Standard deviation of times, or 999 if insufficient data
        """
        if len(times) < 2:
            return 999.0
        
        return statistics.stdev(times)
    
    @staticmethod
    def calculate_recent_form(all_times: List[float]) -> float:
        """Calculate recent form by comparing first half vs second half of data.
        
        Args:
            all_times: Complete chronological time series
            
        Returns:
            Form score (0-1): 0.5 = neutral, >0.5 = improving, <0.5 = declining
        """
        if len(all_times) < 6:
            return 0.5
        
        midpoint = len(all_times) // 2
        first_half = all_times[:midpoint]
        second_half = all_times[midpoint:]
        
        avg_first = statistics.mean(first_half)
        avg_second = statistics.mean(second_half)
        
        # Positive improvement = second half faster
        form_improvement = avg_first - avg_second
        
        # Normalize to 0-1 scale (assuming 10% of best time is max expected change)
        best_time = min(all_times)
        normalized = 0.5 + (form_improvement / (best_time * 0.1))
        
        return min(1.0, max(0.0, normalized))


class TrendPredictor:
    """Predict future times based on historical trends."""
    
    @staticmethod
    def predict_future_time(
        current_best: float,
        all_times: List[float],
        attempts_until_race: int = 3,
        conservatism_factor: float = 0.8
    ) -> Optional[float]:
        """Predict future time based on improvement trend.
        
        Applies improvement rate with:
        - Conservative dampening (80% of calculated improvement)
        - Caps on maximum improvement (5%) and regression (10%)
        
        Args:
            current_best: Current best time in seconds
            all_times: Historical times in chronological order
            attempts_until_race: Expected attempts before target race (default 3)
            conservatism_factor: Dampening factor for predictions (default 0.8)
            
        Returns:
            Predicted time in seconds, or None if insufficient data
        """
        if len(all_times) < 2:
            return current_best
        
        # Calculate improvement rate
        improvement_rate = ImprovementAnalyzer.calculate_improvement_per_attempt(all_times)
        
        # Project forward with conservatism
        raw_prediction = current_best + (improvement_rate * attempts_until_race)
        conservative_prediction = current_best + (conservatism_factor * improvement_rate * attempts_until_race)
        
        # Apply improvement/regression caps
        max_improvement = current_best * 0.05  # 5% max improvement
        max_regression = current_best * 0.10   # 10% max regression
        
        improvement_from_best = current_best - conservative_prediction
        
        if improvement_from_best > max_improvement:
            return current_best - max_improvement
        elif improvement_from_best < -max_regression:
            return current_best + max_regression
        else:
            return conservative_prediction


class ConfidenceCalculator:
    """Calculate prediction confidence levels."""
    
    @staticmethod
    def calculate_confidence(
        probability_margin: float,
        has_trend_data: bool,
        has_recent_form: bool
    ) -> str:
        """Calculate confidence level based on prediction margin and data quality.
        
        Args:
            probability_margin: Absolute difference from 50% (0-50)
            has_trend_data: Whether trend analysis is available
            has_recent_form: Whether recent performance data is available
            
        Returns:
            Confidence level: "high", "medium", or "low"
        """
        data_quality_bonus = 0
        if has_trend_data:
            data_quality_bonus += 10
        if has_recent_form:
            data_quality_bonus += 5
        
        adjusted_margin = probability_margin + data_quality_bonus
        
        if adjusted_margin >= 30:
            return "high"
        elif adjusted_margin >= 15:
            return "medium"
        else:
            return "low"
    
    @staticmethod
    def calculate_improvement_confidence(
        data_points: int,
        consistency_score: float,
        improvement_rate: float,
        training_volume: float,
        pb_recency: float,
        attendance_rate: Optional[float] = None,
        has_squad_data: bool = False,
        has_workout_data: bool = False
    ) -> tuple[str, float]:
        """Calculate confidence for improvement predictions.
        
        Scores across multiple factors with maximum possible score of 110 (with all data).
        
        Args:
            data_points: Number of historical times available
            consistency_score: Consistency factor (0-1, higher = more consistent)
            improvement_rate: Absolute value of improvement rate
            training_volume: Training volume factor (0-1)
            pb_recency: Personal best recency factor (0-1)
            attendance_rate: Optional attendance percentage (0-100)
            has_squad_data: Whether squad comparison data available
            has_workout_data: Whether workout alignment data available
            
        Returns:
            Tuple of (confidence_level, raw_score)
        """
        confidence_score = 0
        
        # Data quantity (0-30 points)
        if data_points >= 10:
            confidence_score += 30
        elif data_points >= 5:
            confidence_score += 20
        else:
            confidence_score += 10
        
        # Consistency (0-20 points)
        confidence_score += consistency_score * 20
        
        # Improvement trend clarity (0-15 points)
        if abs(improvement_rate) > 0.01:
            confidence_score += 15
        elif abs(improvement_rate) > 0.001:
            confidence_score += 10
        else:
            confidence_score += 5
        
        # Training volume (0-10 points)
        confidence_score += training_volume * 10
        
        # PB recency (0-10 points)
        confidence_score += pb_recency * 10
        
        # Attendance (0-15 points)
        if attendance_rate is not None:
            if attendance_rate >= 80:
                confidence_score += 15
            elif attendance_rate >= 60:
                confidence_score += 10
            else:
                confidence_score += (attendance_rate / 60.0) * 10
        
        # Squad comparison (0-10 points)
        if has_squad_data:
            confidence_score += 10
        
        # Workout alignment (0-15 points)
        if has_workout_data:
            confidence_score += 15
        
        # Determine confidence level
        max_possible_score = 110 if has_workout_data else 95
        
        if confidence_score >= (max_possible_score * 0.64):
            confidence_level = "high"
        elif confidence_score >= (max_possible_score * 0.37):
            confidence_level = "medium"
        else:
            confidence_level = "low"
        
        return confidence_level, confidence_score
