"""Training analysis and workout alignment calculations."""
from typing import List
import statistics
from .models import WorkoutContext


class TrainingAlignmentAnalyzer:
    """Analyze alignment between training and event requirements."""
    
    # Optimal workout profiles by event distance
    WORKOUT_PROFILES = {
        50: {
            'sprint': 0.6, 'mixed': 0.3, 'technique': 0.1, 'endurance': 0.0,
            'effort_min': 7, 'effort_max': 10
        },
        100: {
            'sprint': 0.5, 'mixed': 0.3, 'technique': 0.1, 'endurance': 0.1,
            'effort_min': 6, 'effort_max': 9
        },
        200: {
            'mixed': 0.5, 'endurance': 0.3, 'sprint': 0.1, 'technique': 0.1,
            'effort_min': 5, 'effort_max': 8
        },
        400: {
            'mixed': 0.5, 'endurance': 0.3, 'sprint': 0.1, 'technique': 0.1,
            'effort_min': 5, 'effort_max': 8
        },
        800: {
            'endurance': 0.6, 'mixed': 0.3, 'technique': 0.1, 'sprint': 0.0,
            'effort_min': 3, 'effort_max': 6
        },
        1500: {
            'endurance': 0.6, 'mixed': 0.3, 'technique': 0.1, 'sprint': 0.0,
            'effort_min': 3, 'effort_max': 6
        }
    }
    
    @classmethod
    def calculate_alignment(
        cls,
        event: str,
        workouts: List[WorkoutContext]
    ) -> float:
        """Calculate how well recent workouts align with event requirements.
        
        Returns alignment score (0-1) where 1.0 means perfect alignment.
        
        Args:
            event: Event name (e.g., "100m Free Swim SCM")
            workouts: List of recent workout contexts
            
        Returns:
            Alignment score 0-1
        """
        if not workouts:
            return 0.5
        
        # Parse event distance
        distance = cls._parse_event_distance(event)
        if distance is None:
            return 0.5
        
        # Get target profile
        target_profile = cls._get_target_profile(distance)
        if not target_profile:
            return 0.5
        
        # Calculate actual workout distribution
        workout_counts = {'sprint': 0, 'endurance': 0, 'technique': 0, 'mixed': 0}
        effort_scores = []
        
        for workout in workouts:
            workout_type = workout.workout_type.lower()
            if workout_type in workout_counts:
                workout_counts[workout_type] += 1
            
            # Score effort level alignment
            if workout.effort_level is not None:
                effort_scores.append(
                    cls._score_effort_alignment(
                        workout.effort_level,
                        target_profile['effort_min'],
                        target_profile['effort_max']
                    )
                )
        
        # Calculate workout type alignment
        total_workouts = len(workouts)
        actual_profile = {k: v / total_workouts for k, v in workout_counts.items()}
        
        # Calculate profile similarity (0-1)
        profile_score = cls._calculate_profile_similarity(target_profile, actual_profile)
        
        # Calculate effort alignment score
        effort_score = statistics.mean(effort_scores) if effort_scores else 0.5
        
        # Weighted combination: 60% workout type, 40% effort level
        alignment_score = (profile_score * 0.6) + (effort_score * 0.4)
        
        return max(0.0, min(1.0, alignment_score))
    
    @staticmethod
    def _parse_event_distance(event: str) -> int:
        """Parse distance from event name."""
        try:
            parts = event.lower().split()
            return int(parts[0].replace('m', ''))
        except (ValueError, IndexError):
            return None
    
    @classmethod
    def _get_target_profile(cls, distance: int) -> dict:
        """Get target workout profile for distance."""
        # Find closest distance in profile
        if distance <= 75:
            return cls.WORKOUT_PROFILES[50]
        elif distance <= 150:
            return cls.WORKOUT_PROFILES[100]
        elif distance <= 300:
            return cls.WORKOUT_PROFILES[200]
        elif distance <= 600:
            return cls.WORKOUT_PROFILES[400]
        elif distance <= 1200:
            return cls.WORKOUT_PROFILES[800]
        else:
            return cls.WORKOUT_PROFILES[1500]
    
    @staticmethod
    def _score_effort_alignment(
        effort_level: int,
        target_min: int,
        target_max: int
    ) -> float:
        """Score how well effort level aligns with target range."""
        if target_min <= effort_level <= target_max:
            return 1.0  # Perfect alignment
        elif target_min - 2 <= effort_level <= target_max + 2:
            return 0.7  # Acceptable alignment
        else:
            return 0.3  # Poor alignment
    
    @staticmethod
    def _calculate_profile_similarity(
        target_profile: dict,
        actual_profile: dict
    ) -> float:
        """Calculate similarity between target and actual workout profiles.
        
        Uses Manhattan distance normalized to 0-1 scale.
        """
        workout_types = ['sprint', 'endurance', 'technique', 'mixed']
        total_difference = sum(
            abs(target_profile.get(wt, 0) - actual_profile.get(wt, 0))
            for wt in workout_types
        )
        
        # Normalize: max possible difference is 2.0 (all in one type vs all in another)
        similarity = 1.0 - (total_difference / 2.0)
        return max(0.0, min(1.0, similarity))


class WorkoutVolumeAnalyzer:
    """Analyze training volume metrics."""
    
    @staticmethod
    def calculate_total_volume(workouts: List[WorkoutContext]) -> float:
        """Calculate total training volume in meters."""
        return sum(w.total_meters for w in workouts)
    
    @staticmethod
    def calculate_average_effort(workouts: List[WorkoutContext]) -> float:
        """Calculate average workout effort level."""
        efforts = [w.effort_level for w in workouts if w.effort_level is not None]
        return statistics.mean(efforts) if efforts else None
    
    @staticmethod
    def calculate_workout_frequency(workouts: List[WorkoutContext]) -> int:
        """Calculate number of workouts."""
        return len(workouts)
