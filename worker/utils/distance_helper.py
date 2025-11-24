"""
Distance and split optimization utilities
Single Responsibility: Determine event distances and split availability
"""

from typing import Dict


class DistanceHelper:
    """Helper for determining event distances from style IDs"""
    
    # Style ID to distance mapping (from SwimRankings.net)
    STYLE_DISTANCE_MAP: Dict[int, int] = {
        # 25m events
        47: 25, 48: 25, 49: 25, 50: 25,
        
        # 50m events
        1: 50,   # Freestyle
        9: 50,   # Backstroke
        12: 50,  # Breaststroke
        15: 50,  # Butterfly
        
        # 100m events
        2: 100,  # Freestyle
        10: 100, # Backstroke
        13: 100, # Breaststroke
        16: 100, # Butterfly
        20: 100, # Individual Medley
        
        # 200m events
        3: 200,  # Freestyle
        11: 200, # Backstroke
        14: 200, # Breaststroke
        17: 200, # Butterfly
        18: 200, # Individual Medley
        
        # 400m events
        5: 400,  # Freestyle
        19: 400, # Individual Medley
        
        # 800m events
        6: 800,  # Freestyle
        
        # 1500m events
        8: 1500, # Freestyle
    }
    
    @staticmethod
    def get_event_distance(style_id: int) -> int:
        """
        Get event distance in meters from style ID
        
        Args:
            style_id: SwimRankings style ID (1-50)
            
        Returns:
            Distance in meters, or 0 if unknown
        """
        return DistanceHelper.STYLE_DISTANCE_MAP.get(style_id, 0)
    
    @staticmethod
    def should_fetch_splits(style_id: int) -> bool:
        """
        Determine if splits should be fetched for this event
        
        Events <= 50m typically don't have splits data on SwimRankings.
        
        Args:
            style_id: SwimRankings style ID
            
        Returns:
            True if splits should be fetched, False otherwise
        """
        distance = DistanceHelper.get_event_distance(style_id)
        
        # Unknown distance - fetch splits to be safe
        if distance == 0:
            return True
        
        # Skip splits for 25m and 50m events
        return distance > 50
