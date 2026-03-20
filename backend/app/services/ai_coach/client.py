"""Claude API integration for the AI Coach.

Manages a singleton Anthropic client and exposes three generation
functions: raw Claude calls, workout descriptions, and workout titles.
"""

import os
from typing import Optional
from app.utils import logger, log_error
from .prompt_builder import SWIM_COACH_SYSTEM_PROMPT


# ---------------------------------------------------------------------------
# Singleton Anthropic client
# ---------------------------------------------------------------------------

_anthropic_client = None


def _get_anthropic_client():
    """Return (and lazily create) the singleton Anthropic client."""
    global _anthropic_client
    if _anthropic_client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if api_key:
            from anthropic import Anthropic
            _anthropic_client = Anthropic(api_key=api_key)
    return _anthropic_client


# ---------------------------------------------------------------------------
# Core generation
# ---------------------------------------------------------------------------

def generate_with_claude(prompt: str, context: str, api_key: str) -> str:
    """Send a workout-generation prompt to Claude and return the response text.

    Args:
        prompt: The user's natural-language workout request.
        context: Pre-assembled multi-section context (coach style, coach examples,
                 global examples from ChromaDB, athlete pace data).
        api_key: Anthropic API key (used only for validation; the singleton
                 client is initialised from the env var).
    """
    client = _get_anthropic_client()

    full_prompt = f"""Based on the following request, generate a complete swimming workout.

USER REQUEST:
{prompt}

REFERENCE CONTEXT:
{context}

Generate a workout that:
1. Matches the user's request and skill level
2. Follows proper swimming workout nomenclature (e.g., "8 x 50 @ :50 Free")
3. Is structured with warm-up, main set, cool-down
4. Includes specific distances, intervals, and effort levels
5. **Uses the athlete's performance data and calculated intervals to set appropriate paces**
6. **Makes kick sets 15-25 seconds slower per 50, drill sets 10-20 seconds slower per 50 than regular swim paces**

Generate a workout that matches this coach's writing style, notation, and training philosophy.

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
        model="claude-sonnet-4-6",
        max_tokens=2000,
        system=SWIM_COACH_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": full_prompt}],
    )

    return message.content[0].text


# ---------------------------------------------------------------------------
# Multi-turn conversation generation
# ---------------------------------------------------------------------------

def generate_with_claude_messages(
    conversation_messages: list[dict],
    system_context: str,
) -> str:
    """Send a multi-turn conversation to Claude and return the response text.

    Unlike ``generate_with_claude`` which builds a single user message,
    this passes the actual conversation turns so Claude maintains context
    across follow-up requests (e.g. "make it harder").

    Args:
        conversation_messages: List of dicts with ``role`` ("user" | "assistant")
                               and ``content`` (str) keys.
        system_context: Pre-assembled system prompt including coach style,
                        global examples, and coaching notes.

    Returns:
        The assistant's response text.
    """
    client = _get_anthropic_client()
    if client is None:
        raise ValueError("ANTHROPIC_API_KEY not found in environment variables")

    logger.info(
        f"Generating with Claude messages API | "
        f"turns={len(conversation_messages)} | "
        f"system_length={len(system_context)}"
    )

    try:
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            system=system_context,
            messages=conversation_messages,
        )
        return message.content[0].text
    except Exception as e:
        logger.error("Failed to generate with Claude messages API")
        log_error(e, context="generate_with_claude_messages")
        raise


# ---------------------------------------------------------------------------
# Description generation
# ---------------------------------------------------------------------------

def generate_workout_description(
    workout_name: str,
    raw_description: str,
    total_meters: Optional[int] = None,
    effort_level: Optional[int] = None
) -> str:
    """Generate a concise 1-sentence description for a workout using Claude.

    Returns a string of at most 150 characters.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not found in environment variables")

    logger.info(
        f"Generating workout description | "
        f"name_length={len(workout_name)} | "
        f"raw_length={len(raw_description)}"
    )

    try:
        client = _get_anthropic_client()

        context_parts = [f"Workout Name: {workout_name}"]
        if total_meters:
            context_parts.append(f"Total Distance: {total_meters}m")
        if effort_level:
            context_parts.append(f"Effort Level: {effort_level}/10")
        context_parts.append(f"\nFull Workout:\n{raw_description}")

        context = "\n".join(context_parts)

        system_prompt = """You are an expert swimming coach who writes concise, engaging workout descriptions.

Your task: Generate a SINGLE SENTENCE description that captures the essence of a workout.

Requirements:
- Exactly ONE sentence (no periods in the middle)
- Maximum 150 characters
- Highlight the main focus/theme (e.g., "sprint work", "endurance building", "IM technique")
- Include key details like distance or stroke if relevant
- Make it engaging and informative for coaches browsing workouts
- Do NOT include the workout name in the description

Examples:
- "High-intensity sprint set with short rest, building explosive power and race pace control"
- "Aerobic endurance builder with progressive 200s and steady-state freestyle at moderate effort"
- "IM-focused technique session emphasizing transitions and stroke-specific drills with 3000m total"
- "Threshold training with descending intervals, targeting lactate clearance and mental toughness"

Write ONLY the description sentence, nothing else."""

        user_prompt = f"""Generate a concise 1-sentence description for this swimming workout:

{context}

Description:"""

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=100,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )

        description = response.content[0].text.strip()

        # Ensure it's actually one sentence and under limit
        description = description.split('.')[0]
        if len(description) > 150:
            description = description[:147] + "..."

        logger.info(f"Generated description | length={len(description)}")
        return description

    except ValueError as e:
        logger.warning(f"Invalid description generation request: {str(e)}")
        log_error(e, context="generate_workout_description", error_type="validation")
        raise

    except Exception as e:
        logger.error("Failed to generate workout description with Claude")
        log_error(e, context="generate_workout_description")
        raise Exception(f"Failed to generate description: {str(e)}")


# ---------------------------------------------------------------------------
# Title generation
# ---------------------------------------------------------------------------

def generate_workout_title(
    raw_description: str,
    total_meters: Optional[int] = None,
    effort_level: Optional[int] = None,
    analysis: Optional[dict] = None
) -> str:
    """Generate a concise, engaging title for a workout using Claude.

    Returns a string of at most 60 characters.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not found in environment variables")

    logger.info(f"Generating workout title | raw_length={len(raw_description)}")

    try:
        client = _get_anthropic_client()

        context_parts = []
        if total_meters:
            context_parts.append(f"Total Distance: {total_meters}m")
        if effort_level:
            context_parts.append(f"Effort Level: {effort_level}/10")

        if analysis:
            stroke_breakdown = analysis.get('stroke_breakdown', {})
            if stroke_breakdown:
                context_parts.append("\nStroke Distribution:")
                for stroke, meters in stroke_breakdown.items():
                    if meters and meters > 0:
                        context_parts.append(f"  - {stroke}: {meters}m")

            activity_breakdown = analysis.get('activity_breakdown', {})
            if activity_breakdown:
                context_parts.append("\nActivity Distribution:")
                for activity, meters in activity_breakdown.items():
                    if meters and meters > 0:
                        context_parts.append(f"  - {activity}: {meters}m")

            if analysis.get('classification'):
                context_parts.append(f"\nClassification: {analysis['classification']}")

        context_parts.append(f"\nFull Workout:\n{raw_description}")
        context = "\n".join(context_parts)

        system_prompt = """You are an expert swimming coach who creates CLEVER, CREATIVE, and MEMORABLE workout titles.

Your task: Generate a SHORT, CATCHY title that's creative and fun while capturing the workout's essence.

Requirements:
- Maximum 60 characters
- 2-5 words ideal
- Be creative and clever - use wordplay, alliteration, or swimming puns when appropriate
- Can reference pop culture, famous swimmers, or swimming metaphors
- Make it memorable and engaging, not just descriptive
- Use swimming terminology coaches and athletes will enjoy
- Capitalize appropriately (title case)

IMPORTANT - Use the analysis data to create specific, accurate titles:
- If IM (Individual Medley) strokes are present -> emphasize IM in the title
- If mostly kick -> include "Kick" or kicking-related terms
- If mostly pull -> include "Pull" or pulling-related terms
- If mostly drill -> include "Drill" or technique-related terms
- If heavy butterfly -> reference butterfly specifically
- If descending sets -> use "Descending" or "Ladder" or "Pyramid"
- If mixed strokes -> highlight variety or multi-stroke nature

Style Examples:
IM-FOCUSED:
- "IM Impossible Challenge"
- "Medley Madness"
- "Four-Stroke Fury"

KICK-HEAVY:
- "Kick Crusher"
- "Leg Burner Supreme"
- "Dolphin Kick Domination"

PULL-FOCUSED:
- "Upper Body Assault"
- "Pull Power Hour"
- "Arm Artillery"

DRILL-INTENSIVE:
- "Technique Tuneup"
- "Form Focus Friday"
- "Drill Master Class"

SPRINT WORKOUTS:
- "Freestyle Frenzy"
- "Sprint Savage Session"
- "Velocity Vortex"

ENDURANCE WORKOUTS:
- "The Deep End Theory"
- "Tidal Wave Trainer"
- "Marathon Maker"

MIXED/VARIETY:
- "Stroke Sampler"
- "Aquatic Assault Course"
- "The Riptide Gauntlet"

Write ONLY the title, nothing else. Be creative and make it memorable!"""

        user_prompt = f"""Generate a concise, catchy title for this swimming workout:

{context}

Title:"""

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=50,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )

        title = response.content[0].text.strip()

        # Remove quotes if present
        title = title.strip('"\'')

        # Ensure under character limit
        if len(title) > 60:
            title = title[:57] + "..."

        logger.info(f"Generated title | length={len(title)}")
        return title

    except ValueError as e:
        logger.warning(f"Invalid title generation request: {str(e)}")
        log_error(e, context="generate_workout_title", error_type="validation")
        raise

    except Exception as e:
        logger.error("Failed to generate workout title with Claude")
        log_error(e, context="generate_workout_title")
        raise Exception(f"Failed to generate title: {str(e)}")
