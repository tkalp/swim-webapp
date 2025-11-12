import os
import chromadb
from anthropic import Anthropic
from openai import OpenAI
from groq import Groq
from typing import Optional, Dict
from datetime import timedelta
from app.utils import logger, log_error

COLLECTION_NAME = "swimming_workouts"

# Lazy initialization of ChromaDB client
_client = None

def get_chroma_client():
    """Get or create ChromaDB client (lazy initialization)"""
    global _client
    if _client is None:
        chroma_path = os.getenv("CHROMA_DB_PATH", "./chroma_db")
        logger.info(f"Initializing ChromaDB client at path: {chroma_path}")
        try:
            _client = chromadb.PersistentClient(path=chroma_path)
            logger.info("ChromaDB client initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize ChromaDB client at {chroma_path}")
            log_error(e, context="init_chromadb", chroma_path=chroma_path)
            raise
    return _client

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
3. Structure workouts logically (warm-up → main set → cool-down)
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


def parse_time_to_seconds(time_str: str) -> float:
    """
    Parse time string to seconds. Supports formats:
    - "1:23.45" (minutes:seconds.milliseconds)
    - "23.45" (seconds.milliseconds)
    - "83.45" (total seconds)
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
    """Convert seconds to MM:SS.ms format"""
    minutes = int(seconds // 60)
    secs = seconds % 60
    if minutes > 0:
        return f"{minutes}:{secs:05.2f}"
    else:
        return f"{secs:.2f}"


def calculate_pace_per_100(distance: int, time_seconds: float, unit: str = "y") -> float:
    """
    Calculate pace per 100 yards/meters
    
    Args:
        distance: Race distance (e.g., 50, 100, 200, 500, 1650)
        time_seconds: Time in seconds for that distance
        unit: 'y' for yards or 'm' for meters
    
    Returns:
        Pace in seconds per 100 yards/meters
    """
    return (time_seconds / distance) * 100


def calculate_interval(base_pace_per_100: float, distance: int, zone: str, rest_seconds: int = 10) -> str:
    """
    Calculate interval time for a given distance and training zone
    
    Args:
        base_pace_per_100: Athlete's race pace per 100 (in seconds)
        distance: Repeat distance (e.g., 50, 100, 200)
        zone: Training zone ('easy', 'moderate', 'threshold', 'vo2max', 'anaerobic', 'sprint')
        rest_seconds: Target rest between repeats
    
    Returns:
        Interval time string (e.g., "1:30")
    """
    # Zone adjustments (seconds per 100)
    zone_adjustments = {
        'easy': 17.5,       # +15-20 avg
        'moderate': 12.5,   # +10-15 avg
        'threshold': 6.5,   # +5-8 avg
        'vo2max': 3.5,      # +2-5 avg
        'anaerobic': 0,     # race pace
        'sprint': -1        # best effort (slightly faster)
    }
    
    adjustment = zone_adjustments.get(zone.lower(), 10)
    adjusted_pace_per_100 = base_pace_per_100 + adjustment
    
    # Calculate swim time for this distance
    swim_time = (adjusted_pace_per_100 / 100) * distance
    
    # Add rest to get interval
    interval_time = swim_time + rest_seconds
    
    return seconds_to_time_str(interval_time)


def build_athlete_context(best_times: Optional[Dict[str, str]] = None) -> str:
    """
    Build context string with athlete's best times and calculated paces
    
    Args:
        best_times: Dictionary with distances as keys and times as values
                   Example: {"50": "24.5", "100": "52.3", "200": "1:54.2", "500": "5:10.5"}
    
    Returns:
        Formatted context string with pace calculations
    """
    if not best_times:
        return ""
    
    context_parts = ["\n# ATHLETE PERFORMANCE DATA"]
    context_parts.append("\n## Best Times:")
    
    pace_data = {}
    
    for distance_str, time_str in best_times.items():
        distance = int(distance_str)
        time_seconds = parse_time_to_seconds(time_str)
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


def check_chromadb() -> tuple[bool, Optional[str]]:
    """Check if ChromaDB is available and collection exists"""
    logger.debug("Checking ChromaDB connection and collection")
    
    try:
        client = get_chroma_client()
        collections = client.list_collections()
        collection_names = [c.name for c in collections]
        
        if COLLECTION_NAME in collection_names:
            collection = client.get_collection(name=COLLECTION_NAME)
            count = collection.count()
            logger.info(f"ChromaDB connected: {count} workouts in collection '{COLLECTION_NAME}'")
            print(f"✓ ChromaDB connected: {count} workouts in collection")
            return True, None
        else:
            msg = f"Collection '{COLLECTION_NAME}' not found"
            logger.warning(f"ChromaDB collection missing: {msg}")
            print(f"⚠ {msg}")
            return False, msg
    except Exception as e:
        logger.error(f"ChromaDB connection error")
        log_error(e, context="check_chromadb")
        print(f"ChromaDB connection error: {str(e)}")
        return False, str(e)


def search_similar_workouts(query: str, n_results: int = 5) -> list[dict]:
    """Search ChromaDB for similar workouts"""
    logger.debug(f"Searching ChromaDB for similar workouts | query_length={len(query)} | n_results={n_results}")
    
    try:
        client = get_chroma_client()
        collection = client.get_collection(name=COLLECTION_NAME)
        
        results = collection.query(
            query_texts=[query],
            n_results=n_results,
        )
        
        workouts = []
        if results["ids"] and results["ids"][0]:
            for i in range(len(results["ids"][0])):
                workouts.append({
                    "id": results["ids"][0][i],
                    "document": results["documents"][0][i] if results.get("documents") else "",
                    "metadata": results["metadatas"][0][i] if results.get("metadatas") else {},
                    "distance": results["distances"][0][i] if results.get("distances") else 1.0,
                })
        
        logger.info(f"Found {len(workouts)} similar workouts from ChromaDB")
        print(f"✓ Found {len(workouts)} similar workouts")
        return workouts
        
    except Exception as e:
        logger.error("ChromaDB search failed")
        log_error(e, context="search_similar_workouts", query_length=len(query))
        print(f"ChromaDB search error: {str(e)}")
        raise Exception(f"Failed to search workouts: {str(e)}")


def build_context(search_results: list[dict]) -> str:
    """Build context string from search results"""
    context_parts = []
    
    for i, result in enumerate(search_results, 1):
        context_parts.append(f"EXAMPLE WORKOUT {i}:")
        context_parts.append(f"Title: {result['metadata'].get('title', 'Unknown')}")
        
        if result['metadata'].get('coach_notes'):
            context_parts.append(f"Coach Notes: {result['metadata']['coach_notes']}")
        
        # Extract workout text from document
        doc = result['document']
        workout_start = doc.find('Workout:')
        if workout_start != -1:
            workout_text = doc[workout_start + 8:].strip()
            context_parts.append(f"Workout Structure:\n{workout_text}")
        
        context_parts.append('\n' + '=' * 80 + '\n')
    
    return '\n'.join(context_parts)


def generate_with_claude(prompt: str, context: str, api_key: str) -> str:
    """Generate workout using Claude"""
    client = Anthropic(api_key=api_key)
    
    full_prompt = f"""Based on the following request, generate a complete swimming workout.

USER REQUEST:
{prompt}

EXAMPLE WORKOUTS FROM DATABASE (for reference on format and structure):
{context}

Generate a workout that:
1. Matches the user's request and skill level
2. Follows proper swimming workout nomenclature (e.g., "8 x 50 @ :50 Free")
3. Is structured with warm-up, main set, cool-down
4. Includes specific distances, intervals, and effort levels
5. **Uses the athlete's performance data and calculated intervals to set appropriate paces**
6. **Makes kick sets 15-25 seconds slower per 50, drill sets 10-20 seconds slower per 50 than regular swim paces**

IMPORTANT FORMAT REQUIREMENTS:
- Be CONCISE - focus on the workout itself, not extensive explanations
- NO section purposes, no coaching philosophy paragraphs
- Keep it to: Set name, distances/intervals, and BRIEF drill descriptions when needed
- **CRITICAL: Put each set on its own line with a blank line between sets**
- Example good format:
  WARM-UP (400m)
  200m Easy choice
  
  4 x 50 @ 1:15 (25m Kick, 25m Free)
  
  MAIN SET (1200m)
  8 x 50 @ :50 Breaststroke Pull - Focus on high elbow catch
  
  4 x 100 @ 2:30 as: 25 Pull (strong), 25 Easy back, 25 Pull (strong), 25 Easy free
  
  COOL-DOWN (200m)
  200m Easy choice
  
- Each set should be on its own line, separated by blank lines for readability
- Only include drill descriptions if they're essential to the set
- No "Purpose:" sections, no "Coaching Notes" sections at the end
- Total distance and brief key focus is fine at the top"""
    
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        system=SWIM_COACH_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": full_prompt}],
    )
    
    return message.content[0].text


def generate_with_openai(prompt: str, context: str, api_key: str) -> str:
    """Generate workout using OpenAI"""
    client = OpenAI(api_key=api_key)
    
    full_prompt = f"""Based on the following request, generate a complete swimming workout.

USER REQUEST:
{prompt}

EXAMPLE WORKOUTS FROM DATABASE (for reference on format and structure):
{context}

Generate a workout that:
1. Matches the user's request and skill level
2. Follows proper swimming workout nomenclature (e.g., "8 x 50 @ :50 Free")
3. Is structured with warm-up, main set, cool-down
4. Includes specific distances, intervals, and effort levels
5. **Uses the athlete's performance data and calculated intervals to set appropriate paces**
6. **Makes kick sets 15-25 seconds slower per 50, drill sets 10-20 seconds slower per 50 than regular swim paces**

IMPORTANT FORMAT REQUIREMENTS:
- Be CONCISE - focus on the workout itself, not extensive explanations
- NO section purposes, no coaching philosophy paragraphs
- Keep it to: Set name, distances/intervals, and BRIEF drill descriptions when needed
- **CRITICAL: Put each set on its own line with a blank line between sets**
- Example good format:
  WARM-UP (400m)
  200m Easy choice
  
  4 x 50 @ 1:15 (25m Kick, 25m Free)
  
  MAIN SET (1200m)
  8 x 50 @ :50 Breaststroke Pull - Focus on high elbow catch
  
  4 x 100 @ 2:30 as: 25 Pull (strong), 25 Easy back, 25 Pull (strong), 25 Easy free
  
  COOL-DOWN (200m)
  200m Easy choice
  
- Each set should be on its own line, separated by blank lines for readability
- Only include drill descriptions if they're essential to the set
- No "Purpose:" sections, no "Coaching Notes" sections at the end
- Total distance and brief key focus is fine at the top"""
    
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": SWIM_COACH_SYSTEM_PROMPT},
            {"role": "user", "content": full_prompt},
        ],
        max_tokens=2000,
        temperature=0.7,
    )
    
    return response.choices[0].message.content or ""


def generate_with_groq(prompt: str, context: str, api_key: str) -> str:
    """Generate workout using Groq"""
    client = Groq(api_key=api_key)
    
    full_prompt = f"""Based on the following request, generate a complete swimming workout.

USER REQUEST:
{prompt}

EXAMPLE WORKOUTS FROM DATABASE (for reference on format and structure):
{context}

Generate a workout that:
1. Matches the user's request and skill level
2. Follows proper swimming workout nomenclature (e.g., "8 x 50 @ :50 Free")
3. Is structured with warm-up, main set, cool-down
4. Includes specific distances, intervals, and effort levels
5. **Uses the athlete's performance data and calculated intervals to set appropriate paces**
6. **Makes kick sets 15-25 seconds slower per 50, drill sets 10-20 seconds slower per 50 than regular swim paces**

IMPORTANT FORMAT REQUIREMENTS:
- Be CONCISE - focus on the workout itself, not extensive explanations
- NO section purposes, no coaching philosophy paragraphs
- Keep it to: Set name, distances/intervals, and BRIEF drill descriptions when needed
- **CRITICAL: Put each set on its own line with a blank line between sets**
- Example good format:
  WARM-UP (400m)
  200m Easy choice
  
  4 x 50 @ 1:15 (25m Kick, 25m Free)
  
  MAIN SET (1200m)
  8 x 50 @ :50 Breaststroke Pull - Focus on high elbow catch
  
  4 x 100 @ 2:30 as: 25 Pull (strong), 25 Easy back, 25 Pull (strong), 25 Easy free
  
  COOL-DOWN (200m)
  200m Easy choice
  
- Each set should be on its own line, separated by blank lines for readability
- Only include drill descriptions if they're essential to the set
- No "Purpose:" sections, no "Coaching Notes" sections at the end
- Total distance and brief key focus is fine at the top"""
    
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": SWIM_COACH_SYSTEM_PROMPT},
            {"role": "user", "content": full_prompt},
        ],
        max_tokens=2000,
        temperature=0.7,
    )
    
    return response.choices[0].message.content or ""


def generate_workout(
    prompt: str,
    provider: str,
    api_key: str,
    num_examples: int = 3,
    best_times: Optional[Dict[str, str]] = None
) -> dict:
    """
    Main function to generate workout using ChromaDB and athlete performance data
    
    Args:
        prompt: User's workout request
        provider: AI provider ('claude', 'openai', or 'groq')
        api_key: API key for the provider
        num_examples: Number of example workouts to retrieve
        best_times: Optional dict of athlete's best times
                   Example: {"50": "24.5", "100": "52.3", "200": "1:54.2", "500": "5:10.5"}
    
    Returns:
        Dict with workout and examples
    """
    logger.info(
        f"Generating workout | provider={provider} | num_examples={num_examples} | "
        f"has_best_times={bool(best_times)} | prompt_length={len(prompt)}"
    )
    
    try:
        # Step 1: Search ChromaDB
        print("Searching ChromaDB for similar workouts...")
        logger.debug("Searching ChromaDB for similar workouts")
        search_results = search_similar_workouts(prompt, num_examples)
        
        # Step 2: Build context from examples
        logger.debug("Building context from search results")
        context = build_context(search_results)
        
        # Step 3: Add athlete performance context
        if best_times:
            logger.debug(f"Adding athlete context with {len(best_times)} best times")
            athlete_context = build_athlete_context(best_times)
            context = athlete_context + "\n\n" + context
            print(f"✓ Added athlete performance data with {len(best_times)} best times")
        
        # Step 4: Generate workout
        print(f"Generating workout with {provider}...")
        logger.info(f"Calling {provider} API to generate workout")
        
        if provider == "claude":
            workout = generate_with_claude(prompt, context, api_key)
        elif provider == "groq":
            workout = generate_with_groq(prompt, context, api_key)
        else:
            workout = generate_with_openai(prompt, context, api_key)
        
        logger.info(f"Workout generated successfully | provider={provider} | workout_length={len(workout)}")
        
        # Step 5: Return response
        return {
            "workout": workout,
            "examples": [
                {
                    "id": r["metadata"].get("workout_id", r["id"]),
                    "title": r["metadata"].get("title", "Unknown"),
                    "url": r["metadata"].get("workout_url", ""),
                    "relevance": 1 - r["distance"],
                }
                for r in search_results
            ],
            "athlete_paces": build_athlete_context(best_times) if best_times else None,
        }
    
    except ValueError as e:
        # Client errors (bad input, invalid API key, etc.)
        logger.warning(f"Invalid workout generation request: {str(e)}")
        log_error(e, context="generate_workout", provider=provider, error_type="validation")
        raise
        
    except Exception as e:
        # Server errors
        logger.error(f"Failed to generate workout with {provider}")
        log_error(e, context="generate_workout", provider=provider, num_examples=num_examples)
        raise Exception(f"Failed to generate workout: {str(e)}")

# import os
# import chromadb
# from anthropic import Anthropic
# from openai import OpenAI
# from groq import Groq
# from typing import Optional

# COLLECTION_NAME = "swimming_workouts"

# # Initialize ChromaDB client
# chroma_path = os.getenv("CHROMA_DB_PATH", "./chroma_db")
# client = chromadb.PersistentClient(path=chroma_path)

# SWIM_COACH_SYSTEM_PROMPT = """You are an expert swimming coach with deep knowledge of workout programming and swimming nomenclature. 

# # SWIMMING WORKOUT NOMENCLATURE GUIDE

# ## Distance Units
# - Yards (y) or Meters (m): e.g., "100y", "200m"
# - SCY = Short Course Yards (25y pool)
# - SCM = Short Course Meters (25m pool)
# - LCM = Long Course Meters (50m pool)

# ## Workout Format
# Standard format: [Quantity] x [Distance] @ [Interval] [Stroke/Description]

# Examples:
# - "8 x 50 @ :50" = 8 repetitions of 50 yards/meters with 50 seconds rest interval
# - "4 x 100 @ 1:30 Free" = 4 x 100 freestyle leaving every 1:30
# - "10 x 25 @ :30 Kick" = 10 x 25 kicking with 30 second intervals

# ## Common Abbreviations
# - Free/Fr = Freestyle
# - Back/Bk = Backstroke  
# - Breast/Br = Breaststroke
# - Fly/Fl = Butterfly
# - IM = Individual Medley (Fly-Back-Breast-Free)
# - Kick = Kicking with kickboard
# - Pull = Pull buoy (legs float, arms only)
# - Drill = Technique drills
# - Desc = Descending (get faster each rep)
# - Build = Gradually increase speed within one rep

# ## Workout Structure
# 1. **Warm-up** (800-1200): Easy swimming, drills, mix of strokes
# 2. **Pre-set** (400-800): Moderate intensity, technique focus
# 3. **Main Set** (1500-3000): Primary training stimulus
# 4. **Cool-down** (200-400): Easy recovery swimming

# When generating workouts:
# 1. Always specify distances, intervals, strokes, and effort levels
# 2. Use proper abbreviations and notation, be sure to define them if needed
# 3. Structure workouts logically (warm-up → main set → cool-down)
# 4. Include rest intervals or send-off times
# 5. Add coaching notes explaining purpose and technique cues
# 6. Adjust total yardage/meters to athlete's level
# 7. Be creative but realistic"""


# def check_chromadb() -> tuple[bool, Optional[str]]:
#     """Check if ChromaDB is available and collection exists"""
#     try:
#         collections = client.list_collections()
#         collection_names = [c.name for c in collections]
        
#         if COLLECTION_NAME in collection_names:
#             collection = client.get_collection(name=COLLECTION_NAME)
#             count = collection.count()
#             print(f"✓ ChromaDB connected: {count} workouts in collection")
#             return True, None
#         else:
#             msg = f"Collection '{COLLECTION_NAME}' not found"
#             print(f"⚠ {msg}")
#             return False, msg
#     except Exception as e:
#         print(f"ChromaDB connection error: {str(e)}")
#         return False, str(e)


# def search_similar_workouts(query: str, n_results: int = 5) -> list[dict]:
#     """Search ChromaDB for similar workouts"""
#     try:
#         collection = client.get_collection(name=COLLECTION_NAME)
        
#         results = collection.query(
#             query_texts=[query],
#             n_results=n_results,
#         )
        
#         workouts = []
#         if results["ids"] and results["ids"][0]:
#             for i in range(len(results["ids"][0])):
#                 workouts.append({
#                     "id": results["ids"][0][i],
#                     "document": results["documents"][0][i] if results.get("documents") else "",
#                     "metadata": results["metadatas"][0][i] if results.get("metadatas") else {},
#                     "distance": results["distances"][0][i] if results.get("distances") else 1.0,
#                 })
        
#         print(f"✓ Found {len(workouts)} similar workouts")
#         return workouts
#     except Exception as e:
#         print(f"ChromaDB search error: {str(e)}")
#         raise Exception(f"Failed to search workouts: {str(e)}")


# def build_context(search_results: list[dict]) -> str:
#     """Build context string from search results"""
#     context_parts = []
    
#     for i, result in enumerate(search_results, 1):
#         context_parts.append(f"EXAMPLE WORKOUT {i}:")
#         context_parts.append(f"Title: {result['metadata'].get('title', 'Unknown')}")
        
#         if result['metadata'].get('coach_notes'):
#             context_parts.append(f"Coach Notes: {result['metadata']['coach_notes']}")
        
#         # Extract workout text from document
#         doc = result['document']
#         workout_start = doc.find('Workout:')
#         if workout_start != -1:
#             workout_text = doc[workout_start + 8:].strip()
#             context_parts.append(f"Workout Structure:\n{workout_text}")
        
#         context_parts.append('\n' + '=' * 80 + '\n')
    
#     return '\n'.join(context_parts)


# def generate_with_claude(prompt: str, context: str, api_key: str) -> str:
#     """Generate workout using Claude"""
#     client = Anthropic(api_key=api_key)
    
#     full_prompt = f"""Based on the following request, generate a complete, detailed swimming workout.

# USER REQUEST:
# {prompt}

# EXAMPLE WORKOUTS FROM DATABASE (for reference on format and structure):
# {context}

# Generate a workout that:
# 1. Matches the user's request and skill level
# 2. Follows proper swimming workout nomenclature
# 3. Is structured like the examples (warm-up, pre-set, main set, cool-down)
# 4. Includes specific distances, intervals, and effort levels
# 5. Has coaching notes explaining the purpose
# 6. Is realistic and safe for the intended athlete

# Format the workout clearly with sections and use proper swimming notation."""
    
#     message = client.messages.create(
#         model="claude-sonnet-4-20250514",
#         max_tokens=4000,
#         system=SWIM_COACH_SYSTEM_PROMPT,
#         messages=[{"role": "user", "content": full_prompt}],
#     )
    
#     return message.content[0].text


# def generate_with_openai(prompt: str, context: str, api_key: str) -> str:
#     """Generate workout using OpenAI"""
#     client = OpenAI(api_key=api_key)
    
#     full_prompt = f"""Based on the following request, generate a complete, detailed swimming workout.

# USER REQUEST:
# {prompt}

# EXAMPLE WORKOUTS FROM DATABASE (for reference on format and structure):
# {context}

# Generate a workout that:
# 1. Matches the user's request and skill level
# 2. Follows proper swimming workout nomenclature
# 3. Is structured like the examples (warm-up, pre-set, main set, cool-down)
# 4. Includes specific distances, intervals, and effort levels
# 5. Has coaching notes explaining the purpose
# 6. Is realistic and safe for the intended athlete

# Format the workout clearly with sections and use proper swimming notation."""
    
#     response = client.chat.completions.create(
#         model="gpt-4o",
#         messages=[
#             {"role": "system", "content": SWIM_COACH_SYSTEM_PROMPT},
#             {"role": "user", "content": full_prompt},
#         ],
#         max_tokens=4000,
#         temperature=0.7,
#     )
    
#     return response.choices[0].message.content


# def generate_with_groq(prompt: str, context: str, api_key: str) -> str:
#     """Generate workout using Groq"""
#     client = Groq(api_key=api_key)
    
#     full_prompt = f"""Based on the following request, generate a complete, detailed swimming workout.

# USER REQUEST:
# {prompt}

# EXAMPLE WORKOUTS FROM DATABASE (for reference on format and structure):
# {context}

# Generate a workout that:
# 1. Matches the user's request and skill level
# 2. Follows proper swimming workout nomenclature
# 3. Is structured like the examples (warm-up, pre-set, main set, cool-down)
# 4. Includes specific distances, intervals, and effort levels
# 5. Has coaching notes explaining the purpose
# 6. Is realistic and safe for the intended athlete

# Format the workout clearly with sections and use proper swimming notation."""
    
#     response = client.chat.completions.create(
#         model="llama-3.3-70b-versatile",
#         messages=[
#             {"role": "system", "content": SWIM_COACH_SYSTEM_PROMPT},
#             {"role": "user", "content": full_prompt},
#         ],
#         max_tokens=4000,
#         temperature=0.7,
#     )
    
#     return response.choices[0].message.content


# def generate_workout(
#     prompt: str,
#     provider: str,
#     api_key: str,
#     num_examples: int = 3
# ) -> dict:
#     """Main function to generate workout using ChromaDB"""
#     # Step 1: Search ChromaDB
#     print("Searching ChromaDB for similar workouts...")
#     search_results = search_similar_workouts(prompt, num_examples)
    
#     # Step 2: Build context
#     context = build_context(search_results)
    
#     # Step 3: Generate workout
#     print(f"Generating workout with {provider}...")
#     if provider == "claude":
#         workout = generate_with_claude(prompt, context, api_key)
#     elif provider == "groq":
#         workout = generate_with_groq(prompt, context, api_key)
#     else:
#         workout = generate_with_openai(prompt, context, api_key)
    
#     # Step 4: Return response
#     return {
#         "workout": workout,
#         "examples": [
#             {
#                 "id": r["metadata"].get("workout_id", r["id"]),
#                 "title": r["metadata"].get("title", "Unknown"),
#                 "url": r["metadata"].get("workout_url", ""),
#                 "relevance": 1 - r["distance"],
#             }
#             for r in search_results
#         ],
#     }