"""ChromaDB RAG workout generator with two-stage retrieval.

Implements the retrieval-augmented generation pipeline:
1. Stage 1 (ChromaDB): Metadata-filtered vector search on the global workout pool.
2. Stage 2 (PostgreSQL): Coach's recent workouts, style profile, and coaching notes.
3. Assemble a rich multi-section prompt and call Claude.

Also exposes a health-check helper for the /ai-coach/health endpoint.
"""

import os
from typing import Optional, Dict

import chromadb

from app.utils import logger, log_error
from .prompt_builder import (
    build_athlete_context,
    build_style_context,
    build_coach_notes_context,
    build_coach_examples,
)
from .client import generate_with_claude

COLLECTION_NAME = "swimming_workouts"

# Lazy initialization of ChromaDB client
_client = None


def get_chroma_client():
    """Get or create ChromaDB client (lazy initialization)."""
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


# ---------------------------------------------------------------------------
# Metadata filter extraction
# ---------------------------------------------------------------------------

_FOCUS_KEYWORDS = {
    "sprint": ["sprint", "fast", "speed", "race pace"],
    "endurance": ["endurance", "distance", "aerobic", "long"],
    "technique": ["technique", "drill", "form", "stroke work"],
    "IM": ["IM", "medley", "individual medley"],
    "recovery": ["recovery", "easy", "warm down", "cooldown"],
    "race_prep": ["race prep", "taper", "competition", "meet prep"],
}


def _extract_metadata_filter(prompt: str) -> dict | None:
    """Extract a ChromaDB metadata where-filter from the user prompt.

    Scans the prompt for focus-area keywords and returns a filter dict
    compatible with ``collection.query(where=...)``, or None if no match.
    """
    prompt_lower = prompt.lower()
    for focus, keywords in _FOCUS_KEYWORDS.items():
        if any(kw in prompt_lower for kw in keywords):
            return {"training_focus": focus}
    return None


# ---------------------------------------------------------------------------
# ChromaDB search
# ---------------------------------------------------------------------------

def search_similar_workouts(
    query: str,
    n_results: int = 5,
    where: dict | None = None,
) -> list[dict]:
    """Search ChromaDB for similar workouts by vector similarity.

    Args:
        query: Natural-language search text.
        n_results: Maximum number of results to return.
        where: Optional ChromaDB metadata filter dict.
    """
    logger.debug(
        f"Searching ChromaDB for similar workouts | query_length={len(query)} "
        f"| n_results={n_results} | where={where}"
    )

    try:
        client = get_chroma_client()
        collection = client.get_collection(name=COLLECTION_NAME)

        count = collection.count()
        n = min(n_results, count) if count > 0 else 0
        if n == 0:
            logger.info("ChromaDB collection is empty, returning no results")
            return []

        query_kwargs: dict = {
            "query_texts": [query],
            "n_results": n,
        }
        if where is not None:
            query_kwargs["where"] = where

        try:
            results = collection.query(**query_kwargs)
        except Exception:
            # If the metadata filter yields no results or the field doesn't
            # exist, fall back to an unfiltered search.
            if where is not None:
                logger.info("Filtered ChromaDB query failed, retrying without filter")
                query_kwargs.pop("where", None)
                results = collection.query(**query_kwargs)
            else:
                raise

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
        return workouts

    except Exception as e:
        logger.error("ChromaDB search failed")
        log_error(e, context="search_similar_workouts", query_length=len(query))
        raise Exception(f"Failed to search workouts: {str(e)}")


def build_context(search_results: list[dict]) -> str:
    """Build a context string from ChromaDB search results for the LLM prompt."""
    context_parts = []

    for i, result in enumerate(search_results, 1):
        context_parts.append(f"EXAMPLE WORKOUT {i}:")
        context_parts.append(f"Title: {result['metadata'].get('title', 'Unknown')}")

        if result['metadata'].get('coach_notes'):
            context_parts.append(f"Coach Notes: {result['metadata']['coach_notes']}")

        doc = result['document']
        workout_start = doc.find('Workout:')
        if workout_start != -1:
            workout_text = doc[workout_start + 8:].strip()
            context_parts.append(f"Workout Structure:\n{workout_text}")

        context_parts.append('\n' + '=' * 80 + '\n')

    return '\n'.join(context_parts)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

def check_chromadb() -> tuple[bool, Optional[str]]:
    """Check if ChromaDB is available and the workout collection exists."""
    logger.debug("Checking ChromaDB connection and collection")

    try:
        client = get_chroma_client()
        collections = client.list_collections()
        collection_names = [c.name for c in collections]

        if COLLECTION_NAME in collection_names:
            collection = client.get_collection(name=COLLECTION_NAME)
            count = collection.count()
            logger.info(f"ChromaDB connected: {count} workouts in collection '{COLLECTION_NAME}'")
            return True, None
        else:
            msg = f"Collection '{COLLECTION_NAME}' not found"
            logger.warning(f"ChromaDB collection missing: {msg}")
            return False, msg
    except Exception as e:
        logger.error(f"ChromaDB connection error")
        log_error(e, context="check_chromadb")
        return False, str(e)


# ---------------------------------------------------------------------------
# Main generation orchestrator
# ---------------------------------------------------------------------------

async def generate_workout(
    prompt: str,
    best_times: Optional[Dict[str, str]] = None,
    coach_id: Optional[str] = None,
    db=None,
) -> dict:
    """Generate a workout using two-stage retrieval + Claude.

    Stage 1 (ChromaDB): Metadata-filtered vector search on the global pool.
    Stage 2 (PostgreSQL): Coach style profile, recent workouts, coaching notes.

    Args:
        prompt: User's natural-language workout request.
        best_times: Optional dict mapping distance strings to time strings,
                    e.g. {"50": "24.5", "100": "52.3"}.
        coach_id: Optional coach UUID for personalized retrieval.
        db: Optional async database session for Stage 2 queries.

    Returns:
        Dict with "workout" text and optional "athlete_paces".
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not found in environment variables")

    num_examples = 6

    logger.info(
        f"Generating workout | num_examples={num_examples} | "
        f"has_best_times={bool(best_times)} | has_coach={bool(coach_id)} | "
        f"prompt_length={len(prompt)}"
    )

    try:
        # ------------------------------------------------------------------
        # Stage 1: ChromaDB vector search with metadata filtering
        # ------------------------------------------------------------------
        logger.debug("Stage 1: Searching ChromaDB for similar workouts")
        metadata_filter = _extract_metadata_filter(prompt)
        search_results = search_similar_workouts(
            prompt, num_examples, where=metadata_filter
        )
        global_context = build_context(search_results)

        # ------------------------------------------------------------------
        # Stage 2: Coach personalisation from PostgreSQL
        # ------------------------------------------------------------------
        style_section = ""
        coach_examples_section = ""
        coach_notes_section = ""

        if coach_id and db:
            logger.debug("Stage 2: Fetching coach style and recent workouts from DB")
            try:
                from app.services.coach_style_service import (
                    get_coach_example_workouts,
                    get_style,
                )

                style_data = await get_style(db, coach_id)
                style_section = build_style_context(style_data.get("style_profile"))
                coach_notes_section = build_coach_notes_context(
                    style_data.get("coaching_style_notes")
                )

                example_workouts = await get_coach_example_workouts(db, coach_id)
                coach_examples_section = build_coach_examples(example_workouts)

                logger.info(
                    f"Stage 2 complete | style={'yes' if style_section else 'no'} | "
                    f"examples={len(example_workouts)} | "
                    f"notes={'yes' if coach_notes_section else 'no'}"
                )
            except Exception as e:
                logger.warning("Stage 2 coach personalisation failed, continuing without it")
                log_error(e, context="generate_workout_stage2", coach_id=coach_id)

        # ------------------------------------------------------------------
        # Build athlete context
        # ------------------------------------------------------------------
        athlete_section = ""
        if best_times:
            logger.debug(f"Adding athlete context with {len(best_times)} best times")
            athlete_section = build_athlete_context(best_times)

        # ------------------------------------------------------------------
        # Assemble full context
        # ------------------------------------------------------------------
        context_sections = [
            s for s in [
                style_section,
                coach_notes_section,
                coach_examples_section,
                global_context,
                athlete_section,
            ]
            if s
        ]
        full_context = "\n\n".join(context_sections)

        # ------------------------------------------------------------------
        # Generate workout with Claude
        # ------------------------------------------------------------------
        logger.info("Calling Anthropic Claude API to generate workout")
        workout = generate_with_claude(prompt, full_context, api_key)

        logger.info(f"Workout generated successfully | workout_length={len(workout)}")

        return {
            "workout": workout,
            "athlete_paces": build_athlete_context(best_times) if best_times else None,
        }

    except ValueError as e:
        logger.warning(f"Invalid workout generation request: {str(e)}")
        log_error(e, context="generate_workout", error_type="validation")
        raise

    except Exception as e:
        logger.error("Failed to generate workout with Claude")
        log_error(e, context="generate_workout", num_examples=num_examples)
        raise Exception(f"Failed to generate workout: {str(e)}")
