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
    # Note: 100m IM is SCM only, not syncing LCM
    '100m Individual Medley': '20',
    '200m Individual Medley': '18',
    '400m Individual Medley': '19',
    
    # 25m events excluded from sync
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
    """Get stroke enum from stroke name
    
    Args:
        stroke_name: Stroke name (e.g., 'Freestyle', 'freestyle', 'Backstroke')
        
    Returns:
        Stroke enum value: 'free', 'back', 'breast', 'fly', 'im'
        Defaults to 'free' if stroke not recognized
    """
    import logging
    logger = logging.getLogger(__name__)
    
    # Accept both capitalized and lowercase versions
    if not stroke_name:
        logger.warning("get_stroke_enum called with empty stroke_name, defaulting to 'free'")
        return 'free'
    
    # Try exact match first
    result = STROKE_NAME_TO_ENUM.get(stroke_name)
    if result:
        logger.debug(f"get_stroke_enum('{stroke_name}') -> '{result}' (exact match)")
        return result
    
    # Try capitalized version (capitalize first letter of each word for compound names)
    capitalized = ' '.join(word.capitalize() for word in stroke_name.split())
    result = STROKE_NAME_TO_ENUM.get(capitalized)
    if result:
        logger.debug(f"get_stroke_enum('{stroke_name}') -> '{result}' (capitalized match: '{capitalized}')")
        return result
    
    # Default to freestyle if not found
    logger.warning(f"get_stroke_enum('{stroke_name}') -> 'free' (not found, using default)")
    return 'free'


def get_all_event_keys() -> set:
    """
    Get all possible event keys (distance_stroke_course combinations)
    
    Returns:
        Set of event keys in format: "{distance}_{stroke}_{course}"
        Example: "100_free_LCM", "200_back_SCM"
    """
    event_keys = set()
    courses = ['LCM', 'SCM']
    
    for event_name in SWIMRANKINGS_STYLE_IDS.keys():
        # Parse distance from event name (e.g., "100m Freestyle" -> 100)
        parts = event_name.split('m ')
        if len(parts) != 2:
            continue
        
        distance = int(parts[0])
        stroke_name = parts[1]
        
        stroke_enum = get_stroke_enum(stroke_name)
        
        if not stroke_enum:
            continue
        
        # Generate event key for both LCM and SCM
        for course in courses:
            # Skip 100m IM LCM (doesn't exist), but allow 100m IM SCM
            if distance == 100 and stroke_name == 'Individual Medley' and course == 'LCM':
                continue
            
            event_key = f"{distance}_{stroke_enum}_{course}"
            event_keys.add(event_key)
    
    return event_keys


def parse_event_key(event_name: str, course: str) -> Optional[str]:
    """
    Parse event name and course into event key format
    
    Args:
        event_name: Event name (e.g., "100m Freestyle")
        course: Course type (LCM or SCM)
        
    Returns:
        Event key in format "{distance}_{stroke}_{course}" or None if invalid
    """
    parts = event_name.split('m ')
    if len(parts) != 2:
        return None
    
    distance = int(parts[0])
    stroke_name = parts[1]
    stroke_enum = get_stroke_enum(stroke_name)
    
    if not stroke_enum:
        return None
    
    return f"{distance}_{stroke_enum}_{course}"
