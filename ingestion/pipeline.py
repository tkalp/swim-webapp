"""Pipeline orchestrator: normalize -> classify -> write to ChromaDB."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from ingestion.chromadb_writer import ChromaDBWriter
from ingestion.classifier import classify_batch
from ingestion.models import ClassifiedWorkout, NormalizedWorkout, RawWorkout
from ingestion.normalizer import normalize

if TYPE_CHECKING:
    from anthropic import AsyncAnthropic

logger = logging.getLogger(__name__)


async def run_pipeline(
    raw_workouts: list[RawWorkout],
    chroma_path: str,
    anthropic_client: AsyncAnthropic | None = None,
    max_concurrent: int = 10,
    batch_size: int = 50,
    dry_run: bool = False,
) -> dict[str, int]:
    """Run the full ingestion pipeline: normalize, classify, write.

    Parameters
    ----------
    raw_workouts:
        Raw workouts to process.
    chroma_path:
        Path to the ChromaDB persistent storage directory.
    anthropic_client:
        Optional shared Anthropic client for classification.
    max_concurrent:
        Max concurrent Claude API calls during classification.
    batch_size:
        Batch size for ChromaDB writes.
    dry_run:
        If True, skip the ChromaDB write step and log what would be written.

    Returns
    -------
    dict[str, int]
        Statistics: input, normalized, classified, added, skipped, normalize_failed.
    """
    total_input = len(raw_workouts)
    logger.info("Pipeline started: %d raw workouts", total_input)

    # Step 1: Normalize
    normalized: list[NormalizedWorkout] = []
    normalize_failed = 0
    for raw in raw_workouts:
        result = normalize(raw)
        if result is not None:
            normalized.append(result)
        else:
            normalize_failed += 1
            logger.debug("Normalization returned None for '%s'", raw.title)

    logger.info(
        "Normalization complete: %d succeeded, %d failed",
        len(normalized),
        normalize_failed,
    )

    # Step 2: Classify
    metadata_list = await classify_batch(
        normalized, client=anthropic_client, max_concurrent=max_concurrent
    )
    logger.info("Classification complete: %d workouts classified", len(metadata_list))

    # Step 3: Build ClassifiedWorkout list
    classified: list[ClassifiedWorkout] = []
    for workout, meta in zip(normalized, metadata_list):
        classified.append(
            ClassifiedWorkout(
                title=workout.title,
                text=workout.text,
                document=workout.document,
                source=workout.source,
                source_url=workout.source_url,
                source_name=workout.source_name,
                coach_notes=workout.coach_notes,
                metadata=meta,
            )
        )

    # Step 4: Write or dry-run
    if dry_run:
        logger.info("Dry run: would write %d workouts to ChromaDB", len(classified))
        added = 0
        skipped = 0
    else:
        writer = ChromaDBWriter(chroma_path=chroma_path, batch_size=batch_size)
        write_result = writer.write(classified)
        added = write_result["added"]
        skipped = write_result["skipped"]
        logger.info("Write complete: %d added, %d skipped", added, skipped)

    stats = {
        "input": total_input,
        "normalized": len(normalized),
        "classified": len(classified),
        "added": added,
        "skipped": skipped,
        "normalize_failed": normalize_failed,
    }
    logger.info("Pipeline complete: %s", stats)
    return stats
