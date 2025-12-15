"""Individual swimmer improvement prediction engine."""
from typing import Optional, List, Dict, Any
import statistics
from .models import ImprovementPrediction, WorkoutContext
from .statistical_analysis import (
    ImprovementAnalyzer,
    TrendPredictor,
    ConfidenceCalculator
)
from .physiological_constraints import (
    PhysiologicalLimits,
    ConstraintApplicator,
    AgeGroupAdjustments
)
from .training_analysis import (
    TrainingAlignmentAnalyzer,
    WorkoutVolumeAnalyzer
)


class ImprovementPredictorEngine:
    """Engine for predicting individual swimmer improvement."""
    
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
        
        Args:
            event: Event name (e.g., "100m Free Swim SCM")
            current_best: Current best time in seconds
            all_times: All historical times in chronological order (oldest first)
            attempts_until_target: Number of future attempts to predict (default 3)
            attendance_rate: Optional attendance percentage (0-100) for last 30 days
            squad_improvement_rate: Optional squad average improvement rate
            recent_workouts: Optional list of recent workout contexts
            days_since_last_result: Optional days since last competitive result
            swimmer_age: Optional swimmer age in years
            
        Returns:
            ImprovementPrediction with predicted time and confidence
        """
        factors = {}
        
        # Validate sufficient data
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
        
        # Calculate base factors
        improvement_rate = ImprovementAnalyzer.calculate_improvement_per_attempt(all_times)
        factors['improvement_rate'] = round(improvement_rate, 4)
        
        # Analyze attendance
        if attendance_rate is not None:
            factors['attendance_rate'] = round(attendance_rate, 1)
            factors['attendance_factor'] = round(attendance_rate / 100.0, 3)
        
        # Analyze time gap and age-group adjustments
        time_gap_multiplier = 1.0
        if days_since_last_result is not None and swimmer_age is not None:
            factors['days_since_last_result'] = days_since_last_result
            factors['swimmer_age'] = swimmer_age
            
            time_gap_multiplier, gap_category = AgeGroupAdjustments.get_time_gap_multiplier(
                days_since_last_result, swimmer_age
            )
            factors['time_gap_multiplier'] = round(time_gap_multiplier, 3)
            factors['time_gap_category'] = gap_category
        
        # Analyze squad comparison
        if squad_improvement_rate is not None:
            factors['squad_avg_improvement_rate'] = round(squad_improvement_rate, 4)
            squad_comparison = ImprovementPredictorEngine._calculate_squad_comparison(
                improvement_rate, squad_improvement_rate
            )
            factors['squad_comparison_score'] = round(squad_comparison, 3)
        
        # Calculate consistency
        consistency_score = ImprovementPredictorEngine._calculate_consistency_score(
            all_times, current_best
        )
        factors['consistency'] = round(consistency_score, 3)
        
        # Calculate recent form
        recent_form_score = ImprovementAnalyzer.calculate_recent_form(all_times)
        factors['recent_form'] = round(recent_form_score, 3)
        
        # Calculate training volume
        training_volume = min(1.0, len(all_times[-4:]) / 4.0)
        factors['training_volume'] = round(training_volume, 3)
        
        # Calculate PB recency
        pb_recency = ImprovementPredictorEngine._calculate_pb_recency(
            all_times, current_best
        )
        factors['pb_recency'] = round(pb_recency, 3)
        
        # Generate base prediction
        predicted_time = TrendPredictor.predict_future_time(
            current_best=current_best,
            all_times=all_times,
            attempts_until_race=attempts_until_target
        )
        
        if predicted_time is None:
            predicted_time = current_best
        
        # Parse event details for constraints
        distance, stroke = ImprovementPredictorEngine._parse_event_details(event)
        
        # Apply early caps based on skill level
        if distance and stroke:
            predicted_time = ImprovementPredictorEngine._apply_early_caps(
                predicted_time=predicted_time,
                current_best=current_best,
                distance=distance,
                stroke=stroke,
                factors=factors
            )
        
        # Apply attendance adjustment
        if attendance_rate is not None:
            predicted_time = ImprovementPredictorEngine._apply_attendance_adjustment(
                predicted_time=predicted_time,
                current_best=current_best,
                attendance_rate=attendance_rate
            )
        
        # Apply time gap adjustment
        if time_gap_multiplier != 1.0:
            predicted_time = ImprovementPredictorEngine._apply_time_gap_adjustment(
                predicted_time=predicted_time,
                current_best=current_best,
                multiplier=time_gap_multiplier,
                factors=factors
            )
        
        # Apply physiological constraints
        if distance and stroke:
            predicted_time = ConstraintApplicator.apply_constraints(
                predicted_time=predicted_time,
                current_best=current_best,
                distance=distance,
                stroke=stroke,
                all_times=all_times
            )
        
        # Analyze training alignment
        if recent_workouts:
            ImprovementPredictorEngine._add_training_factors(
                event, recent_workouts, factors
            )
        
        # Calculate confidence
        confidence_level, confidence_score = ConfidenceCalculator.calculate_improvement_confidence(
            data_points=len(all_times),
            consistency_score=consistency_score,
            improvement_rate=abs(improvement_rate),
            training_volume=training_volume,
            pb_recency=pb_recency,
            attendance_rate=attendance_rate,
            has_squad_data=squad_improvement_rate is not None,
            has_workout_data=recent_workouts is not None and len(recent_workouts) > 0
        )
        
        improvement_expected = current_best - predicted_time
        
        return ImprovementPrediction(
            event=event,
            current_best=round(current_best, 2),
            predicted_time=round(predicted_time, 2),
            confidence_level=confidence_level,
            improvement_expected=round(improvement_expected, 2),
            factors=factors
        )
    
    @staticmethod
    def _calculate_squad_comparison(
        swimmer_rate: float,
        squad_rate: float
    ) -> float:
        """Calculate squad comparison score."""
        if swimmer_rate < squad_rate:
            return 1.0  # Swimmer improving faster
        elif swimmer_rate > squad_rate:
            return 0.5  # Swimmer improving slower
        else:
            return 0.75  # Average
    
    @staticmethod
    def _calculate_consistency_score(
        all_times: List[float],
        current_best: float
    ) -> float:
        """Calculate consistency score from recent times."""
        recent_times = all_times[-5:]
        if len(recent_times) < 3:
            return 0.5
        
        std_dev = ImprovementAnalyzer.calculate_consistency(recent_times)
        max_variance = current_best * 0.10
        return max(0, min(1, 1 - (std_dev / max_variance)))
    
    @staticmethod
    def _calculate_pb_recency(
        all_times: List[float],
        current_best: float
    ) -> float:
        """Calculate how recent the personal best is."""
        try:
            pb_index = all_times.index(current_best)
            return (len(all_times) - pb_index) / len(all_times)
        except ValueError:
            return 0.5
    
    @staticmethod
    def _parse_event_details(event: str) -> tuple[Optional[int], Optional[str]]:
        """Parse distance and stroke from event name."""
        try:
            parts = event.lower().split()
            distance = int(parts[0].replace('m', ''))
            stroke = parts[1] if len(parts) > 1 else "free"
            return distance, stroke
        except (ValueError, IndexError):
            return None, None
    
    @staticmethod
    def _apply_early_caps(
        predicted_time: float,
        current_best: float,
        distance: int,
        stroke: str,
        factors: Dict[str, Any]
    ) -> float:
        """Apply early skill-level based caps."""
        try:
            limits = PhysiologicalLimits.get_limits(distance, stroke)
            elite_ratio = current_best / limits["elite_time"]
            
            if elite_ratio > 2.0:
                max_allowed = current_best * 0.03
            elif elite_ratio > 1.5:
                max_allowed = current_best * 0.04
            else:
                max_allowed = current_best * 0.05
            
            actual_improvement = current_best - predicted_time
            if actual_improvement > max_allowed:
                predicted_time = current_best - max_allowed
                factors['pre_multiplier_cap_applied'] = True
                factors['max_allowed_improvement_seconds'] = round(max_allowed, 2)
        except Exception:
            pass
        
        return predicted_time
    
    @staticmethod
    def _apply_attendance_adjustment(
        predicted_time: float,
        current_best: float,
        attendance_rate: float
    ) -> float:
        """Apply attendance-based adjustment to prediction."""
        if attendance_rate >= 70:
            multiplier = 1.0
        elif attendance_rate >= 50:
            multiplier = 0.95 - ((70 - attendance_rate) / 20.0) * 0.05
        else:
            multiplier = 0.90 - ((50 - attendance_rate) / 50.0) * 0.10
        
        improvement = current_best - predicted_time
        if improvement > 0:
            adjusted_improvement = improvement * multiplier
            predicted_time = current_best - adjusted_improvement
        
        return predicted_time
    
    @staticmethod
    def _apply_time_gap_adjustment(
        predicted_time: float,
        current_best: float,
        multiplier: float,
        factors: Dict[str, Any]
    ) -> float:
        """Apply time gap multiplier adjustment."""
        improvement = current_best - predicted_time
        if improvement > 0:
            adjusted_improvement = improvement * multiplier
            predicted_time = current_best - adjusted_improvement
            factors['time_gap_improvement_boost_seconds'] = round(
                adjusted_improvement - improvement, 3
            )
        
        return predicted_time
    
    @staticmethod
    def _add_training_factors(
        event: str,
        workouts: List[WorkoutContext],
        factors: Dict[str, Any]
    ):
        """Add training-related factors to prediction."""
        alignment_score = TrainingAlignmentAnalyzer.calculate_alignment(event, workouts)
        factors['training_alignment'] = round(alignment_score, 3)
        
        total_volume = WorkoutVolumeAnalyzer.calculate_total_volume(workouts)
        factors['recent_training_volume_meters'] = round(total_volume, 0)
        
        avg_effort = WorkoutVolumeAnalyzer.calculate_average_effort(workouts)
        if avg_effort is not None:
            factors['avg_workout_effort'] = round(avg_effort, 1)
