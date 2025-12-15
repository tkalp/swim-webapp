"""Event relationship mapping and cross-event data supplementation."""
from typing import List, Dict, Any, Optional
from .time_utils import PoolConverter, TimeParser


class EventRelationshipMapper:
    """Map relationships between swimming events for data supplementation."""
    
    @staticmethod
    def get_related_event_keys(event_key: str) -> List[str]:
        """Get related event keys that can inform predictions.
        
        Related events are those with similar energy systems or stroke mechanics:
        - Adjacent distances in same stroke (50m ↔ 100m ↔ 200m)
        - Same distance in different strokes for medley events
        
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
        
        # Sprint events (50m): look at 100m
        if distance == 50:
            related.append(f"100_{stroke}_{pool_type}_{activity}")
        
        # 100m events: look at 50m and 200m
        elif distance == 100:
            related.append(f"50_{stroke}_{pool_type}_{activity}")
            related.append(f"200_{stroke}_{pool_type}_{activity}")
        
        # 200m events: look at 100m and 400m
        elif distance == 200:
            related.append(f"100_{stroke}_{pool_type}_{activity}")
            related.append(f"400_{stroke}_{pool_type}_{activity}")
            # For 200 back/breast/fly, also consider 200 IM
            if stroke in ['back', 'breast', 'fly']:
                related.append(f"200_im_{pool_type}_{activity}")
        
        # 400m events: look at 200m and 800m
        elif distance == 400:
            related.append(f"200_{stroke}_{pool_type}_{activity}")
            related.append(f"800_{stroke}_{pool_type}_{activity}")
            # For 400 free, also consider 400 IM
            if stroke == 'free':
                related.append(f"400_im_{pool_type}_{activity}")
        
        # 800m events: look at 400m and 1500m
        elif distance == 800:
            related.append(f"400_{stroke}_{pool_type}_{activity}")
            related.append(f"1500_{stroke}_{pool_type}_{activity}")
        
        # 1500m events: look at 800m
        elif distance == 1500:
            related.append(f"400_{stroke}_{pool_type}_{activity}")
            related.append(f"800_{stroke}_{pool_type}_{activity}")
        
        return related
    
    @staticmethod
    def get_cross_pool_event_key(event_key: str) -> Optional[str]:
        """Get equivalent event key in opposite pool type.
        
        Args:
            event_key: Event key in format "distance_stroke_pool_activity"
            
        Returns:
            Cross-pool event key, or None if not applicable
        """
        parts = event_key.split('_')
        if len(parts) < 4:
            return None
        
        distance_str, stroke, pool_type, activity = parts[0], parts[1], parts[2], parts[3]
        
        if pool_type == 'SCM':
            return f"{distance_str}_{stroke}_LCM_{activity}"
        elif pool_type == 'LCM':
            return f"{distance_str}_{stroke}_SCM_{activity}"
        
        return None


class EventDataExtractor:
    """Extract and process event-specific data from results."""
    
    @staticmethod
    def get_event_times(
        results: List[Dict[str, Any]],
        event_key: str
    ) -> List[float]:
        """Extract all times for a specific event in chronological order.
        
        Args:
            results: List of all results for a swimmer
            event_key: Event identifier (e.g., '100_free_scm_swim')
            
        Returns:
            List of times in seconds, chronologically ordered (oldest first)
        """
        event_times = []
        
        for result in results:
            result_key = EventDataExtractor.get_event_key_from_result(result)
            if result_key != event_key:
                continue
            
            time_seconds = EventDataExtractor._get_time_from_result(result)
            if time_seconds is not None:
                event_times.append({
                    'time': time_seconds,
                    'date': result.get('performed_on', '')
                })
        
        # Sort by date (oldest first)
        event_times.sort(key=lambda x: x['date'])
        
        return [t['time'] for t in event_times]
    
    @staticmethod
    def get_event_key_from_result(result: Dict[str, Any]) -> str:
        """Generate event key from result.
        
        Must match comparison_service format.
        
        Args:
            result: Result dictionary
            
        Returns:
            Event key in format "distance_stroke_pool_activity"
        """
        distance = result.get('distance')
        stroke = result.get('stroke')
        result_units = result.get('result_units', 'SCM')
        activity = result.get('activity', 'swim')
        
        return f"{distance}_{stroke}_{result_units}_{activity}"
    
    @staticmethod
    def _get_time_from_result(result: Dict[str, Any]) -> Optional[float]:
        """Extract time in seconds from result."""
        # Try pre-calculated time_seconds first
        if 'time_seconds' in result:
            return result['time_seconds']
        
        # Fall back to parsing time_result
        time_str = result.get('time_result', '')
        return TimeParser.parse_to_seconds(time_str)


class RelatedDataSupplementer:
    """Supplement event data with related event times."""
    
    @staticmethod
    def get_related_times(
        all_results: List[Dict[str, Any]],
        event_key: str,
        max_related: int = 3
    ) -> List[float]:
        """Get times from related events to supplement prediction data.
        
        Includes:
        - Adjacent distance events (scaled)
        - Cross-pool conversions (SCM ↔ LCM)
        
        Args:
            all_results: All results for a swimmer
            event_key: Target event key
            max_related: Maximum number of related times to return
            
        Returns:
            List of scaled times from related events
        """
        # Get related event keys
        related_keys = EventRelationshipMapper.get_related_event_keys(event_key)
        
        # Add cross-pool conversion
        cross_pool_key = EventRelationshipMapper.get_cross_pool_event_key(event_key)
        if cross_pool_key:
            related_keys.append(cross_pool_key)
        
        if not related_keys:
            return []
        
        # Extract target event info
        parts = event_key.split('_')
        if len(parts) < 4:
            return []
        
        try:
            target_distance = int(parts[0])
            target_pool = parts[2]
        except (ValueError, IndexError):
            return []
        
        related_times = []
        
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
                result_key = EventDataExtractor.get_event_key_from_result(result)
                if result_key == related_key:
                    time_seconds = EventDataExtractor._get_time_from_result(result)
                    if time_seconds:
                        scaled_time = RelatedDataSupplementer._scale_time(
                            time_seconds=time_seconds,
                            from_distance=related_distance,
                            to_distance=target_distance,
                            from_pool=related_pool,
                            to_pool=target_pool
                        )
                        
                        if scaled_time:
                            related_times.append(scaled_time)
        
        # Return limited number of related times
        return related_times[:max_related]
    
    @staticmethod
    def _scale_time(
        time_seconds: float,
        from_distance: int,
        to_distance: int,
        from_pool: str,
        to_pool: str
    ) -> Optional[float]:
        """Scale time from one event to another.
        
        Applies:
        - Pool conversion if same distance, different pool
        - Distance scaling if different distance (power law: T2 = T1 * (D2/D1)^1.06)
        
        Args:
            time_seconds: Original time
            from_distance: Source distance
            to_distance: Target distance
            from_pool: Source pool type
            to_pool: Target pool type
            
        Returns:
            Scaled time, or None if not applicable
        """
        scaled_time = time_seconds
        
        # Apply pool conversion if same distance, different pool
        if from_distance == to_distance and from_pool != to_pool:
            scaled_time = PoolConverter.convert(
                time_seconds=time_seconds,
                distance=from_distance,
                from_pool=from_pool,
                to_pool=to_pool
            )
        
        # Apply distance scaling if different distance
        elif from_distance != to_distance:
            scaling_factor = to_distance / from_distance
            # Power law for swimming: T2 = T1 * (D2/D1)^1.06
            scaled_time = time_seconds * (scaling_factor ** 1.06)
        
        return scaled_time
