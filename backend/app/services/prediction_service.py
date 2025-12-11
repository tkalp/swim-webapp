"""Race prediction service for head-to-head swimmer comparisons."""
from typing import Dict, Optional, Any, List
from dataclasses import dataclass
import statistics


@dataclass
class RacePrediction:
    """Prediction for a specific event matchup."""
    event: str
    swimmer_a_probability: float  # 0-100
    swimmer_b_probability: float  # 0-100
    confidence_level: str  # "high", "medium", "low"
    predicted_differential: float  # Expected time difference in seconds
    predicted_time_a: Optional[float]  # Predicted time for swimmer A in seconds
    predicted_time_b: Optional[float]  # Predicted time for swimmer B in seconds
    factors: Dict[str, float]  # Breakdown of prediction factors


@dataclass
class PredictionAnalysis:
    """Complete prediction analysis for swimmer comparison."""
    predictions: List[RacePrediction]
    overall_favorite: str  # "swimmer_a", "swimmer_b", or "even"
    average_confidence: float


@dataclass
class WorkoutContext:
    """Workout context data for prediction enhancement."""
    total_meters: float
    effort_level: Optional[int]  # 1-10 scale
    session_date: str
    workout_type: str  # 'sprint', 'endurance', 'technique', 'mixed'


@dataclass
class ImprovementPrediction:
    """Prediction for a single swimmer's improvement in an event."""
    event: str
    current_best: float  # Current best time in seconds
    predicted_time: Optional[float]  # Predicted future time in seconds
    confidence_level: str  # "high", "medium", "low"
    improvement_expected: float  # Expected improvement in seconds (negative = faster)
    factors: Dict[str, Any]  # Prediction factors and data


class PredictionService:
    """Service for predicting race outcomes based on historical data and trends."""
    
    # Prediction weight factors
    WEIGHT_CURRENT_DIFFERENTIAL = 0.50  # 50% weight on current time difference
    WEIGHT_IMPROVEMENT_RATE = 0.30  # 30% weight on improvement per attempt
    WEIGHT_CONSISTENCY = 0.15  # 15% weight on consistency
    WEIGHT_RECENT_FORM = 0.05  # 5% weight on recent performances
    
    @staticmethod
    def calculate_improvement_per_attempt(
        times: List[float],
        window_size: int = 5
    ) -> float:
        """
        Calculate average improvement per attempt over recent performances.
        
        Args:
            times: List of times in chronological order (oldest first)
            window_size: Number of recent attempts to consider
            
        Returns:
            Average improvement per attempt (negative = getting faster)
        """
        if len(times) < 2:
            return 0.0
        
        # Use last N attempts
        recent_times = times[-window_size:] if len(times) > window_size else times
        
        if len(recent_times) < 2:
            return 0.0
        
        # Calculate improvement between consecutive attempts
        improvements = []
        for i in range(1, len(recent_times)):
            improvement = recent_times[i] - recent_times[i-1]
            improvements.append(improvement)
        
        # Return average improvement per attempt
        return statistics.mean(improvements) if improvements else 0.0
    
    @staticmethod
    def predict_future_time(
        current_best: float,
        all_times: List[float],
        attempts_until_race: int = 3
    ) -> Optional[float]:
        """
        Predict future time based on improvement trend.
        
        Args:
            current_best: Current best time in seconds
            all_times: Historical times in chronological order
            attempts_until_race: Number of attempts expected before race (default 3)
            
        Returns:
            Predicted time in seconds, or None if insufficient data
        """
        if len(all_times) < 2:
            # Not enough data, return current best
            return current_best
        
        # Calculate improvement per attempt
        improvement_rate = PredictionService.calculate_improvement_per_attempt(all_times)
        
        # Apply improvement over expected attempts
        # Negative improvement_rate = getting faster (time going down)
        predicted_time = current_best + (improvement_rate * attempts_until_race)
        
        # Apply diminishing returns - harder to keep improving at same rate
        # Use 80% of predicted improvement for conservatism
        conservative_prediction = current_best + (0.8 * improvement_rate * attempts_until_race)
        
        # Ensure we don't predict unrealistic improvements or regressions
        # Cap at 5% improvement or 10% regression from current best
        max_improvement = current_best * 0.05
        max_regression = current_best * 0.10
        
        improvement_from_best = current_best - conservative_prediction
        
        if improvement_from_best > max_improvement:
            # Capping overly optimistic predictions
            return current_best - max_improvement
        elif improvement_from_best < -max_regression:
            # Capping overly pessimistic predictions
            return current_best + max_regression
        else:
            return conservative_prediction
    
    @staticmethod
    def predict_race_outcome(
        event: str,
        swimmer_a_data: Dict[str, Any],
        swimmer_b_data: Dict[str, Any],
        trend_comparison: Optional[Dict[str, Any]] = None
    ) -> RacePrediction:
        """
        Predict the outcome of a head-to-head race.
        
        Args:
            event: Event name
            swimmer_a_data: Dict with 'time', 'age', 'best_time', 'recent_times'
            swimmer_b_data: Dict with 'time', 'age', 'best_time', 'recent_times'
            trend_comparison: Optional trend analysis data
            
        Returns:
            RacePrediction with probabilities and confidence
        """
        factors = {}
        
        # Factor 1: Current time differential (50%)
        # Time is already in seconds from time_seconds field
        time_a = swimmer_a_data.get('time')  # Already in seconds
        time_b = swimmer_b_data.get('time')  # Already in seconds
        
        if time_a and time_b:
            differential = time_b - time_a  # Positive = A is faster
            # Convert differential to probability (sigmoid-like function)
            # A 5-second difference gives ~90% confidence
            differential_score = PredictionService._differential_to_score(differential)
            factors['current_differential'] = differential_score * PredictionService.WEIGHT_CURRENT_DIFFERENTIAL
        else:
            factors['current_differential'] = 0.5 * PredictionService.WEIGHT_CURRENT_DIFFERENTIAL
        
        # Factor 2: Improvement rate per attempt (30%)
        swimmer_a_times = swimmer_a_data.get('all_times', [])
        swimmer_b_times = swimmer_b_data.get('all_times', [])
        
        if swimmer_a_times and len(swimmer_a_times) >= 2 and swimmer_b_times and len(swimmer_b_times) >= 2:
            swimmer_a_rate = PredictionService.calculate_improvement_per_attempt(swimmer_a_times)
            swimmer_b_rate = PredictionService.calculate_improvement_per_attempt(swimmer_b_times)
            
            # More negative = faster improvement
            # Scale by factor to make comparable to time differential
            rate_diff = (swimmer_b_rate - swimmer_a_rate) * 5  # Scale factor for attempts
            rate_score = PredictionService._differential_to_score(rate_diff)
            factors['improvement_rate'] = rate_score * PredictionService.WEIGHT_IMPROVEMENT_RATE
        else:
            factors['improvement_rate'] = 0.5 * PredictionService.WEIGHT_IMPROVEMENT_RATE
        
        # Factor 3: Consistency (15%)
        # Calculate consistency from standard deviation of recent times
        if swimmer_a_times and len(swimmer_a_times) >= 3 and swimmer_b_times and len(swimmer_b_times) >= 3:
            recent_a = swimmer_a_times[-5:]  # Last 5 attempts
            recent_b = swimmer_b_times[-5:]
            
            std_a = statistics.stdev(recent_a) if len(recent_a) > 1 else 999
            std_b = statistics.stdev(recent_b) if len(recent_b) > 1 else 999
            
            # Lower std = more consistent = better
            # Convert to relative score (lower is better, so invert)
            consistency_diff = (std_b - std_a) * 0.5  # Scale factor
            consistency_score = PredictionService._differential_to_score(consistency_diff)
            factors['consistency'] = consistency_score * PredictionService.WEIGHT_CONSISTENCY
        else:
            factors['consistency'] = 0.5 * PredictionService.WEIGHT_CONSISTENCY
        
        # Factor 4: Recent form (5%)
        recent_a = swimmer_a_data.get('recent_times', [])
        recent_b = swimmer_b_data.get('recent_times', [])
        
        if recent_a and recent_b:
            avg_recent_a = statistics.mean(recent_a)
            avg_recent_b = statistics.mean(recent_b)
            recent_diff = avg_recent_b - avg_recent_a
            recent_score = PredictionService._differential_to_score(recent_diff)
            factors['recent_form'] = recent_score * PredictionService.WEIGHT_RECENT_FORM
        else:
            factors['recent_form'] = 0.5 * PredictionService.WEIGHT_RECENT_FORM
        
        # Calculate total probability
        total_score = sum(factors.values())
        swimmer_a_probability = total_score * 100
        swimmer_b_probability = (1 - total_score) * 100
        
        # Determine confidence level
        confidence_level = PredictionService._calculate_confidence(
            abs(swimmer_a_probability - 50),
            trend_comparison is not None,
            len(recent_a) + len(recent_b) >= 4
        )
        
        # Predict differential
        if time_a and time_b:
            current_diff = abs(time_b - time_a)
            # Apply improvement rate adjustments (assume 3 more attempts before race)
            if swimmer_a_times and len(swimmer_a_times) >= 2 and swimmer_b_times and len(swimmer_b_times) >= 2:
                swimmer_a_rate = PredictionService.calculate_improvement_per_attempt(swimmer_a_times)
                swimmer_b_rate = PredictionService.calculate_improvement_per_attempt(swimmer_b_times)
                rate_diff = abs(swimmer_b_rate - swimmer_a_rate)
                # Assume 3 attempts before race
                trend_adjustment = rate_diff * 3
                predicted_differential = max(0, current_diff - trend_adjustment)
            else:
                predicted_differential = current_diff
        else:
            predicted_differential = 0.0
        
        # Predict future times for both swimmers
        predicted_time_a = None
        predicted_time_b = None
        
        if time_a:
            if swimmer_a_times and len(swimmer_a_times) >= 2:
                predicted_time_a = PredictionService.predict_future_time(
                    current_best=time_a,
                    all_times=swimmer_a_times,
                    attempts_until_race=3
                )
            else:
                # No trend data, use current time
                predicted_time_a = time_a
        
        if time_b:
            if swimmer_b_times and len(swimmer_b_times) >= 2:
                predicted_time_b = PredictionService.predict_future_time(
                    current_best=time_b,
                    all_times=swimmer_b_times,
                    attempts_until_race=3
                )
            else:
                # No trend data, use current time
                predicted_time_b = time_b
        
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
    
    @staticmethod
    def predict_all_events(
        head_to_head_events: List[Dict[str, Any]],
        trend_analysis: Optional[Dict[str, Any]] = None,
        swimmer_a_all_results: Optional[List[Dict[str, Any]]] = None,
        swimmer_b_all_results: Optional[List[Dict[str, Any]]] = None
    ) -> PredictionAnalysis:
        """
        Predict outcomes for all events in a head-to-head comparison.
        
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
            
            # Get event-specific trend if available
            event_trend = None
            if trend_analysis and trend_analysis.get('by_event'):
                event_key = event_data.get('event_key', '')
                event_trend = trend_analysis.get('by_event', {}).get(event_key)
            
            # Collect all historical times for this event
            event_key = event_data.get('event_key', '')
            swimmer_a_all_times = []
            swimmer_b_all_times = []
            
            if swimmer_a_all_results:
                swimmer_a_all_times = PredictionService._get_event_times(
                    swimmer_a_all_results, event_key
                )
                # If we have limited data, supplement with related events
                if len(swimmer_a_all_times) < 3:
                    related_times = PredictionService._get_related_times(
                        swimmer_a_all_results, event_key
                    )
                    # Add related times with lower weight (only if we have few direct times)
                    swimmer_a_all_times.extend(related_times[:3])  # Max 3 related times
            
            if swimmer_b_all_results:
                swimmer_b_all_times = PredictionService._get_event_times(
                    swimmer_b_all_results, event_key
                )
                # If we have limited data, supplement with related events
                if len(swimmer_b_all_times) < 3:
                    related_times = PredictionService._get_related_times(
                        swimmer_b_all_results, event_key
                    )
                    # Add related times with lower weight (only if we have few direct times)
                    swimmer_b_all_times.extend(related_times[:3])  # Max 3 related times
            
            # Get recent times (last 5)
            swimmer_a_recent = swimmer_a_all_times[-5:] if len(swimmer_a_all_times) > 0 else []
            swimmer_b_recent = swimmer_b_all_times[-5:] if len(swimmer_b_all_times) > 0 else []
            
            prediction = PredictionService.predict_race_outcome(
                event=event_data.get('event', 'Unknown Event'),
                swimmer_a_data={
                    'time': swimmer_a_info.get('time_seconds'),  # Use pre-calculated seconds
                    'age': swimmer_a_info.get('age'),
                    'all_times': swimmer_a_all_times,
                    'recent_times': swimmer_a_recent
                },
                swimmer_b_data={
                    'time': swimmer_b_info.get('time_seconds'),  # Use pre-calculated seconds
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
        swimmer_a_wins = sum(1 for p in predictions if p.swimmer_a_probability > 50)
        swimmer_b_wins = sum(1 for p in predictions if p.swimmer_b_probability > 50)
        
        if swimmer_a_wins > swimmer_b_wins:
            overall_favorite = 'swimmer_a'
        elif swimmer_b_wins > swimmer_a_wins:
            overall_favorite = 'swimmer_b'
        else:
            overall_favorite = 'even'
        
        # Calculate average confidence
        confidence_values = {
            'high': 3,
            'medium': 2,
            'low': 1
        }
        avg_confidence = statistics.mean([
            confidence_values.get(p.confidence_level, 1) for p in predictions
        ]) if predictions else 0.0
        
        return PredictionAnalysis(
            predictions=predictions,
            overall_favorite=overall_favorite,
            average_confidence=round(avg_confidence, 1)
        )
    
    @staticmethod
    def _get_event_times(
        results: List[Dict[str, Any]],
        event_key: str
    ) -> List[float]:
        """
        Extract all times for a specific event in chronological order.
        
        Args:
            results: List of all results for a swimmer
            event_key: Event identifier (e.g., '100_free_scm_swim')
            
        Returns:
            List of times in seconds, chronologically ordered (oldest first)
        """
        event_times = []
        
        for result in results:
            # Match event key
            result_event_key = PredictionService._get_event_key_from_result(result)
            if result_event_key != event_key:
                continue
            
            # Parse time
            time_seconds = PredictionService._parse_time_to_seconds(
                result.get('time_result', '')
            )
            
            if time_seconds is not None:
                event_times.append({
                    'time': time_seconds,
                    'date': result.get('performed_on', '')
                })
        
        # Sort by date (oldest first)
        event_times.sort(key=lambda x: x['date'])
        
        # Return just the times
        return [t['time'] for t in event_times]
    
    @staticmethod
    def _get_event_key_from_result(result: Dict[str, Any]) -> str:
        """Generate event key from result - must match comparison_service format."""
        distance = result.get('distance')
        stroke = result.get('stroke')
        result_units = result.get('result_units', 'SCM')
        activity = result.get('activity', 'swim')
        
        return f"{distance}_{stroke}_{result_units}_{activity}"
    
    @staticmethod
    def _get_related_event_keys(event_key: str) -> List[str]:
        """
        Get related event keys that can inform predictions.
        
        For example:
        - 50 back -> look at 100 back
        - 100 back -> look at 50 back and 200 back
        - 200 back -> look at 100 back and 400 IM
        
        Args:
            event_key: Event key in format "distance_stroke_pool_activity"
            
        Returns:
            List of related event keys
        """
        parts = event_key.split('_')
        if len(parts) < 4:
            return []
        
        distance_str, stroke, pool_type, activity = parts[0], parts[1], parts[2], parts[3]
        
        try:
            distance = int(distance_str)
        except ValueError:
            return []
        
        related = []
        
        # For sprint events (50m), look at 100m of same stroke
        if distance == 50:
            related.append(f"100_{stroke}_{pool_type}_{activity}")
        
        # For 100m, look at 50m and 200m of same stroke
        elif distance == 100:
            related.append(f"50_{stroke}_{pool_type}_{activity}")
            related.append(f"200_{stroke}_{pool_type}_{activity}")
        
        # For 200m, look at 100m and 400m
        elif distance == 200:
            related.append(f"100_{stroke}_{pool_type}_{activity}")
            related.append(f"400_{stroke}_{pool_type}_{activity}")
            # For 200 back/breast/fly, also consider 200 IM
            if stroke in ['back', 'breast', 'fly']:
                related.append(f"200_im_{pool_type}_{activity}")
        
        # For 400m, look at 200m and 800m
        elif distance == 400:
            related.append(f"200_{stroke}_{pool_type}_{activity}")
            related.append(f"800_{stroke}_{pool_type}_{activity}")
            # For 400 free, also consider 400 IM
            if stroke == 'free':
                related.append(f"400_im_{pool_type}_{activity}")
        
        # For 800m, look at 400m and 1500m
        elif distance == 800:
            related.append(f"400_{stroke}_{pool_type}_{activity}")
            related.append(f"1500_{stroke}_{pool_type}_{activity}")
        
        # For 1500m, look at 800m
        elif distance == 1500:
            related.append(f"800_{stroke}_{pool_type}_{activity}")
        
        return related
    
    @staticmethod
    def _get_related_times(
        all_results: List[Dict[str, Any]],
        event_key: str
    ) -> List[float]:
        """
        Get times from related events to supplement prediction data.
        Includes cross-pool conversions (SCM <-> LCM).
        
        Args:
            all_results: All results for a swimmer
            event_key: Target event key
            
        Returns:
            List of times from related events (scaled appropriately)
        """
        related_keys = PredictionService._get_related_event_keys(event_key)
        
        # Also add same event in different pool types
        parts = event_key.split('_')
        if len(parts) >= 4:
            distance_str, stroke, pool_type, activity = parts[0], parts[1], parts[2], parts[3]
            # Add cross-pool conversions
            if pool_type == 'SCM':
                related_keys.append(f"{distance_str}_{stroke}_LCM_{activity}")
            elif pool_type == 'LCM':
                related_keys.append(f"{distance_str}_{stroke}_SCM_{activity}")
        
        if not related_keys:
            return []
        
        related_times = []
        
        try:
            target_distance = int(parts[0]) if len(parts) > 0 else 0
            target_pool = parts[2] if len(parts) > 2 else ''
        except (ValueError, IndexError):
            return []
        
        for related_key in related_keys:
            related_parts = related_key.split('_')
            if len(related_parts) < 4:
                continue
            
            try:
                related_distance = int(related_parts[0])
                related_pool = related_parts[2]
            except (ValueError, IndexError):
                continue
            
            # Get times for this related event
            for result in all_results:
                result_key = PredictionService._get_event_key_from_result(result)
                if result_key == related_key:
                    time_seconds = result.get('time_seconds')
                    if time_seconds:
                        scaled_time = time_seconds
                        
                        # Apply pool conversion if same distance, different pool
                        if related_distance == target_distance and related_pool != target_pool:
                            scaled_time = PredictionService._convert_pool_time(
                                time_seconds, related_distance, related_pool, target_pool
                            )
                        # Apply distance scaling if different distance
                        elif related_distance != target_distance:
                            scaling_factor = target_distance / related_distance
                            # Use power law: T2 = T1 * (D2/D1)^1.06
                            scaled_time = time_seconds * (scaling_factor ** 1.06)
                        
                        if scaled_time:
                            related_times.append(scaled_time)
        
        return related_times
    
    @staticmethod
    def _convert_pool_time(
        time_seconds: float,
        distance: int,
        from_pool: str,
        to_pool: str
    ) -> Optional[float]:
        """
        Convert time between SCM and LCM pools.
        
        Standard conversion factors:
        - SCM to LCM: add ~2-4% depending on distance and stroke
        - LCM to SCM: subtract ~2-4%
        
        Args:
            time_seconds: Original time in seconds
            distance: Event distance in meters
            from_pool: Source pool type (SCM/LCM)
            to_pool: Target pool type (SCM/LCM)
            
        Returns:
            Converted time in seconds, or None if conversion not applicable
        """
        if from_pool == to_pool:
            return time_seconds
        
        # Conversion factors (percentage slower in LCM vs SCM)
        # Shorter events have bigger difference due to turns
        conversion_factors = {
            50: 0.015,   # 1.5% (fewer turns impact)
            100: 0.025,  # 2.5%
            200: 0.030,  # 3.0%
            400: 0.035,  # 3.5%
            800: 0.038,  # 3.8%
            1500: 0.040, # 4.0%
        }
        
        # Default to 3% if distance not in table
        factor = conversion_factors.get(distance, 0.03)
        
        if from_pool == 'SCM' and to_pool == 'LCM':
            # SCM -> LCM: add time (slower in long course)
            return time_seconds * (1 + factor)
        elif from_pool == 'LCM' and to_pool == 'SCM':
            # LCM -> SCM: subtract time (faster in short course)
            return time_seconds * (1 - factor)
        
        return time_seconds
    
    @staticmethod
    def _parse_time_to_seconds(time_str: str) -> Optional[float]:
        """Parse time string to seconds (supports mm:ss.ms format)."""
        if not time_str or not isinstance(time_str, str):
            return None
        
        try:
            # Handle format like "1:23.45" or "59.12"
            if ':' in time_str:
                parts = time_str.split(':')
                if len(parts) == 2:
                    minutes = float(parts[0])
                    seconds = float(parts[1])
                    return minutes * 60 + seconds
                elif len(parts) == 3:
                    hours = float(parts[0])
                    minutes = float(parts[1])
                    seconds = float(parts[2])
                    return hours * 3600 + minutes * 60 + seconds
            else:
                # Just seconds
                return float(time_str)
        except (ValueError, AttributeError):
            return None
        
        return None
    
    @staticmethod
    def _parse_time(time_str: str) -> Optional[float]:
        """Parse time string to seconds."""
        if not time_str:
            return None
        
        try:
            # Remove non-numeric characters except : and .
            clean = time_str.replace(',', '.')
            
            # Handle MM:SS.ss format
            if ':' in clean:
                parts = clean.split(':')
                if len(parts) == 2:
                    minutes = float(parts[0])
                    seconds = float(parts[1])
                    return minutes * 60 + seconds
            
            # Handle direct seconds
            return float(clean)
        except (ValueError, AttributeError):
            return None
    
    @staticmethod
    def _differential_to_score(differential: float) -> float:
        """
        Convert time differential to probability score (0-1).
        
        Uses sigmoid-like function where:
        - 5 second advantage = ~0.90 probability
        - 2 second advantage = ~0.70 probability
        - 0 second difference = 0.50 probability
        
        Args:
            differential: Time difference (positive = swimmer_a faster)
            
        Returns:
            Probability score between 0 and 1
        """
        import math
        # Sigmoid function: 1 / (1 + e^(-k*x))
        # k=0.5 gives good spread for swimming time differences
        k = 0.5
        return 1 / (1 + math.exp(-k * differential))
    
    @staticmethod
    def _calculate_confidence(
        probability_margin: float,
        has_trend_data: bool,
        has_recent_form: bool
    ) -> str:
        """
        Calculate confidence level based on prediction margin and data quality.
        
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
    def get_physiological_limits(distance: int, stroke: str) -> dict:
        """
        Get approximate physiological limits for different events.
        These are based on elite performance data with safety margins.
        
        Returns dict with:
        - elite_time: Current world-class time
        - diminishing_threshold: Time below which improvement slows significantly
        - max_improvement_rate: Maximum realistic improvement rate at current level
        """
        # Elite times (approximate world records/top performances)
        elite_times = {
            50: {"free": 20.9, "back": 23.7, "breast": 25.9, "fly": 22.2, "im": 24.0},
            100: {"free": 46.8, "back": 51.6, "breast": 56.9, "fly": 49.8, "im": 51.3},
            200: {"free": 102.0, "back": 111.5, "breast": 125.9, "fly": 110.7, "im": 113.0},
            400: {"free": 220.0, "back": 240.0, "breast": 270.0, "fly": 240.0, "im": 240.0},
            800: {"free": 450.0, "back": 500.0, "breast": 540.0, "fly": 500.0, "im": 500.0},
            1500: {"free": 870.0, "back": 970.0, "breast": 1020.0, "fly": 970.0, "im": 970.0}
        }
        
        # Normalize stroke name for lookup
        stroke_lower = stroke.lower()
        if stroke_lower in ['im', 'individualmedley', 'individual medley', 'medley']:
            stroke_key = "im"
        elif stroke_lower.startswith('free'):
            stroke_key = "free"
        elif stroke_lower.startswith('back'):
            stroke_key = "back"
        elif stroke_lower.startswith('brea'):
            stroke_key = "breast"
        elif stroke_lower.startswith('fly') or stroke_lower.startswith('butt'):
            stroke_key = "fly"
        else:
            stroke_key = "free"  # Default fallback
        
        elite = elite_times.get(distance, {}).get(stroke_key, 60.0)
        
        # Diminishing returns kick in around 115% of elite time
        diminishing_threshold = elite * 1.15
        
        # Max improvement rate depends on how far from elite
        # Beginners can improve 5-10% per season, elites maybe 0.5-1%
        return {
            "elite_time": elite,
            "diminishing_threshold": diminishing_threshold,
            "max_improvement_rate": 0.05  # 5% max improvement
        }
    
    @staticmethod
    def apply_physiological_constraints(
        predicted_time: float,
        current_best: float,
        distance: int,
        stroke: str,
        all_times: Optional[List[float]] = None
    ) -> float:
        """
        Apply physiological limits to predicted time.
        
        Accounts for:
        - Diminishing returns as approaching elite times
        - Maximum realistic improvement rates
        - Terminal velocity constraints
        - Distance-specific fatigue curves
        """
        limits = PredictionService.get_physiological_limits(distance, stroke)
        
        # Calculate improvement
        improvement = current_best - predicted_time
        improvement_pct = improvement / current_best
        
        # Cap maximum improvement at 5% per prediction cycle (more conservative for slower swimmers)
        # Swimmers far from elite (>150% of elite) should have even stricter caps
        elite_ratio = current_best / limits["elite_time"]
        if elite_ratio > 2.0:
            # Very beginner swimmers (>200% of elite time) - cap at 3%
            max_rate = 0.03
        elif elite_ratio > 1.5:
            # Intermediate swimmers (150-200% of elite time) - cap at 4%
            max_rate = 0.04
        else:
            # Advanced swimmers (<150% of elite time) - standard 5% cap
            max_rate = limits["max_improvement_rate"]
        
        if improvement_pct > max_rate:
            predicted_time = current_best * (1 - max_rate)
            improvement = current_best - predicted_time
        
        # Apply diminishing returns near elite performance
        if current_best <= limits["diminishing_threshold"]:
            # Calculate how close to elite (0 = at elite, 1 = at threshold)
            proximity_to_elite = (current_best - limits["elite_time"]) / (limits["diminishing_threshold"] - limits["elite_time"])
            proximity_to_elite = max(0.0, min(1.0, proximity_to_elite))
            
            # Reduce improvement based on proximity to elite
            # At threshold: 100% of improvement
            # At elite: 10% of improvement (very hard to improve)
            dampening_factor = 0.1 + (0.9 * proximity_to_elite)
            
            adjusted_improvement = improvement * dampening_factor
            predicted_time = current_best - adjusted_improvement
        
        # Apply distance-based fatigue constraints
        # Longer distances have steeper diminishing returns
        if distance >= 200:
            # For longer distances, cap improvement at lower percentages
            # 200m: max 4%, 400m: max 3%, 800+: max 2%
            distance_cap = 0.05 - (min(distance - 100, 700) / 100 * 0.005)
            distance_cap = max(0.02, distance_cap)  # Floor at 2%
            
            if improvement_pct > distance_cap:
                predicted_time = current_best * (1 - distance_cap)
        
        # Check for unrealistic pace expectations
        # Swimmers can't maintain 100m pace for 200m+
        if all_times and len(all_times) >= 3:
            avg_pace = current_best / distance  # seconds per meter
            
            # For 200m+, apply fatigue multiplier
            if distance >= 200:
                # Expected slowdown: 200m is ~7-10% slower pace than 100m
                # 400m is ~15-20% slower pace than 100m
                expected_slowdown = {
                    200: 0.075,  # 7.5% slower per meter
                    400: 0.175,  # 17.5% slower per meter  
                    800: 0.25,   # 25% slower per meter
                    1500: 0.30   # 30% slower per meter
                }.get(distance, 0.15)
                
                # If prediction suggests maintaining unrealistic pace, adjust
                predicted_pace = predicted_time / distance
                base_100m_pace = current_best / distance * (1 / (1 + expected_slowdown))
                realistic_min_pace = base_100m_pace * (1 + expected_slowdown * 0.5)
                
                if predicted_pace < realistic_min_pace:
                    predicted_time = realistic_min_pace * distance
        
        # Absolute floor: can't go faster than 95% of elite time
        absolute_limit = limits["elite_time"] * 0.95
        if predicted_time < absolute_limit:
            predicted_time = absolute_limit
        
        return predicted_time
    
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
        """
        Predict improvement for a single swimmer in a specific event.
        
        Args:
            event: Event name
            current_best: Current best time in seconds
            all_times: All historical times in chronological order (oldest first)
            attempts_until_target: Number of future attempts to predict (default 3)
            attendance_rate: Optional attendance percentage (0-100) for last 30 days
            squad_improvement_rate: Optional squad average improvement rate per attempt
            recent_workouts: Optional list of recent workout contexts (last 30 days)
            days_since_last_result: Optional days since last competitive result
            swimmer_age: Optional swimmer age in years (for age-group specific adjustments)
            
        Returns:
            ImprovementPrediction with predicted time and confidence
        """
        factors = {}
        
        # Need at least 3 attempts for meaningful prediction
        if len(all_times) < 3:
            return ImprovementPrediction(
                event=event,
                current_best=current_best,
                predicted_time=None,
                confidence_level="low",
                improvement_expected=0.0,
                factors={
                    "attempts_analyzed": len(all_times),
                    "message": "Insufficient data for prediction (need 3+ attempts)"
                }
            )
        
        factors['attempts_analyzed'] = len(all_times)
        
        # Add attendance factor if available
        if attendance_rate is not None:
            # Normalize attendance to 0-1 scale (percentage / 100)
            # Good attendance (>70%) positively impacts predictions
            # Poor attendance (<50%) negatively impacts predictions
            attendance_normalized = attendance_rate / 100.0
            factors['attendance_rate'] = round(attendance_rate, 1)
            factors['attendance_factor'] = round(attendance_normalized, 3)
        
        # Add time-since-last-result adjustment factor
        # For age group swimmers (typically <18), longer gaps indicate more potential improvement
        # due to natural growth/development between competitions
        time_gap_multiplier = 1.0  # Default: no adjustment
        if days_since_last_result is not None and swimmer_age is not None:
            factors['days_since_last_result'] = days_since_last_result
            factors['swimmer_age'] = swimmer_age
            
            # Apply age-group specific adjustments - CONSERVATIVE values to avoid overprediction
            # Younger swimmers (age 10-17) have more potential for improvement with longer gaps
            # Senior swimmers (age 18+) don't benefit as much from time gaps
            if swimmer_age < 18:
                # Age group swimmer - apply time gap adjustments (reduced from previous values)
                if days_since_last_result <= 90:  # 0-3 months: normal expectation
                    time_gap_multiplier = 1.0
                    factors['time_gap_category'] = '0-3 months (normal)'
                elif days_since_last_result <= 180:  # 3-6 months: modest boost
                    # Scale from 1.0 at 90 days to 1.05 at 180 days (reduced from 1.15)
                    time_gap_multiplier = 1.0 + ((days_since_last_result - 90) / 90) * 0.05
                    factors['time_gap_category'] = '3-6 months (modest growth expected)'
                elif days_since_last_result <= 365:  # 6-12 months: moderate boost
                    # Scale from 1.05 at 180 days to 1.10 at 365 days (reduced from 1.25)
                    time_gap_multiplier = 1.05 + ((days_since_last_result - 180) / 185) * 0.05
                    factors['time_gap_category'] = '6-12 months (moderate growth expected)'
                else:  # 12+ months: maximum boost but capped
                    time_gap_multiplier = 1.12  # Cap at 12% boost (reduced from 30%)
                    factors['time_gap_category'] = '12+ months (development expected)'
            else:
                # Senior swimmer (18+) - time gaps don't indicate as much natural improvement
                if days_since_last_result <= 90:
                    time_gap_multiplier = 1.0
                    factors['time_gap_category'] = '0-3 months (normal)'
                elif days_since_last_result <= 180:
                    # Slight boost for recovery/training time
                    time_gap_multiplier = 1.02  # Reduced from 1.05
                    factors['time_gap_category'] = '3-6 months (taper benefit possible)'
                else:
                    # Long gaps for seniors might indicate rust, not improvement
                    time_gap_multiplier = 0.98  # Slightly more conservative from 0.95
                    factors['time_gap_category'] = '6+ months (possible detraining)'
            
            factors['time_gap_multiplier'] = round(time_gap_multiplier, 3)
        
        # Add squad comparison factor if available
        if squad_improvement_rate is not None:
            factors['squad_avg_improvement_rate'] = round(squad_improvement_rate, 4)
            # Compare swimmer's rate to squad average
            # Negative rate = getting faster (improvement)
            # If swimmer improving faster than squad, boost confidence
            # If swimmer improving slower, reduce confidence
            if improvement_rate < squad_improvement_rate:  # Swimmer improving faster
                squad_comparison = 1.0  # Positive indicator
            elif improvement_rate > squad_improvement_rate:  # Swimmer improving slower
                squad_comparison = 0.5  # Neutral to negative indicator
            else:
                squad_comparison = 0.75  # Average
            factors['squad_comparison_score'] = round(squad_comparison, 3)
        
        # Calculate improvement rate
        improvement_rate = PredictionService.calculate_improvement_per_attempt(all_times)
        factors['improvement_rate'] = round(improvement_rate, 4)
        
        # Calculate consistency (standard deviation of recent times)
        recent_times = all_times[-5:]  # Last 5 attempts
        if len(recent_times) >= 3:
            std_dev = statistics.stdev(recent_times)
            # Normalize consistency to 0-1 scale (lower std = higher consistency)
            # Use 10% of best time as max acceptable variance for scoring
            max_variance = current_best * 0.10
            consistency_score = max(0, min(1, 1 - (std_dev / max_variance)))
            factors['consistency'] = round(consistency_score, 3)
        else:
            factors['consistency'] = 0.5
        
        # Calculate recent form (are recent times better than earlier times?)
        if len(all_times) >= 6:
            first_half = all_times[:len(all_times)//2]
            second_half = all_times[len(all_times)//2:]
            avg_first = statistics.mean(first_half)
            avg_second = statistics.mean(second_half)
            # Positive if improving (second half faster)
            form_improvement = avg_first - avg_second
            # Normalize to 0-1 scale
            form_score = min(1.0, max(0.0, 0.5 + (form_improvement / (current_best * 0.1))))
            factors['recent_form'] = round(form_score, 3)
        else:
            factors['recent_form'] = 0.5
        
        # Training volume factor - more recent attempts suggest more training
        # Last 30 days equivalent (assuming each attempt is roughly weekly)
        recent_attempt_count = len([t for t in all_times[-4:]])
        training_volume = min(1.0, recent_attempt_count / 4.0)
        factors['training_volume'] = round(training_volume, 3)
        
        # Personal best recency - how recent is the current best?
        # More recent PBs suggest swimmer is in good form
        try:
            pb_index = all_times.index(current_best)
            recency = (len(all_times) - pb_index) / len(all_times)
            factors['pb_recency'] = round(recency, 3)
        except ValueError:
            factors['pb_recency'] = 0.5
        
        # Predict future time
        predicted_time = PredictionService.predict_future_time(
            current_best=current_best,
            all_times=all_times,
            attempts_until_race=attempts_until_target
        )
        
        if predicted_time is None:
            predicted_time = current_best
        
        # Extract distance and stroke from event EARLY for stricter caps
        # Event format: "100m Free Swim SCM" or similar
        event_distance = None
        event_stroke = None
        try:
            parts = event.lower().split()
            event_distance = int(parts[0].replace('m', ''))
            event_stroke = parts[1] if len(parts) > 1 else "free"
        except (ValueError, IndexError):
            pass  # Will use default caps
        
        # Apply STRICTER caps for swimmers far from elite BEFORE multipliers
        if event_distance and event_stroke:
            try:
                limits = PredictionService.get_physiological_limits(event_distance, event_stroke)
                elite_ratio = current_best / limits["elite_time"]
                
                # More conservative caps based on distance from elite
                if elite_ratio > 2.0:
                    # Very beginner swimmers - cap at 3%
                    max_allowed_improvement = current_best * 0.03
                elif elite_ratio > 1.5:
                    # Intermediate swimmers - cap at 4%
                    max_allowed_improvement = current_best * 0.04
                else:
                    # Advanced swimmers - cap at 5%
                    max_allowed_improvement = current_best * 0.05
                
                # Apply the cap
                actual_improvement = current_best - predicted_time
                if actual_improvement > max_allowed_improvement:
                    predicted_time = current_best - max_allowed_improvement
                    factors['pre_multiplier_cap_applied'] = True
                    factors['max_allowed_improvement_seconds'] = round(max_allowed_improvement, 2)
            except Exception:
                pass  # Continue without early cap
        
        # Adjust prediction based on attendance if available
        if attendance_rate is not None:
            # Good attendance (>70%) suggests swimmer will achieve or exceed prediction
            # Poor attendance (<50%) suggests slower improvement
            if attendance_rate >= 70:
                # High attendance: use prediction as-is or be slightly more optimistic
                attendance_multiplier = 1.0
            elif attendance_rate >= 50:
                # Medium attendance: temper optimism slightly
                # Scale from 0.95 at 70% down to 0.90 at 50%
                attendance_multiplier = 0.95 - ((70 - attendance_rate) / 20.0) * 0.05
            else:
                # Low attendance: be more conservative
                # Scale from 0.90 at 50% down to 0.80 at 0%
                attendance_multiplier = 0.90 - ((50 - attendance_rate) / 50.0) * 0.10
            
            # Apply attendance adjustment to improvement
            # If prediction is faster than current (improvement), scale the improvement
            improvement = current_best - predicted_time
            if improvement > 0:  # Predicting improvement
                adjusted_improvement = improvement * attendance_multiplier
                predicted_time = current_best - adjusted_improvement
            # If predicting regression, don't make it worse based on attendance
        
        # Apply time-since-last-result adjustment
        # For age group swimmers with longer gaps, expect more improvement
        if days_since_last_result is not None and time_gap_multiplier != 1.0:
            improvement = current_best - predicted_time
            if improvement > 0:  # Predicting improvement
                # Amplify expected improvement based on time gap
                adjusted_improvement = improvement * time_gap_multiplier
                predicted_time = current_best - adjusted_improvement
                factors['time_gap_improvement_boost_seconds'] = round(adjusted_improvement - improvement, 3)
            # If predicting regression, don't apply multiplier (keep prediction as-is)
        
        # Extract distance and stroke from event name for physiological constraints
        # Event format: "100m Free Swim SCM" or similar
        try:
            parts = event.lower().split()
            distance = int(parts[0].replace('m', ''))
            stroke = parts[1] if len(parts) > 1 else "free"
            
            # Apply physiological constraints
            predicted_time = PredictionService.apply_physiological_constraints(
                predicted_time=predicted_time,
                current_best=current_best,
                distance=distance,
                stroke=stroke,
                all_times=all_times
            )
        except (ValueError, IndexError):
            # If we can't parse event, just use the raw prediction
            pass
        
        improvement_expected = current_best - predicted_time
        
        # Calculate confidence level with swimming-specific factors
        confidence_score = 0
        
        # Data quantity factor (0-30 points)
        if len(all_times) >= 10:
            confidence_score += 30
        elif len(all_times) >= 5:
            confidence_score += 20
        else:
            confidence_score += 10
        
        # Consistency factor (0-20 points)
        if 'consistency' in factors:
            confidence_score += factors['consistency'] * 20
        
        # Improvement trend clarity (0-15 points)
        if abs(improvement_rate) > 0.01:  # Clear trend
            confidence_score += 15
        elif abs(improvement_rate) > 0.001:  # Moderate trend
            confidence_score += 10
        else:  # Minimal trend
            confidence_score += 5
        
        # Training volume factor (0-10 points)
        if 'training_volume' in factors:
            confidence_score += factors['training_volume'] * 10
        
        # PB recency factor (0-10 points) - recent PBs indicate good form
        if 'pb_recency' in factors:
            confidence_score += factors['pb_recency'] * 10
        
        # Attendance factor (0-15 points) - training consistency
        if attendance_rate is not None:
            # High attendance (>80%) gives full 15 points
            # Medium attendance (60-80%) gives 10 points
            # Low attendance (<60%) gives 0-9 points proportionally
            if attendance_rate >= 80:
                confidence_score += 15
            elif attendance_rate >= 60:
                confidence_score += 10
            else:
                # Scale from 0 at 0% to 10 at 60%
                confidence_score += (attendance_rate / 60.0) * 10
        
        # Squad comparison factor (0-10 points) - performance relative to training partners
        if squad_improvement_rate is not None and 'squad_comparison_score' in factors:
            confidence_score += factors['squad_comparison_score'] * 10
        
        # Workout alignment factor (0-15 points) - training appropriateness for event
        if recent_workouts is not None and len(recent_workouts) > 0:
            alignment_score = PredictionService._calculate_training_alignment(
                event=event,
                workouts=recent_workouts
            )
            factors['training_alignment'] = round(alignment_score, 3)
            confidence_score += alignment_score * 15
            
            # Add workout volume factor
            total_training_meters = sum(w.total_meters for w in recent_workouts)
            factors['recent_training_volume_meters'] = round(total_training_meters, 0)
            
            # Add workout intensity factor
            avg_effort = statistics.mean([
                w.effort_level for w in recent_workouts 
                if w.effort_level is not None
            ]) if any(w.effort_level is not None for w in recent_workouts) else None
            
            if avg_effort is not None:
                factors['avg_workout_effort'] = round(avg_effort, 1)
        
        # Determine confidence level (adjusted max score with workout data: 110)
        max_possible_score = 110 if recent_workouts else 95
        
        if confidence_score >= (max_possible_score * 0.64):  # ~70 or 70+ with workouts
            confidence_level = "high"
        elif confidence_score >= (max_possible_score * 0.37):  # ~40 or 40+ with workouts
            confidence_level = "medium"
        else:
            confidence_level = "low"
        
        return ImprovementPrediction(
            event=event,
            current_best=round(current_best, 2),
            predicted_time=round(predicted_time, 2),
            confidence_level=confidence_level,
            improvement_expected=round(improvement_expected, 2),
            factors=factors
        )
    
    @staticmethod
    def _calculate_training_alignment(
        event: str,
        workouts: List[WorkoutContext]
    ) -> float:
        """
        Calculate how well recent workouts align with event requirements.
        
        Returns alignment score (0-1) where 1.0 means perfect alignment.
        
        Args:
            event: Event name (e.g., "100m Free Swim SCM")
            workouts: List of recent workout contexts
            
        Returns:
            Alignment score 0-1
        """
        if not workouts:
            return 0.5  # Neutral score
        
        # Parse event distance
        try:
            parts = event.lower().split()
            distance = int(parts[0].replace('m', ''))
        except (ValueError, IndexError):
            return 0.5  # Can't parse, return neutral
        
        # Determine target workout profile based on event distance
        if distance < 100:
            target_profile = {'sprint': 0.6, 'mixed': 0.3, 'technique': 0.1, 'endurance': 0.0}
            target_effort_min = 7
            target_effort_max = 10
        elif distance <= 200:
            target_profile = {'sprint': 0.5, 'mixed': 0.3, 'technique': 0.1, 'endurance': 0.1}
            target_effort_min = 6
            target_effort_max = 9
        elif distance <= 400:
            target_profile = {'mixed': 0.5, 'endurance': 0.3, 'sprint': 0.1, 'technique': 0.1}
            target_effort_min = 5
            target_effort_max = 8
        else:  # 800m+
            target_profile = {'endurance': 0.6, 'mixed': 0.3, 'technique': 0.1, 'sprint': 0.0}
            target_effort_min = 3
            target_effort_max = 6
        
        # Calculate actual workout distribution
        workout_counts = {'sprint': 0, 'endurance': 0, 'technique': 0, 'mixed': 0}
        effort_scores = []
        
        for workout in workouts:
            workout_type = workout.workout_type.lower()
            if workout_type in workout_counts:
                workout_counts[workout_type] += 1
            
            # Score effort level alignment
            if workout.effort_level is not None:
                if target_effort_min <= workout.effort_level <= target_effort_max:
                    effort_scores.append(1.0)  # Perfect alignment
                elif target_effort_min - 2 <= workout.effort_level <= target_effort_max + 2:
                    effort_scores.append(0.7)  # Acceptable alignment
                else:
                    effort_scores.append(0.3)  # Poor alignment
        
        # Calculate workout type alignment score
        total_workouts = len(workouts)
        actual_profile = {
            k: v / total_workouts for k, v in workout_counts.items()
        }
        
        # Calculate profile similarity (0-1)
        profile_score = 1.0 - sum(
            abs(target_profile.get(k, 0) - actual_profile.get(k, 0))
            for k in set(target_profile.keys()) | set(actual_profile.keys())
        ) / 2.0
        
        # Calculate effort alignment score (0-1)
        effort_score = statistics.mean(effort_scores) if effort_scores else 0.5
        
        # Weighted combination: 60% workout type, 40% effort level
        alignment_score = (profile_score * 0.6) + (effort_score * 0.4)
        
        return max(0.0, min(1.0, alignment_score))
