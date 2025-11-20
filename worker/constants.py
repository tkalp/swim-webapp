"""
SwimRankings constants and mappings
"""

from typing import Dict, List, Optional

# Event name to styleId mapping (from SwimRankings)
SWIMRANKINGS_STYLE_IDS: Dict[str, str] = {
    # Freestyle
    '50m Freestyle': '1',
    '100m Freestyle': '2',
    '200m Freestyle': '3',
    '400m Freestyle': '5',
    '800m Freestyle': '6',
    '1500m Freestyle': '8',
    
    # Backstroke
    '50m Backstroke': '9',
    '100m Backstroke': '10',
    '200m Backstroke': '11',
    
    # Breaststroke
    '50m Breaststroke': '12',
    '100m Breaststroke': '13',
    '200m Breaststroke': '14',
    
    # Butterfly
    '50m Butterfly': '15',
    '100m Butterfly': '16',
    '200m Butterfly': '17',
    
    # Individual Medley
    '100m Individual Medley': '20',
    '200m Individual Medley': '18',
    '400m Individual Medley': '19',
    
    # 25m events
    '25m Freestyle': '47',
    '25m Backstroke': '48',
    '25m Breaststroke': '49',
    '25m Butterfly': '50',
}

# Reverse mapping for looking up event names
STYLE_ID_TO_EVENT: Dict[str, str] = {v: k for k, v in SWIMRANKINGS_STYLE_IDS.items()}

# Stroke name mappings
STROKE_NAME_TO_ENUM: Dict[str, str] = {
    'Freestyle': 'free',
    'Backstroke': 'back',
    'Breaststroke': 'breast',
    'Butterfly': 'fly',
    'Individual Medley': 'im'
}


def get_event_name(style_id: str) -> Optional[str]:
    """Get event name from styleId"""
    return STYLE_ID_TO_EVENT.get(style_id)


def get_style_id(event_name: str) -> Optional[str]:
    """Get styleId from event name"""
    return SWIMRANKINGS_STYLE_IDS.get(event_name)


def get_all_events() -> List[str]:
    """Get list of all supported event names"""
    return list(SWIMRANKINGS_STYLE_IDS.keys())


def get_stroke_enum(stroke_name: str) -> Optional[str]:
    """Get stroke enum from stroke name"""
    return STROKE_NAME_TO_ENUM.get(stroke_name)
