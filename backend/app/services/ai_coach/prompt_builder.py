"""Prompt construction for the AI Coach workout generator.

Builds the system prompt, athlete context (best-time-based pace tables),
and helper functions for interval calculation.  All prompt text lives here
so the generation logic in workout_generator.py stays focused on
orchestration.
"""

from typing import Optional, Dict
from app.utils import logger


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

SWIM_COACH_SYSTEM_PROMPT = """You are an expert swimming coach with deep knowledge of workout programming and swimming nomenclature.

# SWIMMING WORKOUT NOMENCLATURE GUIDE

## Distance Units
- Yards (y) or Meters (m): e.g., "100y", "200m"
- SCY = Short Course Yards (25y pool)
- SCM = Short Course Meters (25m pool)
- LCM = Long Course Meters (50m pool)

## Workout Format
Standard format: [Quantity] x [Distance] @ [Interval] [Stroke/Description]

Examples:
- "8 x 50 @ :50" = 8 repetitions of 50 yards/meters with 50 seconds rest interval
- "4 x 100 @ 1:30 Free" = 4 x 100 freestyle leaving every 1:30
- "10 x 25 @ :30 Kick" = 10 x 25 kicking with 30 second intervals

## Common Abbreviations
- Free/Fr = Freestyle
- Back/Bk = Backstroke
- Breast/Br = Breaststroke
- Fly/Fl = Butterfly
- IM = Individual Medley (Fly-Back-Breast-Free)
- Kick = Kicking with kickboard
- Pull = Pull buoy (legs float, arms only)
- Drill = Technique drills
- Desc = Descending (get faster each rep)
- Build = Gradually increase speed within one rep

## Workout Structure
1. **Warm-up** (800-1200): Easy swimming, drills, mix of strokes
2. **Pre-set** (400-800): Moderate intensity, technique focus
3. **Main Set** (1500-3000): Primary training stimulus
4. **Cool-down** (200-400): Easy recovery swimming

## Training Zones & Pace Guidelines
When athlete best times are provided, use these guidelines for interval calculations:

**Recovery/Easy (EN1)**: +20-30 seconds per 100 from race pace
- Purpose: Aerobic base, technique work
- Rest: 5-10 seconds

**Aerobic/Moderate (EN2)**: +10-20 seconds per 100 from race pace
- Purpose: Aerobic endurance, steady state
- Rest: 10-15 seconds

**Threshold (EN3)**: +5-8 seconds per 100 from race pace
- Purpose: Lactate threshold training
- Rest: 15-20 seconds

**VO2 Max (SP1)**: +2-5 seconds per 100 from race pace
- Purpose: Maximum aerobic power
- Rest: Equal to work time (1:1 ratio)

**Anaerobic (SP2)**: Race pace to -2 seconds per 100
- Purpose: Speed endurance, lactate tolerance
- Rest: 2-3x work time

**Sprint (SP3)**: Best effort, maximum speed
- Purpose: Power, speed development
- Rest: 3-5x work time

## CRITICAL PACE ADJUSTMENTS FOR SPECIAL SETS:

**Kick Sets**: Add 15-25 seconds per 50 to the base swim pace
- Kicking is significantly slower than swimming
- Example: If swim pace is 1:00 per 100, kick pace should be 1:30-1:50 per 100

**Drill Sets**: Add 10-20 seconds per 50 to the base swim pace
- Drills emphasize technique over speed
- Example: If swim pace is 1:00 per 100, drill pace should be 1:20-1:40 per 100

**Pull Sets**: Add 5-10 seconds per 50 to the base swim pace
- Pull buoy eliminates kick, slightly slower than full stroke
- Example: If swim pace is 1:00 per 100, pull pace should be 1:10-1:20 per 100

When generating workouts:
1. Always specify distances, intervals, strokes, and effort levels
2. Use proper abbreviations and notation, be sure to define them if needed
3. Structure workouts logically (warm-up -> main set -> cool-down)
4. Include rest intervals or send-off times
5. Add coaching notes explaining purpose and technique cues
6. Adjust total yardage/meters to athlete's level
7. Be creative but realistic
8. Pace times can only end in a 5 or 0, i.e. 1:30, 1:35, 1:40, not 1:32 or 1:38
9. **CRITICAL**: When athlete best times are provided, calculate realistic intervals based on their actual performance and training zones listed above
10. **ESSENTIAL**: Always make kick, drill, and pull sets significantly slower than swim paces:
    - Kick sets: 15-25 seconds slower per 50 than swim pace
    - Drill sets: 10-20 seconds slower per 50 than swim pace
    - Pull sets: 5-10 seconds slower per 50 than swim pace"""


# ---------------------------------------------------------------------------
# Time parsing / formatting helpers
# ---------------------------------------------------------------------------

def parse_time_to_seconds(time_str: str) -> float:
    """Parse a swim time string to total seconds.

    Supports "1:23.45" (min:sec), "23.45" (sec), and plain float strings.
    """
    try:
        if ':' in time_str:
            parts = time_str.split(':')
            minutes = int(parts[0])
            seconds = float(parts[1])
            return minutes * 60 + seconds
        else:
            return float(time_str)
    except ValueError:
        raise ValueError(f"Invalid time format: {time_str}")


def seconds_to_time_str(seconds: float) -> str:
    """Convert seconds to MM:SS.ms format."""
    minutes = int(seconds // 60)
    secs = seconds % 60
    if minutes > 0:
        return f"{minutes}:{secs:05.2f}"
    else:
        return f"{secs:.2f}"


def calculate_pace_per_100(distance: int, time_seconds: float, unit: str = "y") -> float:
    """Calculate pace per 100 yards/meters from a race result."""
    return (time_seconds / distance) * 100


# ---------------------------------------------------------------------------
# Zone-based interval calculation
# ---------------------------------------------------------------------------

# Seconds-per-100 adjustments by training zone.
_ZONE_ADJUSTMENTS = {
    'easy': 17.5,       # +15-20 avg
    'moderate': 12.5,   # +10-15 avg
    'threshold': 6.5,   # +5-8 avg
    'vo2max': 3.5,      # +2-5 avg
    'anaerobic': 0,     # race pace
    'sprint': -1        # best effort (slightly faster)
}


def calculate_interval(base_pace_per_100: float, distance: int, zone: str, rest_seconds: int = 10) -> str:
    """Return an interval send-off string for the given distance and zone.

    Args:
        base_pace_per_100: Athlete's race pace per 100 (seconds).
        distance: Repeat distance (50, 100, 200, ...).
        zone: Training zone name (easy/moderate/threshold/vo2max/anaerobic/sprint).
        rest_seconds: Target rest between repeats.

    Returns:
        Formatted interval string, e.g. "1:30".
    """
    adjustment = _ZONE_ADJUSTMENTS.get(zone.lower(), 10)
    adjusted_pace_per_100 = base_pace_per_100 + adjustment
    swim_time = (adjusted_pace_per_100 / 100) * distance
    interval_time = swim_time + rest_seconds
    return seconds_to_time_str(interval_time)


# ---------------------------------------------------------------------------
# Athlete context builder
# ---------------------------------------------------------------------------

def build_athlete_context(best_times: Optional[Dict[str, str]] = None) -> str:
    """Build a context string with the athlete's best times and recommended intervals.

    Args:
        best_times: Mapping of distance (as string) to time string,
                    e.g. {"50": "24.5", "100": "52.3", "200": "1:54.2"}.

    Returns:
        Formatted multi-line string ready to prepend to the LLM context.
    """
    if not best_times:
        return ""

    context_parts = ["\n# ATHLETE PERFORMANCE DATA"]
    context_parts.append("\n## Best Times:")

    pace_data = {}

    for distance_str, time_str in best_times.items():
        distance = int(distance_str)
        try:
            time_seconds = parse_time_to_seconds(time_str)
        except (ValueError, TypeError):
            logger.warning(f"Could not parse time: {time_str}")
            continue
        pace_per_100 = calculate_pace_per_100(distance, time_seconds)

        pace_data[distance] = {
            'time': time_str,
            'seconds': time_seconds,
            'pace_per_100': pace_per_100
        }

        context_parts.append(f"- {distance}y: {time_str} (Pace: {seconds_to_time_str(pace_per_100)} per 100)")

    # Calculate recommended intervals for common distances
    if best_times:
        # Use 100 or 200 time as base (prefer 100)
        if '100' in pace_data:
            base_pace = pace_data['100']['pace_per_100']
        elif '200' in pace_data:
            base_pace = pace_data['200']['pace_per_100']
        else:
            # Use first available
            base_pace = list(pace_data.values())[0]['pace_per_100']

        context_parts.append("\n## Recommended Training Intervals (based on best times):")
        context_parts.append("\n### For 50s:")
        context_parts.append(f"- Easy/Recovery: 50 @ {calculate_interval(base_pace, 50, 'easy', 5)}")
        context_parts.append(f"- Moderate/Aerobic: 50 @ {calculate_interval(base_pace, 50, 'moderate', 10)}")
        context_parts.append(f"- Threshold: 50 @ {calculate_interval(base_pace, 50, 'threshold', 15)}")

        context_parts.append("\n### For 100s:")
        context_parts.append(f"- Easy/Recovery: 100 @ {calculate_interval(base_pace, 100, 'easy', 10)}")
        context_parts.append(f"- Moderate/Aerobic: 100 @ {calculate_interval(base_pace, 100, 'moderate', 15)}")
        context_parts.append(f"- Threshold: 100 @ {calculate_interval(base_pace, 100, 'threshold', 20)}")
        context_parts.append(f"- VO2 Max: 100 @ {calculate_interval(base_pace, 100, 'vo2max', 30)}")

        context_parts.append("\n### For 200s:")
        context_parts.append(f"- Easy/Recovery: 200 @ {calculate_interval(base_pace, 200, 'easy', 15)}")
        context_parts.append(f"- Moderate/Aerobic: 200 @ {calculate_interval(base_pace, 200, 'moderate', 20)}")
        context_parts.append(f"- Threshold: 200 @ {calculate_interval(base_pace, 200, 'threshold', 30)}")

        context_parts.append("\n**IMPORTANT**: Use these calculated intervals as a baseline. All intervals in the workout should be based on these paces and the athlete's actual performance level.\n")

    return '\n'.join(context_parts)


# ---------------------------------------------------------------------------
# Coach style context builders
# ---------------------------------------------------------------------------

_STYLE_LABELS = {
    "warm_up_pattern": "Warm-up pattern",
    "preferred_distances": "Preferred distances",
    "interval_style": "Interval style",
    "notation_style": "Notation style",
    "stroke_emphasis": "Stroke emphasis",
    "activity_mix": "Activity mix",
    "set_structure": "Set structure",
    "personality": "Personality",
    "typical_volume": "Typical volume",
    "coaching_cues": "Common coaching cues",
}


def build_style_context(style_profile: Optional[dict] = None) -> str:
    """Format a pre-computed coaching style profile for the LLM prompt.

    Args:
        style_profile: Dictionary of style attributes (see _STYLE_LABELS keys).
                       The ``coaching_cues`` value may be a list of strings.

    Returns:
        Formatted context block, or "" if the profile is None/empty.
    """
    if not style_profile:
        return ""

    lines = ["COACHING STYLE PROFILE:"]
    for key, label in _STYLE_LABELS.items():
        value = style_profile.get(key)
        if value is None:
            continue
        if isinstance(value, list):
            value = ", ".join(value)
        lines.append(f"- {label}: {value}")

    # Only the header means nothing useful was present
    if len(lines) == 1:
        return ""

    return "\n".join(lines)


def build_coach_notes_context(coaching_style_notes: Optional[str] = None) -> str:
    """Wrap free-text coaching style notes for the LLM prompt.

    Args:
        coaching_style_notes: Raw notes string entered by the coach.

    Returns:
        Formatted context block, or "" if notes are None/empty.
    """
    if not coaching_style_notes or not coaching_style_notes.strip():
        return ""

    return f'COACH\'S STYLE NOTES:\n"{coaching_style_notes.strip()}"'


def build_coach_examples(workouts: list[dict]) -> str:
    """Format recent coach workouts as few-shot examples for the LLM prompt.

    Args:
        workouts: List of dicts with ``name`` and ``raw_description`` keys.

    Returns:
        Formatted example block, or "" if no workouts are provided.
    """
    if not workouts:
        return ""

    lines = ["RECENT WORKOUTS BY THIS COACH (match this style):"]
    for workout in workouts:
        name = workout.get("name", "Untitled")
        description = workout.get("raw_description", "")
        lines.append("---")
        lines.append(name)
        if description:
            lines.append(description)

    return "\n".join(lines)
