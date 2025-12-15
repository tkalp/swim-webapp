"""Physiological constraint modeling for realistic swimming predictions."""
from typing import Dict, List, Optional


class PhysiologicalLimits:
    """Elite performance benchmarks and physiological constraints."""
    
    # Elite times based on world records and top performances (approximate)
    ELITE_TIMES = {
        50: {"free": 20.9, "back": 23.7, "breast": 25.9, "fly": 22.2, "im": 24.0},
        100: {"free": 46.8, "back": 51.6, "breast": 56.9, "fly": 49.8, "im": 51.3},
        200: {"free": 102.0, "back": 111.5, "breast": 125.9, "fly": 110.7, "im": 113.0},
        400: {"free": 220.0, "back": 240.0, "breast": 270.0, "fly": 240.0, "im": 240.0},
        800: {"free": 450.0, "back": 500.0, "breast": 540.0, "fly": 500.0, "im": 500.0},
        1500: {"free": 870.0, "back": 970.0, "breast": 1020.0, "fly": 970.0, "im": 970.0}
    }
    
    # Maximum improvement rates by skill level
    MAX_IMPROVEMENT_BEGINNER = 0.03   # 3% for beginners (>200% of elite)
    MAX_IMPROVEMENT_INTERMEDIATE = 0.04  # 4% for intermediate (150-200% of elite)
    MAX_IMPROVEMENT_ADVANCED = 0.05   # 5% for advanced (<150% of elite)
    
    # Diminishing returns threshold (115% of elite time)
    DIMINISHING_THRESHOLD_MULTIPLIER = 1.15
    
    # Absolute floor: can't predict faster than 95% of elite time
    ABSOLUTE_LIMIT_MULTIPLIER = 0.95
    
    @classmethod
    def get_elite_time(cls, distance: int, stroke: str) -> float:
        """Get elite time for event.
        
        Args:
            distance: Event distance in meters
            stroke: Stroke type
            
        Returns:
            Elite time in seconds
        """
        stroke_key = cls._normalize_stroke_name(stroke)
        return cls.ELITE_TIMES.get(distance, {}).get(stroke_key, 60.0)
    
    @classmethod
    def get_limits(cls, distance: int, stroke: str) -> Dict[str, float]:
        """Get physiological limits for an event.
        
        Returns:
            Dict with elite_time, diminishing_threshold, and max_improvement_rate
        """
        elite = cls.get_elite_time(distance, stroke)
        
        return {
            "elite_time": elite,
            "diminishing_threshold": elite * cls.DIMINISHING_THRESHOLD_MULTIPLIER,
            "max_improvement_rate": cls.MAX_IMPROVEMENT_ADVANCED
        }
    
    @staticmethod
    def _normalize_stroke_name(stroke: str) -> str:
        """Normalize stroke name for lookup."""
        stroke_lower = stroke.lower()
        
        if stroke_lower in ['im', 'individualmedley', 'individual medley', 'medley']:
            return "im"
        elif stroke_lower.startswith('free'):
            return "free"
        elif stroke_lower.startswith('back'):
            return "back"
        elif stroke_lower.startswith('brea'):
            return "breast"
        elif stroke_lower.startswith('fly') or stroke_lower.startswith('butt'):
            return "fly"
        else:
            return "free"


class ConstraintApplicator:
    """Apply physiological constraints to predictions."""
    
    @staticmethod
    def apply_constraints(
        predicted_time: float,
        current_best: float,
        distance: int,
        stroke: str,
        all_times: Optional[List[float]] = None
    ) -> float:
        """Apply physiological limits to predicted time.
        
        Accounts for:
        - Diminishing returns near elite performance
        - Maximum realistic improvement rates by skill level
        - Distance-specific fatigue curves
        - Terminal velocity constraints
        
        Args:
            predicted_time: Raw predicted time
            current_best: Current best time
            distance: Event distance in meters
            stroke: Stroke type
            all_times: Historical times for pace analysis
            
        Returns:
            Constrained predicted time
        """
        limits = PhysiologicalLimits.get_limits(distance, stroke)
        
        # Calculate improvement
        improvement = current_best - predicted_time
        improvement_pct = improvement / current_best
        
        # Apply skill-level-based caps
        elite_ratio = current_best / limits["elite_time"]
        max_rate = ConstraintApplicator._get_max_improvement_rate(elite_ratio)
        
        if improvement_pct > max_rate:
            predicted_time = current_best * (1 - max_rate)
            improvement = current_best - predicted_time
        
        # Apply diminishing returns near elite performance
        if current_best <= limits["diminishing_threshold"]:
            predicted_time = ConstraintApplicator._apply_diminishing_returns(
                predicted_time=predicted_time,
                current_best=current_best,
                improvement=improvement,
                elite_time=limits["elite_time"],
                threshold=limits["diminishing_threshold"]
            )
        
        # Apply distance-based fatigue constraints
        predicted_time = ConstraintApplicator._apply_distance_constraints(
            predicted_time=predicted_time,
            current_best=current_best,
            distance=distance
        )
        
        # Apply pace reality checks
        if all_times and len(all_times) >= 3:
            predicted_time = ConstraintApplicator._apply_pace_constraints(
                predicted_time=predicted_time,
                current_best=current_best,
                distance=distance
            )
        
        # Absolute floor
        absolute_limit = limits["elite_time"] * PhysiologicalLimits.ABSOLUTE_LIMIT_MULTIPLIER
        if predicted_time < absolute_limit:
            predicted_time = absolute_limit
        
        return predicted_time
    
    @staticmethod
    def _get_max_improvement_rate(elite_ratio: float) -> float:
        """Get maximum improvement rate based on skill level.
        
        Args:
            elite_ratio: Ratio of current time to elite time
            
        Returns:
            Maximum improvement rate (decimal)
        """
        if elite_ratio > 2.0:
            return PhysiologicalLimits.MAX_IMPROVEMENT_BEGINNER
        elif elite_ratio > 1.5:
            return PhysiologicalLimits.MAX_IMPROVEMENT_INTERMEDIATE
        else:
            return PhysiologicalLimits.MAX_IMPROVEMENT_ADVANCED
    
    @staticmethod
    def _apply_diminishing_returns(
        predicted_time: float,
        current_best: float,
        improvement: float,
        elite_time: float,
        threshold: float
    ) -> float:
        """Apply diminishing returns for swimmers near elite performance.
        
        Improvement becomes progressively harder as approaching elite times.
        """
        # Calculate proximity to elite (0 = at elite, 1 = at threshold)
        proximity_to_elite = (current_best - elite_time) / (threshold - elite_time)
        proximity_to_elite = max(0.0, min(1.0, proximity_to_elite))
        
        # Reduce improvement based on proximity
        # At threshold: 100% of improvement
        # At elite: 10% of improvement
        dampening_factor = 0.1 + (0.9 * proximity_to_elite)
        
        adjusted_improvement = improvement * dampening_factor
        return current_best - adjusted_improvement
    
    @staticmethod
    def _apply_distance_constraints(
        predicted_time: float,
        current_best: float,
        distance: int
    ) -> float:
        """Apply distance-specific improvement constraints.
        
        Longer distances have steeper diminishing returns.
        """
        if distance < 200:
            return predicted_time
        
        # Distance-based caps
        distance_caps = {
            200: 0.04,   # 4%
            400: 0.03,   # 3%
            800: 0.02,   # 2%
            1500: 0.02   # 2%
        }
        
        distance_cap = distance_caps.get(distance, 0.03)
        improvement = current_best - predicted_time
        improvement_pct = improvement / current_best
        
        if improvement_pct > distance_cap:
            predicted_time = current_best * (1 - distance_cap)
        
        return predicted_time
    
    @staticmethod
    def _apply_pace_constraints(
        predicted_time: float,
        current_best: float,
        distance: int
    ) -> float:
        """Apply pace reality constraints.
        
        Swimmers can't maintain sprint pace over distance events.
        """
        if distance < 200:
            return predicted_time
        
        # Expected pace slowdown relative to 100m pace
        expected_slowdown = {
            200: 0.075,   # 7.5% slower per meter
            400: 0.175,   # 17.5% slower per meter
            800: 0.25,    # 25% slower per meter
            1500: 0.30    # 30% slower per meter
        }.get(distance, 0.15)
        
        predicted_pace = predicted_time / distance
        base_100m_pace = current_best / distance * (1 / (1 + expected_slowdown))
        realistic_min_pace = base_100m_pace * (1 + expected_slowdown * 0.5)
        
        if predicted_pace < realistic_min_pace:
            predicted_time = realistic_min_pace * distance
        
        return predicted_time


class AgeGroupAdjustments:
    """Age-group specific adjustment factors."""
    
    @staticmethod
    def get_time_gap_multiplier(
        days_since_last_result: int,
        swimmer_age: int
    ) -> tuple[float, str]:
        """Calculate time gap adjustment multiplier.
        
        Age-group swimmers have more potential for improvement with longer gaps
        due to natural growth/development. Senior swimmers don't benefit as much.
        
        Args:
            days_since_last_result: Days since last competitive result
            swimmer_age: Swimmer age in years
            
        Returns:
            Tuple of (multiplier, category_description)
        """
        if swimmer_age < 18:
            # Age group swimmer
            if days_since_last_result <= 90:
                return 1.0, '0-3 months (normal)'
            elif days_since_last_result <= 180:
                # Scale from 1.0 at 90 days to 1.05 at 180 days
                multiplier = 1.0 + ((days_since_last_result - 90) / 90) * 0.05
                return multiplier, '3-6 months (modest growth expected)'
            elif days_since_last_result <= 365:
                # Scale from 1.05 at 180 days to 1.10 at 365 days
                multiplier = 1.05 + ((days_since_last_result - 180) / 185) * 0.05
                return multiplier, '6-12 months (moderate growth expected)'
            else:
                return 1.12, '12+ months (development expected)'
        else:
            # Senior swimmer (18+)
            if days_since_last_result <= 90:
                return 1.0, '0-3 months (normal)'
            elif days_since_last_result <= 180:
                return 1.02, '3-6 months (taper benefit possible)'
            else:
                # Long gaps might indicate detraining
                return 0.98, '6+ months (possible detraining)'
