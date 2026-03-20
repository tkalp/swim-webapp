"""LLM-based workout parser using Claude Sonnet with tool_use.

Calls Claude Sonnet via the AsyncAnthropic client to extract structured
workout data (sections, sets with reps/distance/stroke/activity/energy_zone)
from arbitrary workout text formats.  Results are cached in-memory with a
5-minute TTL keyed on the SHA-256 hash of the (preprocessed) input text.
"""

import hashlib
import os
import re
import time
from typing import Any

from anthropic import AsyncAnthropic

from app.utils import logger

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_MODEL = "claude-sonnet-4-6"
_MAX_TOKENS = 4096
_TEMPERATURE = 0
_TIMEOUT = 30.0
_MAX_TEXT_LENGTH = 5000
_CACHE_TTL_SECONDS = 300  # 5 minutes

# ---------------------------------------------------------------------------
# Tool schema
# ---------------------------------------------------------------------------

PARSE_WORKOUT_TOOL = {
    "name": "parse_workout",
    "description": "Parse swimming workout text into structured sections and sets.",
    "input_schema": {
        "type": "object",
        "properties": {
            "sections": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "sets": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "reps": {"type": "integer"},
                                    "distance": {"type": "integer"},
                                    "stroke": {
                                        "type": "string",
                                        "enum": [
                                            "freestyle",
                                            "backstroke",
                                            "breaststroke",
                                            "butterfly",
                                            "im",
                                            "choice",
                                        ],
                                    },
                                    "activity": {
                                        "type": "string",
                                        "enum": ["swim", "kick", "pull", "drill"],
                                    },
                                    "interval": {"type": "string"},
                                    "energy_zone": {
                                        "type": "string",
                                        "enum": [
                                            "en1",
                                            "en2",
                                            "en3",
                                            "en4",
                                            "sprint",
                                        ],
                                    },
                                    "equipment": {
                                        "type": "array",
                                        "items": {
                                            "type": "string",
                                            "enum": [
                                                "fins",
                                                "paddles",
                                                "buoy",
                                                "snorkel",
                                                "band",
                                                "board",
                                                "parachute",
                                                "tempo_trainer",
                                            ],
                                        },
                                    },
                                    "notes": {"type": "string"},
                                },
                                "required": [
                                    "reps",
                                    "distance",
                                    "stroke",
                                    "activity",
                                    "energy_zone",
                                ],
                            },
                        },
                    },
                    "rounds": {
                        "type": "integer",
                        "description": "Number of times the entire section is repeated. Default 1. Use for compound/nested sets like '4x (2x75 + 1x50)' where rounds=4. Sets list the per-round structure; total meters = sum(reps*distance) * rounds.",
                    },
                    "rest_seconds": {
                        "type": "array",
                        "description": "Explicit rest periods within this section in seconds (e.g. '2:00 rest' = 120). One entry per rest line encountered.",
                        "items": {"type": "integer"},
                    },
                    "required": ["name", "sets"],
                },
            },
        },
        "required": ["sections"],
    },
}

SYSTEM_PROMPT = """You are a swimming workout parser. Your ONLY job is to extract structured data from workout text.

RULES:
1. Parse EVERY set in the workout. Do not skip any.
2. For "NxM" notation (e.g. "4x100"), reps=N, distance=M.
3. For single distances (e.g. "400 Free"), reps=1, distance=400.
4. For rounds (e.g. "3 rounds of: 4x25 + 50 easy"), expand: each sub-set gets reps multiplied by rounds.
5. Infer stroke from context. Default to "choice" if ambiguous.
6. Infer activity: "kick" if kicking mentioned, "pull" if pull/buoy mentioned, "drill" if drill mentioned. Default to "swim".
7. Infer energy_zone from intensity cues: easy/recovery/warm-up -> en1, moderate/steady -> en2, build/descend/threshold -> en3, fast/hard -> en4, sprint/max/all-out/race-pace -> sprint. Default to en2.
8. Strip markdown formatting (**, #, *, etc.) — focus on the workout content.
9. Ignore non-set lines (section headers, coaching notes, purposes, focus descriptions). COACHING NOTES sections at the end of the workout are NOT sets — skip them entirely.
10. If the text is empty or contains no recognizable sets, return {"sections": []}.
11. Equipment: detect fins, paddles, buoy/pull buoy, snorkel, band, board/kickboard, parachute, tempo trainer.
12. CRITICAL — IM (Individual Medley): "IM Order", "4x50 IM", or sequential Fly/Back/Breast/Free described as IM → stroke="im", keep as ONE set. Do NOT split into separate 1x50 per stroke. Even if sub-bullets list "50 Fly, 50 Back, 50 Breast, 50 Free", if it is IM Order it is ONE set.
13. Rest-only lines (e.g. "1:00 rest", "2:00 rest", ":30 rest") are NOT sets — do NOT add them to the sets array. Instead, convert them to seconds and add to the section's rest_seconds array (e.g. "2:00 rest" = 120, "1:00 extra rest" = 60, ":30 rest" = 30).
14. CRITICAL — Intervals/send-off times: "on 2:00", "@ 1:30", "@:45", "on the 1:30" all indicate intervals. ALWAYS capture these in the interval field (e.g. "2:00", "1:30", "0:45"). Do NOT omit intervals.
15. CRITICAL — Alternating sets (Odds/Evens): ONLY split when stroke OR activity DIFFERS (e.g. "Odds: Back Kick, Evens: Breast Swim" → split). When odds/evens differ only in pace/effort on the SAME stroke (e.g. "odds: smooth, evens: fast"), keep as ONE set with pace info in notes.
16. CRITICAL — Pattern cycling: "9x50: 1-Kick, 2-Drill, 3-Swim, repeat" is ONE set with 9 reps. Put the pattern in notes. Do NOT split into 3+3+3. The total reps must match the original count.
17. CRITICAL — Compound/nested sets: "4x (2x75 Breast + 1x50 Fly)" means 4 rounds of that pattern. Set the section's "rounds" field to 4. Keep the inner reps as written (2x75, 1x50). The total meters = (2*75 + 1*50) * 4 = 800. Do NOT multiply out the reps — keep the per-round structure for readability.
18. CRITICAL — Preserve total meters: reps × distance for all sets must match the coach's intended total. If coach writes "9x50", total = 450m — never produce sets summing to a different total.

ACCURACY IS CRITICAL. Every rep and distance must be exact.

EXAMPLES:

Example 1 — Odds/Evens with DIFFERENT strokes (SPLIT):

Input: "8x50 @ 1:00\\n    Odds: Backstroke Kick\\n    Evens: Breaststroke Swim"

Output:
{"sections": [{"name": "Main Set", "sets": [
  {"reps": 4, "distance": 50, "stroke": "backstroke", "activity": "kick", "interval": "1:00", "energy_zone": "en2", "notes": "Odds"},
  {"reps": 4, "distance": 50, "stroke": "breaststroke", "activity": "swim", "interval": "1:00", "energy_zone": "en2", "notes": "Evens"}
], "rest_seconds": []}]}

---

Example 2 — Odds/Evens with SAME stroke, different pace (DO NOT SPLIT):

Input: "4x75 Breast @ 1:45 (odds: smooth, evens: build to fast)"

Output:
{"sections": [{"name": "Sprint Technique", "sets": [
  {"reps": 4, "distance": 75, "stroke": "breaststroke", "activity": "swim", "interval": "1:45", "energy_zone": "en3", "notes": "Odds: smooth, Evens: build to fast"}
], "rest_seconds": []}]}

---

Example 3 — IM Order (ONE set, do NOT split):

Input: "4x50 IM Order @ 1:20\\n- 50 Fly, 50 Back, 50 Breast, 50 Free\\n- Easy pace"

Output:
{"sections": [{"name": "Warm-up", "sets": [
  {"reps": 4, "distance": 50, "stroke": "im", "activity": "swim", "interval": "1:20", "energy_zone": "en1", "notes": "IM Order: Fly, Back, Breast, Free. Easy pace"}
], "rest_seconds": []}]}

---

Example 4 — Pattern cycling (ONE set, preserve rep count):

Input: "9x50 @ 1:30\\n- 1: Breast Kick w/ board\\n- 2: Breast 2K1P drill\\n- 3: 25 Breast Kick / 25 Breast Swim\\n- Repeat pattern 3 times"

Output:
{"sections": [{"name": "Kick Foundation", "sets": [
  {"reps": 9, "distance": 50, "stroke": "breaststroke", "activity": "swim", "interval": "1:30", "energy_zone": "en1", "equipment": ["board"], "notes": "Rotating pattern (x3): 1-Kick w/ board, 2-2K1P drill, 3-25 Kick/25 Swim"}
], "rest_seconds": []}]}

---

Example 5 — Standard workout with sections:

Input: "Warm-up:\\n400 choice easy\\n4x75 choice @ 1:30 (25 kick, 25 drill, 25 build)\\n\\nMain Set:\\n5x100 Free @ 1:30\\n\\nCool-down:\\n200 easy choice"

Output:
{"sections": [
  {"name": "Warm-up", "sets": [
    {"reps": 1, "distance": 400, "stroke": "choice", "activity": "swim", "energy_zone": "en1", "notes": "easy"},
    {"reps": 4, "distance": 75, "stroke": "choice", "activity": "swim", "interval": "1:30", "energy_zone": "en1", "notes": "25 kick, 25 drill, 25 build"}
  ], "rest_seconds": []},
  {"name": "Main Set", "sets": [
    {"reps": 5, "distance": 100, "stroke": "freestyle", "activity": "swim", "interval": "1:30", "energy_zone": "en2", "notes": ""}
  ], "rest_seconds": []},
  {"name": "Cool-down", "sets": [
    {"reps": 1, "distance": 200, "stroke": "choice", "activity": "swim", "energy_zone": "en1", "notes": "easy"}
  ], "rest_seconds": []}
]}

---

Example 6 — Rounds (expand reps):

Input: "3 Rounds\\n4x100 Free Kick Descent 1-4\\n4x50 Breast Swim as 25 Smooth 25 Fast"

Output:
{"sections": [{"name": "Main Set - 3 Rounds", "sets": [
  {"reps": 12, "distance": 100, "stroke": "freestyle", "activity": "kick", "energy_zone": "en3", "notes": "Descent 1-4, 3 rounds"},
  {"reps": 12, "distance": 50, "stroke": "breaststroke", "activity": "swim", "energy_zone": "en3", "notes": "25 Smooth 25 Fast, 3 rounds"}
], "rest_seconds": []}]}

---

Example 7 — Compound/nested set (preserve round structure, use rounds field):

Input: "4x\\n- 2x75 Breast @ 1:45 (odds: smooth, evens: build to fast)\\n- 1x50 Fly @ 1:15 (maintain rhythm at higher speed)"

Output:
{"sections": [{"name": "Sprint Technique", "rounds": 4, "sets": [
  {"reps": 2, "distance": 75, "stroke": "breaststroke", "activity": "swim", "interval": "1:45", "energy_zone": "en3", "notes": "Odds: smooth, Evens: build to fast"},
  {"reps": 1, "distance": 50, "stroke": "butterfly", "activity": "swim", "interval": "1:15", "energy_zone": "en4", "notes": "Maintain rhythm at higher speed"}
], "rest_seconds": []}]}

Note: rounds=4 on the section. Inner reps kept as-is (2x75, 1x50). Total = (150+50)*4 = 800m. NOT expanded to 8x75 + 4x50."""

# ---------------------------------------------------------------------------
# Text pre-processing
# ---------------------------------------------------------------------------


def _preprocess_text(text: str) -> str:
    """Normalize workout text before LLM parsing."""
    # Strip markdown
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
    text = re.sub(r'(?<!\*)\*(?!\*)([^*]+)\*(?!\*)', r'\1', text)
    text = re.sub(r'^#{1,3}\s+', '', text, flags=re.MULTILINE)

    # Normalize interval notation: "on 2:00" / "on the 1:30" -> "@ 2:00" / "@ 1:30"
    text = re.sub(r'\bon\s+(?:the\s+)?(\d+:\d+)', r'@ \1', text, flags=re.IGNORECASE)

    # Normalize "@ :45" -> "@ 0:45"
    text = re.sub(r'@\s*:(\d+)', r'@ 0:\1', text)

    return text.strip()


# ---------------------------------------------------------------------------
# Post-processing validation
# ---------------------------------------------------------------------------


def _validate_and_fix(parsed: dict[str, Any]) -> dict[str, Any]:
    """Post-process LLM output to fix common issues."""
    VALID_STROKES = {"freestyle", "backstroke", "breaststroke", "butterfly", "im", "choice"}
    VALID_ACTIVITIES = {"swim", "kick", "pull", "drill"}
    VALID_ZONES = {"en1", "en2", "en3", "en4", "sprint"}

    for section in parsed.get("sections", []):
        fixed_sets: list[dict[str, Any]] = []
        for s in section.get("sets", []):
            # Fix invalid enums
            if s.get("stroke", "") not in VALID_STROKES:
                s["stroke"] = "choice"
            if s.get("activity", "") not in VALID_ACTIVITIES:
                s["activity"] = "swim"
            if s.get("energy_zone", "") not in VALID_ZONES:
                s["energy_zone"] = "en2"

            # Validate reps and distance are positive
            s["reps"] = max(1, s.get("reps", 1))
            s["distance"] = max(0, s.get("distance", 0))

            # Sanity check intervals: flag unreasonable ones
            interval = s.get("interval", "")
            if interval:
                try:
                    clean = interval.replace("@", "").strip()
                    parts = clean.split(":")
                    if len(parts) == 2:
                        total_secs = int(parts[0]) * 60 + int(parts[1])
                    else:
                        total_secs = int(parts[0])

                    distance = s.get("distance", 100)
                    # If interval is more than 3 minutes per 50m, it's probably wrong
                    max_reasonable = (distance / 50) * 180  # 3 min per 50m
                    if total_secs > max_reasonable and distance <= 200:
                        # Clear the unreasonable interval — let duration estimator use pace tables
                        s["interval"] = ""
                except (ValueError, IndexError):
                    s["interval"] = ""

            # Skip sets with 0 distance
            if s.get("distance", 0) > 0:
                fixed_sets.append(s)

        section["sets"] = fixed_sets

        # Ensure rest_seconds is a list of positive integers
        rest = section.get("rest_seconds", [])
        if isinstance(rest, list):
            section["rest_seconds"] = [max(0, int(r)) for r in rest if isinstance(r, (int, float)) and r > 0]
        else:
            section["rest_seconds"] = []

    return parsed


# ---------------------------------------------------------------------------
# In-memory cache
# ---------------------------------------------------------------------------

_cache: dict[str, tuple[float, dict[str, Any]]] = {}


def _cache_key(text: str) -> str:
    """Return SHA-256 hex digest of *text*."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _get_cached(key: str) -> dict[str, Any] | None:
    """Return cached result if present and not expired, else None."""
    entry = _cache.get(key)
    if entry is None:
        return None
    ts, result = entry
    if time.monotonic() - ts > _CACHE_TTL_SECONDS:
        _cache.pop(key, None)
        return None
    return result


def _set_cached(key: str, result: dict[str, Any]) -> None:
    _cache[key] = (time.monotonic(), result)


# ---------------------------------------------------------------------------
# Singleton async client
# ---------------------------------------------------------------------------

_async_client: AsyncAnthropic | None = None


def _get_async_client() -> AsyncAnthropic:
    """Return (and lazily create) the singleton AsyncAnthropic client."""
    global _async_client
    if _async_client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not found in environment variables")
        _async_client = AsyncAnthropic(api_key=api_key, timeout=_TIMEOUT)
    return _async_client


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def parse_workout_with_llm(text: str) -> dict[str, Any]:
    """Parse arbitrary workout text into structured sections/sets via Claude Sonnet.

    Args:
        text: Raw workout text in any format (NxM, prose, markdown, etc.).

    Returns:
        A dict matching the ``parse_workout`` tool schema, e.g.
        ``{"sections": [{"name": "...", "sets": [...]}]}``.

    Raises:
        Any exception from the Anthropic SDK or response extraction is
        propagated to the caller (which is responsible for fallback).
    """
    # Empty / whitespace → fast return
    if not text or not text.strip():
        return {"sections": []}

    # Pre-process text before anything else
    text = _preprocess_text(text)

    # Truncate if too long
    if len(text) > _MAX_TEXT_LENGTH:
        text = text[:_MAX_TEXT_LENGTH]

    # Check cache (on preprocessed text)
    key = _cache_key(text)
    cached = _get_cached(key)
    if cached is not None:
        logger.info("LLM parser cache hit")
        return cached

    client = _get_async_client()

    logger.info(
        f"Calling Claude Sonnet for workout parsing | "
        f"text_length={len(text)}"
    )

    response = await client.messages.create(
        model=_MODEL,
        max_tokens=_MAX_TOKENS,
        temperature=_TEMPERATURE,
        system=SYSTEM_PROMPT,
        tools=[PARSE_WORKOUT_TOOL],
        tool_choice={"type": "tool", "name": "parse_workout"},
        messages=[
            {
                "role": "user",
                "content": f"Parse this swimming workout:\n\n{text}",
            }
        ],
    )

    # Extract tool_use result
    result: dict[str, Any] | None = None
    for block in response.content:
        if block.type == "tool_use" and block.name == "parse_workout":
            result = block.input
            break

    if result is None:
        raise RuntimeError(
            "Claude did not return a parse_workout tool_use block"
        )

    # Post-process: validate and fix common LLM output issues
    result = _validate_and_fix(result)

    _set_cached(key, result)

    total_sets = sum(len(s.get("sets", [])) for s in result.get("sections", []))
    logger.info(
        f"LLM parser returned | "
        f"sections={len(result.get('sections', []))} | "
        f"total_sets={total_sets}"
    )

    return result
