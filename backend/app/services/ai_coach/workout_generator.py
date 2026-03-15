"""ChromaDB RAG workout generator.

Implements the retrieval-augmented generation pipeline:
1. Search ChromaDB for similar workouts (vector similarity).
2. Build context from retrieved examples + athlete pace data.
3. Call Claude via the client module to produce the final workout.

Also exposes a health-check helper for the /ai-coach/health endpoint.
"""

import os
from typing import Optional, Dict

import chromadb

from app.utils import logger, log_error
from .prompt_builder import build_athlete_context
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
# ChromaDB search
# ---------------------------------------------------------------------------

def search_similar_workouts(query: str, n_results: int = 5) -> list[dict]:
    """Search ChromaDB for similar workouts by vector similarity."""
    logger.debug(f"Searching ChromaDB for similar workouts | query_length={len(query)} | n_results={n_results}")

    try:
        client = get_chroma_client()
        collection = client.get_collection(name=COLLECTION_NAME)

        count = collection.count()
        n = min(n_results, count) if count > 0 else 0
        if n == 0:
            logger.info("ChromaDB collection is empty, returning no results")
            return []

        results = collection.query(
            query_texts=[query],
            n_results=n,
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

def generate_workout(
    prompt: str,
    best_times: Optional[Dict[str, str]] = None
) -> dict:
    """Generate a workout using ChromaDB RAG + Claude.

    Args:
        prompt: User's natural-language workout request.
        best_times: Optional dict mapping distance strings to time strings,
                    e.g. {"50": "24.5", "100": "52.3"}.

    Returns:
        Dict with "workout" text and optional "athlete_paces".
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not found in environment variables")

    num_examples = 6

    logger.info(
        f"Generating workout | num_examples={num_examples} | "
        f"has_best_times={bool(best_times)} | prompt_length={len(prompt)}"
    )

    try:
        # Step 1: Search ChromaDB
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

        # Step 4: Generate workout with Claude
        logger.info("Calling Anthropic Claude API to generate workout")

        workout = generate_with_claude(prompt, context, api_key)

        logger.info(f"Workout generated successfully | workout_length={len(workout)}")

        # Step 5: Return response
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
