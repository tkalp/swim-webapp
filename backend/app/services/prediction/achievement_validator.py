"""Achievement rate validation for predictions.

Calculates how often swimmers achieve predicted times within N attempts.
"""
from typing import List, Dict, Any, Optional


class AchievementValidator:
    """Validates prediction accuracy using achievement rate methodology."""
    
    @staticmethod
    def calculate_achievement_rate(
        all_times: List[float],
        all_dates: List[str],
        prediction_window: int = 3,
        attempts_horizon: int = 5
    ) -> Dict[str, Any]:
        """
        Calculate how often predictions are achieved within N attempts.
        
        Args:
            all_times: Chronological list of times (in seconds)
            all_dates: Corresponding dates for each time
            prediction_window: Number of attempts to use for prediction (default 3)
            attempts_horizon: Number of future attempts to check achievement (default 5)
            
        Returns:
            Dictionary with achievement metrics:
            - achievement_rate: Percentage of predictions achieved (0-100)
            - total_predictions: Number of predictions tested
            - predictions_achieved: Number that were achieved
            - avg_attempts_to_achieve: Average attempts needed to achieve
            - avg_error_seconds: Average error when achieved
            - sample_predictions: List of example predictions with outcomes
        """
        if len(all_times) < prediction_window + 2:
            return {
                'achievement_rate': None,
                'total_predictions': 0,
                'predictions_achieved': 0,
                'avg_attempts_to_achieve': None,
                'avg_error_seconds': None,
                'confidence': 'insufficient_data',
                'sample_predictions': []
            }
        
        predictions_tested = []
        attempts_to_achieve_list = []
        error_seconds_list = []
        
        # Sliding window: for each point, predict next attempts using prior data
        for i in range(prediction_window, len(all_times) - 1):
            # Use times up to index i for prediction
            training_times = all_times[:i]
            
            # Calculate predicted improvement rate
            improvement_rate = AchievementValidator._calculate_improvement_rate(training_times)
            
            # Predict next time based on trend
            predicted_next = training_times[-1] + improvement_rate
            
            # Check if prediction was achieved in next N attempts
            future_times = all_times[i:min(i + attempts_horizon, len(all_times))]
            
            achieved = False
            attempts_needed = None
            actual_best = None
            
            for attempt_idx, actual_time in enumerate(future_times, start=1):
                if actual_time <= predicted_next:
                    achieved = True
                    attempts_needed = attempt_idx
                    actual_best = actual_time
                    error_seconds_list.append(abs(predicted_next - actual_time))
                    break
            
            if achieved:
                attempts_to_achieve_list.append(attempts_needed)
            
            # Store sample prediction for display
            if len(predictions_tested) < 5:  # Keep first 5 as samples
                predictions_tested.append({
                    'predicted': predicted_next,
                    'achieved': achieved,
                    'attempts_needed': attempts_needed,
                    'actual_best': actual_best,
                    'prediction_date': all_dates[i - 1] if i - 1 < len(all_dates) else None,
                    'future_times': future_times[:3]  # Show first 3 attempts
                })
        
        total_predictions = len(predictions_tested)
        predictions_achieved = sum(1 for p in predictions_tested if p['achieved'])
        achievement_rate = (predictions_achieved / total_predictions * 100) if total_predictions > 0 else 0
        
        # Determine confidence based on sample size
        if total_predictions < 3:
            confidence = 'low'
        elif total_predictions < 6:
            confidence = 'medium'
        else:
            confidence = 'high'
        
        return {
            'achievement_rate': round(achievement_rate, 1),
            'total_predictions': total_predictions,
            'predictions_achieved': predictions_achieved,
            'avg_attempts_to_achieve': round(sum(attempts_to_achieve_list) / len(attempts_to_achieve_list), 1) if attempts_to_achieve_list else None,
            'avg_error_seconds': round(sum(error_seconds_list) / len(error_seconds_list), 2) if error_seconds_list else None,
            'confidence': confidence,
            'sample_predictions': predictions_tested
        }
    
    @staticmethod
    def _calculate_improvement_rate(times: List[float]) -> float:
        """Calculate average improvement rate from time series."""
        if len(times) < 2:
            return 0.0
        
        # Calculate differences between consecutive times
        differences = [times[i] - times[i-1] for i in range(1, len(times))]
        
        # Average improvement (negative = getting faster)
        avg_improvement = sum(differences) / len(differences)
        
        return avg_improvement
    
    @staticmethod
    def get_achievement_confidence_message(
        achievement_rate: Optional[float],
        total_predictions: int,
        avg_attempts: Optional[float]
    ) -> str:
        """Generate human-readable confidence message."""
        if achievement_rate is None or total_predictions == 0:
            return "Not enough historical data to assess accuracy"
        
        if total_predictions < 3:
            return f"Early predictions (only {total_predictions} tested)"
        
        if achievement_rate >= 80:
            attempts_text = f"within {int(avg_attempts)} attempts" if avg_attempts else "consistently"
            return f"High accuracy: {int(achievement_rate)}% of similar predictions achieved {attempts_text}"
        elif achievement_rate >= 60:
            attempts_text = f"within {int(avg_attempts)} attempts" if avg_attempts else ""
            return f"Good accuracy: {int(achievement_rate)}% achieved {attempts_text}"
        elif achievement_rate >= 40:
            return f"Moderate accuracy: {int(achievement_rate)}% achieved (predictions may be aggressive)"
        else:
            return f"Lower accuracy: {int(achievement_rate)}% achieved (consider more conservative targets)"
