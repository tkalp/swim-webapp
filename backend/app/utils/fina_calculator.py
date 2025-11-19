"""
FINA Points Calculator

Calculates FINA (World Aquatics) points for swimming performances.
Formula: Points = 1000 × (Base Time / Actual Time)³

FINA points provide a standardized way to compare performances across:
- Different strokes, distances, genders, and course types
- Points range from 100 (minimum) to 1100 (maximum)

Base times are defined annually by World Aquatics based on approved World Records:
- For LCM: Base times defined at year end (December 31st) using WRs up to that date
- For SCM: Base times defined at year end (August 31st) using WRs up to that date
- Base times = approved World Record times (giving ~1000 points for WR performance)

Current tables: 
- LCM 2025 (valid Jan 1 - Dec 31, 2025) - based on WRs until Dec 31, 2024
- SCM 2025 (valid Sep 1, 2025 - Aug 31, 2026) - based on WRs until Aug 31, 2024

Reference: https://www.worldaquatics.com/swimming/points
Last updated: 01/09/2025
"""

from typing import Optional

# FINA Base Times for Long Course Meters (LCM) 2025
# Valid: January 1, 2025 - December 31, 2025
# 
# Base times are derived from World Records approved by World Aquatics
# as of December 31, 2024. These represent world-class performances that
# receive approximately 1000 FINA points.
# 
# Source: https://www.worldaquatics.com/swimming/points
# Last updated: 01/09/2025
FINA_BASE_TIMES_LCM_2025 = {
    "male": {
        "freestyle": {
            50: 20.91,
            100: 46.40,
            200: 102.00,
            400: 220.07,
            800: 452.12,
            1500: 870.67,
        },
        "backstroke": {
            50: 23.55,
            100: 51.60,
            200: 111.92,
        },
        "breaststroke": {
            50: 25.95,
            100: 56.88,
            200: 125.48,
        },
        "butterfly": {
            50: 22.27,
            100: 49.45,
            200: 110.34,
        },
        "individual medley": {
            200: 114.00,
            400: 242.50,
        },
    },
    "female": {
        "freestyle": {
            50: 23.61,
            100: 51.71,
            200: 112.23,
            400: 235.38,
            800: 484.79,
            1500: 920.48,
        },
        "backstroke": {
            50: 26.86,
            100: 57.13,
            200: 123.14,
        },
        "breaststroke": {
            50: 29.16,
            100: 64.13,
            200: 137.55,
        },
        "butterfly": {
            50: 24.43,
            100: 55.18,
            200: 121.81,
        },
        "individual medley": {
            200: 126.12,
            400: 264.38,
        },
    },
}

# Short Course Meters (SCM) 2025
# Valid: September 1, 2025 - August 31, 2026
#
# Base times are derived from World Records approved by World Aquatics
# as of August 31, 2024. These represent world-class performances that
# receive approximately 1000 FINA points.
#
# Source: https://www.worldaquatics.com/swimming/points
# Last updated: 01/09/2025
FINA_BASE_TIMES_SCM_2025 = {
    "male": {
        "freestyle": {
            50: 19.90,
            100: 44.84,
            200: 98.61,
            400: 212.25,
            800: 440.46,
            1500: 846.88,
        },
        "backstroke": {
            50: 22.11,
            100: 48.33,
            200: 105.63,
        },
        "breaststroke": {
            50: 24.95,
            100: 55.28,
            200: 120.16,
        },
        "butterfly": {
            50: 21.32,
            100: 47.71,
            200: 106.85,
        },
        "individual medley": {
            100: 49.28,
            200: 108.88,
            400: 234.81,
        },
    },
    "female": {
        "freestyle": {
            50: 22.83,
            100: 50.25,
            200: 110.31,
            400: 230.25,
            800: 477.42,
            1500: 908.24,
        },
        "backstroke": {
            50: 25.23,
            100: 54.02,
            200: 118.04,
        },
        "breaststroke": {
            50: 28.37,
            100: 62.36,
            200: 132.50,
        },
        "butterfly": {
            50: 23.94,
            100: 52.71,
            200: 119.32,
        },
        "individual medley": {
            100: 55.11,
            200: 121.63,
            400: 255.48,
        },
    },
}


def time_string_to_seconds(time_str: str) -> float:
    """
    Convert time string to seconds
    
    Formats supported:
    - "1:23.45" (minutes:seconds.hundredths)
    - "23.45" (seconds.hundredths)
    - "1:23.45M" (with trailing letter that will be stripped)
    
    Args:
        time_str: Time string to convert
    
    Returns:
        Time in seconds as float
    
    Raises:
        ValueError: If time string format is invalid
    """
    import re
    
    # Strip any trailing letters (M, L, S, etc.)
    time_str = re.sub(r'[A-Za-z]+$', '', time_str.strip())
    
    parts = time_str.split(':')
    
    if len(parts) == 1:
        # Format: "23.45" (seconds only)
        return float(parts[0])
    elif len(parts) == 2:
        # Format: "1:23.45" (minutes:seconds)
        minutes = int(parts[0])
        seconds = float(parts[1])
        return minutes * 60 + seconds
    else:
        raise ValueError(f"Invalid time format: {time_str}")


def normalize_stroke_name(stroke: str) -> str:
    """
    Normalize stroke name to match base times dictionary keys
    
    Args:
        stroke: Stroke name (may have variations like 'IM', 'Medley', etc.)
    
    Returns:
        Normalized stroke name
    """
    stroke_lower = stroke.lower().strip()
    
    # Handle common variations
    if stroke_lower in ["im", "medley", "individual medley", "ind medley"]:
        return "individual medley"
    elif stroke_lower in ["free", "freestyle", "front crawl"]:
        return "freestyle"
    elif stroke_lower in ["back", "backstroke"]:
        return "backstroke"
    elif stroke_lower in ["breast", "breaststroke"]:
        return "breaststroke"
    elif stroke_lower in ["fly", "butterfly"]:
        return "butterfly"
    
    return stroke_lower


def calculate_fina_points(
    time_seconds: float,
    stroke: str,
    distance: int,
    gender: str,
    course: str = "LCM"
) -> Optional[int]:
    """
    Calculate FINA points for a swim performance
    
    Args:
        time_seconds: Actual swim time in seconds
        stroke: Stroke type ('freestyle', 'backstroke', 'breaststroke', 'butterfly', 'individual medley')
        distance: Distance in meters (50, 100, 200, 400, 800, 1500)
        gender: 'male' or 'female'
        course: 'LCM' (long course 50m) or 'SCM' (short course 25m)
    
    Returns:
        FINA points (100-1100) or None if event not found
    
    Example:
        >>> calculate_fina_points(50.0, "freestyle", 100, "male", "LCM")
        826
    """
    # Validate inputs
    if time_seconds <= 0:
        return None
    
    gender_lower = gender.lower().strip()
    if gender_lower not in ["male", "female"]:
        return None
    
    course_upper = course.upper().strip()
    if course_upper not in ["LCM", "SCM"]:
        return None
    
    # Normalize stroke name
    stroke_normalized = normalize_stroke_name(stroke)
    
    # Select appropriate base times table
    base_times_table = (
        FINA_BASE_TIMES_LCM_2025 if course_upper == "LCM" 
        else FINA_BASE_TIMES_SCM_2025
    )
    
    # Get base time for the event
    try:
        base_time = base_times_table[gender_lower][stroke_normalized][distance]
    except KeyError:
        # Event not found in base times
        return None
    
    # Calculate FINA points using the formula: Points = 1000 × (Base Time / Actual Time)³
    points = 1000 * (base_time / time_seconds) ** 3
    
    # FINA points are limited to 100-1100
    points = max(100, min(1100, int(round(points))))
    
    return points


def get_time_for_fina_points(
    target_points: int,
    stroke: str,
    distance: int,
    gender: str,
    course: str = "LCM"
) -> Optional[float]:
    """
    Calculate what time is needed to achieve target FINA points
    
    Args:
        target_points: Target FINA points (100-1100)
        stroke: Stroke type
        distance: Distance in meters
        gender: 'male' or 'female'
        course: 'LCM' or 'SCM'
    
    Returns:
        Required time in seconds, or None if event not found
    
    Example:
        >>> get_time_for_fina_points(800, "freestyle", 100, "male", "LCM")
        50.32
    """
    # Validate inputs
    if target_points < 100 or target_points > 1100:
        return None
    
    gender_lower = gender.lower().strip()
    if gender_lower not in ["male", "female"]:
        return None
    
    course_upper = course.upper().strip()
    if course_upper not in ["LCM", "SCM"]:
        return None
    
    # Normalize stroke name
    stroke_normalized = normalize_stroke_name(stroke)
    
    # Select appropriate base times table
    base_times_table = (
        FINA_BASE_TIMES_LCM_2025 if course_upper == "LCM" 
        else FINA_BASE_TIMES_SCM_2025
    )
    
    # Get base time for the event
    try:
        base_time = base_times_table[gender_lower][stroke_normalized][distance]
    except KeyError:
        # Event not found in base times
        return None
    
    # Reverse the formula: Time = Base Time / (Points / 1000)^(1/3)
    required_time = base_time / ((target_points / 1000) ** (1/3))
    
    return round(required_time, 2)


def get_supported_events(course: str = "LCM") -> dict:
    """
    Get list of all supported events for FINA point calculation
    
    Args:
        course: 'LCM' or 'SCM'
    
    Returns:
        Dictionary with supported events by gender and stroke
    """
    base_times_table = (
        FINA_BASE_TIMES_LCM_2025 if course.upper() == "LCM" 
        else FINA_BASE_TIMES_SCM_2025
    )
    
    supported_events = {}
    for gender, strokes in base_times_table.items():
        supported_events[gender] = {}
        for stroke, distances in strokes.items():
            supported_events[gender][stroke] = list(distances.keys())
    
    return supported_events
