"""ChromaDB writer for storing classified workouts."""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any

from ingestion.models import ClassifiedWorkout, WorkoutSource


class ChromaDBWriter:
    """Writes ClassifiedWorkout instances into a ChromaDB collection.

    Supports check-then-add deduplication (by content hash) and retry
    logic with exponential backoff for transient write failures.
    """

    def __init__(
        self,
        collection: Any = None,
        chroma_path: str | None = None,
        batch_size: int = 50,
    ) -> None:
        if collection is not None:
            self._collection = collection
        elif chroma_path is not None:
            import chromadb

            client = chromadb.PersistentClient(path=chroma_path)
            self._collection = client.get_or_create_collection("swimming_workouts")
        else:
            raise ValueError("Either collection or chroma_path must be provided")

        self._batch_size = batch_size

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def write(self, workouts: list[ClassifiedWorkout]) -> dict[str, int]:
        """Write workouts to ChromaDB, skipping duplicates.

        Returns a dict with ``added`` and ``skipped`` counts.
        """
        if not workouts:
            return {"added": 0, "skipped": 0}

        # Check which IDs already exist
        all_ids = [w.content_hash for w in workouts]
        existing = set(self._collection.get(ids=all_ids)["ids"])

        # Filter to new workouts only
        new_workouts = [w for w in workouts if w.content_hash not in existing]
        skipped = len(workouts) - len(new_workouts)

        if not new_workouts:
            return {"added": 0, "skipped": skipped}

        # Build payload and write in batches
        ingested_at = datetime.now(timezone.utc).isoformat()

        for start in range(0, len(new_workouts), self._batch_size):
            batch = new_workouts[start : start + self._batch_size]
            ids = [w.content_hash for w in batch]
            documents = [w.document for w in batch]
            metadatas = [self._build_metadata(w, ingested_at) for w in batch]

            self._add_with_retry(ids=ids, documents=documents, metadatas=metadatas)

        return {"added": len(new_workouts), "skipped": skipped}

    def count(self) -> int:
        """Return the total number of documents in the collection."""
        return self._collection.count()

    def stats(self) -> dict[str, Any]:
        """Return total count and breakdown by source.

        Note: uses ``collection.get(where=...)`` which loads matching docs
        into memory. Fine for collections up to ~1000 workouts.
        """
        total = self._collection.count()
        by_source: dict[str, int] = {}
        for source in WorkoutSource:
            result = self._collection.get(where={"source": source.value})
            by_source[source.value] = len(result["ids"])

        return {"total": total, "by_source": by_source}

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _build_metadata(
        self, workout: ClassifiedWorkout, ingested_at: str
    ) -> dict[str, Any]:
        """Convert a ClassifiedWorkout into a flat ChromaDB metadata dict.

        Enum values are stored as their ``.value`` string. Nullable strings
        default to empty string because ChromaDB does not support None in
        metadata values.
        """
        meta = workout.metadata
        return {
            "title": workout.title,
            "source_url": workout.source_url or "",
            "source_name": workout.source_name or "",
            "coach_notes": workout.coach_notes or "",
            "training_focus": meta.training_focus.value,
            "energy_zone": meta.energy_zone.value if meta.energy_zone else "",
            "level": meta.level.value,
            "distance_unit": meta.distance_unit.value,
            "source": meta.source.value if meta.source else "",
            "total_distance": meta.total_distance,
            "estimated_minutes": meta.estimated_minutes,
            "pct_free": meta.pct_free,
            "pct_back": meta.pct_back,
            "pct_breast": meta.pct_breast,
            "pct_fly": meta.pct_fly,
            "pct_im": meta.pct_im,
            "pct_kick": meta.pct_kick,
            "pct_drill": meta.pct_drill,
            "ingested_at": ingested_at,
        }

    def _add_with_retry(
        self,
        ids: list[str],
        documents: list[str],
        metadatas: list[dict[str, Any]],
        max_attempts: int = 3,
    ) -> None:
        """Call ``collection.add()`` with exponential backoff on failure."""
        for attempt in range(max_attempts):
            try:
                self._collection.add(
                    ids=ids, documents=documents, metadatas=metadatas
                )
                return
            except Exception:
                if attempt == max_attempts - 1:
                    raise
                time.sleep(2**attempt)  # 1s, 2s
