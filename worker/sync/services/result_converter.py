"""
Result converter service - single responsibility: data transformation only
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from worker.models import WorkoutResult, ResultWithSplits, AttemptData, RaceSplit
from worker.constants import get_stroke_enum

logger = logging.getLogger('result_converter')


class ResultConverter:
    """
    Converts raw data to domain models
    Single responsibility: data transformation, no side effects
    """
    
    @staticmethod
    def normalize_course(course_str: str) -> str:
        """
        Convert course string to standardized enum value (LCM or SCM)
        
        Args:
            course_str: Course string (e.g., "LONG COURSE (50M)", "lcm", "50m", etc.)
            
        Returns:
            Standardized course code: "LCM" or "SCM"
        """
        if not course_str:
            return "LCM"  # Default to LCM
        
        course_lower = course_str.lower().strip()
        
        # Check for long course indicators
        if any(x in course_lower for x in ['long', '50m', 'lcm']):
            return "LCM"
        
        # Check for short course indicators
        if any(x in course_lower for x in ['short', '25m', 'scm']):
            return "SCM"
        
        # Default to LCM if uncertain
        logger.warning(f"Could not determine course from: {course_str}, defaulting to LCM")
        return "LCM"
    
    @staticmethod
    def parse_date(date_str: str) -> str:
        """
        Parse date string to ISO format (YYYY-MM-DD)
        Handles multiple formats and non-breaking spaces
        
        Args:
            date_str: Date string in various formats (e.g., "22 Nov 2024", "22\xa0Nov\xa02024")
            
        Returns:
            ISO format date string (YYYY-MM-DD) or original if unparseable
        """
        if not date_str or not str(date_str).strip():
            return ""
        
        # Normalize: replace non-breaking spaces and extra whitespace
        normalized = str(date_str).strip().replace('\xa0', ' ').replace('  ', ' ')
        
        # Try multiple date formats
        formats = [
            '%d %b %Y',      # "22 Nov 2024"
            '%d %B %Y',      # "22 November 2024"
            '%d/%m/%Y',      # "22/11/2024"
            '%d-%m-%Y',      # "22-11-2024"
            '%d.%m.%Y',      # "22.11.2024"
            '%Y-%m-%d',      # "2024-11-22"
        ]
        
        for fmt in formats:
            try:
                parsed = datetime.strptime(normalized, fmt)
                return parsed.strftime('%Y-%m-%d')
            except ValueError:
                continue
        
        # If parsing fails, try to return as-is and let DB handle it
        logger.warning(f"Could not parse date '{date_str}', returning normalized string")
        return normalized
    
    @staticmethod
    def attempt_to_workout_result(
        attempt_data: AttemptData,
        result_with_splits: ResultWithSplits,
        swimmer_id: str,
        distance: int,
        stroke: str
    ) -> WorkoutResult:
        """
        Convert a single attempt to WorkoutResult
        Gracefully handles cases where splits are not available from SwimRankings
        
        Args:
            attempt_data: Raw attempt data from scraper
            result_with_splits: Result with splits info
            swimmer_id: Database swimmer ID
            distance: Event distance
            stroke: Event stroke
            
        Returns:
            WorkoutResult object
        """
        result_units = attempt_data.course.upper()  # LCM or SCM
        
        # Log if splits aren't available for this result
        if not result_with_splits.has_splits_available:
            logger.debug(
                f"Result {attempt_data.result_id} ({distance}{stroke} {result_units}): "
                f"Splits not available from SwimRankings"
            )
        
        return WorkoutResult(
            swimmer_id=swimmer_id,
            distance=distance,
            stroke=stroke,  # type: ignore
            time_result=attempt_data.time,
            result_units=result_units,  # type: ignore
            performed_on=ResultConverter.parse_date(attempt_data.date),
            meet_name=attempt_data.meet_name,
            meet_city=attempt_data.location,
            meet_nation=None,  # Not available from scraper
            source='swimrankings',
            swimrankings_result_id=attempt_data.result_id,
            reaction_time=result_with_splits.reaction_time,
            activity='swim',
            equipment='none',
            has_splits_available=result_with_splits.has_splits_available
        )
    
    @staticmethod
    def batch_convert_attempts(
        results_with_splits: List[ResultWithSplits],
        swimmer_id: str,
        distance: int,
        stroke: str
    ) -> List[WorkoutResult]:
        """
        Convert multiple attempts to WorkoutResult objects
        
        Args:
            results_with_splits: List of ResultWithSplits from scraper
            swimmer_id: Database swimmer ID
            distance: Event distance
            stroke: Event stroke
            
        Returns:
            List of WorkoutResult objects
        """
        workout_results = []
        
        for result_with_splits in results_with_splits:
            workout_result = ResultConverter.attempt_to_workout_result(
                result_with_splits.attempt,
                result_with_splits,
                swimmer_id,
                distance,
                stroke
            )
            workout_results.append(workout_result)
        
        logger.debug(f"Converted {len(results_with_splits)} attempts to WorkoutResult objects")
        return workout_results
    
    @staticmethod
    def event_name_to_metadata(event_name: str) -> Dict[str, Any]:
        """
        Parse event name into distance and stroke
        
        Args:
            event_name: Event name (e.g., "100 Freestyle")
            
        Returns:
            Dictionary with distance and stroke
        """
        # Simplified parsing - actual impl uses constants
        parts = event_name.strip().split()
        
        if len(parts) < 2:
            logger.warning(f"Could not parse event name: {event_name}")
            return {'distance': 0, 'stroke': 'free'}
        
        try:
            # Handle both "200 Freestyle" and "200m Freestyle" formats
            distance_str = parts[0].rstrip('m')
            distance = int(distance_str)
        except ValueError:
            logger.warning(f"Could not parse distance from: {event_name}")
            distance = 0
        
        stroke_name = ' '.join(parts[1:]).lower().replace('stroke', '')
        
        # Map common names to standardized stroke
        stroke_map = {
            'free': 'free',
            'freestyle': 'free',
            'back': 'back',
            'backstroke': 'back',
            'breast': 'breast',
            'breaststroke': 'breast',
            'fly': 'fly',
            'butterfly': 'fly',
            'im': 'im',
            'individual medley': 'im',
            'medley': 'im',
        }
        
        stroke = stroke_map.get(stroke_name, 'free')
        
        return {
            'distance': distance,
            'stroke': stroke,
            'stroke_enum': get_stroke_enum(stroke)
        }
