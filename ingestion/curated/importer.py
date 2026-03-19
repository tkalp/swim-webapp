"""Curated workout importer — loads hand-compiled JSON workout files."""

from __future__ import annotations

import json
import logging
from glob import glob
from pathlib import Path
from typing import List

from ingestion.models import RawWorkout

logger = logging.getLogger(__name__)

_DATA_DIR = Path(__file__).resolve().parent / "data"


def import_from_file(file_path: str) -> List[RawWorkout]:
    """Load a single JSON file and return validated RawWorkout instances.

    Expected format: a JSON array of objects, each with at least a ``text``
    field.  Optional fields: ``title``, ``source_name``, ``coach_notes``.
    Invalid entries are skipped and logged.
    """
    path = Path(file_path)

    if not path.exists():
        logger.error("Curated file not found: %s", path)
        return []

    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        logger.error("Failed to parse %s: %s", path.name, exc)
        return []

    if not isinstance(raw, list):
        logger.error("%s: expected JSON array, got %s", path.name, type(raw).__name__)
        return []

    workouts: List[RawWorkout] = []
    for idx, entry in enumerate(raw):
        if not isinstance(entry, dict):
            logger.warning("%s[%d]: expected object, skipping", path.name, idx)
            continue

        text = entry.get("text")
        if not text or not isinstance(text, str) or not text.strip():
            logger.warning("%s[%d]: missing or empty 'text' field, skipping", path.name, idx)
            continue

        title = entry.get("title", f"Curated Workout #{idx + 1}")
        workouts.append(
            RawWorkout(
                title=title,
                text=text.strip(),
                source="curated",
                source_name=entry.get("source_name"),
                coach_notes=entry.get("coach_notes"),
            )
        )

    logger.info("Loaded %d workouts from %s", len(workouts), path.name)
    return workouts


def import_all_curated() -> List[RawWorkout]:
    """Glob ``ingestion/curated/data/*.json`` and import every file."""
    pattern = str(_DATA_DIR / "*.json")
    files = sorted(glob(pattern))

    if not files:
        logger.warning("No curated JSON files found in %s", _DATA_DIR)
        return []

    all_workouts: List[RawWorkout] = []
    for fp in files:
        all_workouts.extend(import_from_file(fp))

    logger.info("Total curated workouts loaded: %d", len(all_workouts))
    return all_workouts
