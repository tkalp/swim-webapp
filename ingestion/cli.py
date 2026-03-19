"""Click CLI for the workout ingestion pipeline.

Usage::

    python -m ingestion --help
    python -m ingestion status --chroma-path ./chroma_data
    python -m ingestion scrape --source swimswam --dry-run
    python -m ingestion run-all --chroma-path ./chroma_data
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path
from typing import Optional

import click

logger = logging.getLogger("ingestion")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _resolve_chroma_path(ctx_param: Optional[str]) -> str:
    """Return chroma_path from CLI flag, env var, or exit with error."""
    if ctx_param:
        return ctx_param

    # Lazy import so CLI startup stays fast when dotenv isn't needed
    from dotenv import dotenv_values

    env = dotenv_values(Path("backend") / ".env")
    path = env.get("CHROMA_DB_PATH")
    if path:
        return path

    import os

    path = os.environ.get("CHROMA_DB_PATH")
    if path:
        return path

    click.echo("Error: --chroma-path is required (or set CHROMA_DB_PATH in backend/.env)", err=True)
    sys.exit(1)


def _configure_logging(verbose: bool) -> None:
    """Set up root ingestion logger."""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )


def _print_stats(stats: dict[str, int]) -> None:
    """Pretty-print pipeline run statistics."""
    click.echo("\n--- Pipeline Results ---")
    click.echo(f"  Input workouts:      {stats.get('input', 0)}")
    click.echo(f"  Normalized:          {stats.get('normalized', 0)}")
    click.echo(f"  Classified:          {stats.get('classified', 0)}")
    click.echo(f"  Added to ChromaDB:   {stats.get('added', 0)}")
    click.echo(f"  Skipped (duplicate): {stats.get('skipped', 0)}")
    click.echo(f"  Normalize failures:  {stats.get('normalize_failed', 0)}")
    click.echo("------------------------\n")


# ---------------------------------------------------------------------------
# CLI group
# ---------------------------------------------------------------------------

@click.group()
@click.option("--chroma-path", default=None, help="Path to ChromaDB storage directory (overrides env).")
@click.option("--verbose", is_flag=True, default=False, help="Enable debug logging.")
@click.pass_context
def cli(ctx: click.Context, chroma_path: Optional[str], verbose: bool) -> None:
    """Aquilus workout ingestion pipeline CLI."""
    ctx.ensure_object(dict)
    ctx.obj["chroma_path_flag"] = chroma_path
    ctx.obj["verbose"] = verbose
    _configure_logging(verbose)


# ---------------------------------------------------------------------------
# scrape
# ---------------------------------------------------------------------------

@cli.command()
@click.option(
    "--source",
    type=click.Choice(["swimswam", "usms"], case_sensitive=False),
    required=True,
    help="Which source to scrape.",
)
@click.option("--dry-run", is_flag=True, default=False, help="Run pipeline without writing to ChromaDB.")
@click.pass_context
def scrape(ctx: click.Context, source: str, dry_run: bool) -> None:
    """Scrape workouts from an external source and run through the pipeline."""
    import asyncio

    from ingestion.pipeline import run_pipeline

    chroma_path = _resolve_chroma_path(ctx.obj["chroma_path_flag"])

    click.echo(f"Scraping from {source}...")

    if source == "swimswam":
        from ingestion.scrapers.swimswam import SwimSwamScraper

        raw_workouts = SwimSwamScraper().scrape()
    else:
        from ingestion.scrapers.usms import USMSScraper

        raw_workouts = USMSScraper().scrape()

    click.echo(f"Scraped {len(raw_workouts)} raw workouts from {source}.")

    if not raw_workouts:
        click.echo("No workouts to process.")
        return

    stats = asyncio.run(run_pipeline(raw_workouts, chroma_path, dry_run=dry_run))
    _print_stats(stats)


# ---------------------------------------------------------------------------
# import
# ---------------------------------------------------------------------------

@cli.command("import")
@click.option("--file", "file_path", type=click.Path(exists=True), default=None, help="Path to a curated workout file.")
@click.option("--dry-run", is_flag=True, default=False, help="Run pipeline without writing to ChromaDB.")
@click.pass_context
def import_cmd(ctx: click.Context, file_path: Optional[str], dry_run: bool) -> None:
    """Import curated workouts from local files and run through the pipeline."""
    import asyncio

    from ingestion.curated.importer import import_all_curated, import_from_file
    from ingestion.pipeline import run_pipeline

    chroma_path = _resolve_chroma_path(ctx.obj["chroma_path_flag"])

    if file_path:
        click.echo(f"Importing from file: {file_path}")
        raw_workouts = import_from_file(Path(file_path))
    else:
        click.echo("Importing all curated workouts...")
        raw_workouts = import_all_curated()

    click.echo(f"Loaded {len(raw_workouts)} raw workouts from curated data.")

    if not raw_workouts:
        click.echo("No workouts to process.")
        return

    stats = asyncio.run(run_pipeline(raw_workouts, chroma_path, dry_run=dry_run))
    _print_stats(stats)


# ---------------------------------------------------------------------------
# generate
# ---------------------------------------------------------------------------

@cli.command()
@click.option("--count", default=300, show_default=True, help="Number of workouts to generate.")
@click.option("--dry-run", is_flag=True, default=False, help="Run pipeline without writing to ChromaDB.")
@click.pass_context
def generate(ctx: click.Context, count: int, dry_run: bool) -> None:
    """Generate AI workouts via Claude and run through the pipeline."""
    import asyncio

    from ingestion.generators.ai_generator import generate_workouts
    from ingestion.pipeline import run_pipeline

    chroma_path = _resolve_chroma_path(ctx.obj["chroma_path_flag"])

    click.echo(f"Generating {count} AI workouts...")

    async def _run() -> dict[str, int]:
        raw_workouts = await generate_workouts(count=count)
        click.echo(f"Generated {len(raw_workouts)} raw workouts.")
        if not raw_workouts:
            return {"input": 0, "normalized": 0, "classified": 0, "added": 0, "skipped": 0, "normalize_failed": 0}
        return await run_pipeline(raw_workouts, chroma_path, dry_run=dry_run)

    stats = asyncio.run(_run())
    _print_stats(stats)


# ---------------------------------------------------------------------------
# run-all
# ---------------------------------------------------------------------------

@cli.command("run-all")
@click.option("--dry-run", is_flag=True, default=False, help="Run pipeline without writing to ChromaDB.")
@click.pass_context
def run_all(ctx: click.Context, dry_run: bool) -> None:
    """Run the full pipeline: scrape all sources, import curated, generate AI workouts."""
    import asyncio

    from ingestion.generators.ai_generator import generate_workouts
    from ingestion.pipeline import run_pipeline
    from ingestion.scrapers.swimswam import SwimSwamScraper
    from ingestion.scrapers.usms import USMSScraper

    chroma_path = _resolve_chroma_path(ctx.obj["chroma_path_flag"])

    # --- Scrape (synchronous) ---
    click.echo("Step 1/4: Scraping SwimSwam...")
    swimswam_workouts = SwimSwamScraper().scrape()
    click.echo(f"  -> {len(swimswam_workouts)} workouts from SwimSwam")

    click.echo("Step 2/4: Scraping USMS...")
    usms_workouts = USMSScraper().scrape()
    click.echo(f"  -> {len(usms_workouts)} workouts from USMS")

    # --- Import curated ---
    click.echo("Step 3/4: Importing curated workouts...")
    try:
        from ingestion.curated.importer import import_all_curated

        curated_workouts = import_all_curated()
    except (ImportError, Exception) as exc:
        logger.warning("Curated import failed (may not be implemented yet): %s", exc)
        curated_workouts = []
    click.echo(f"  -> {len(curated_workouts)} curated workouts")

    # --- Generate (async) ---
    click.echo("Step 4/4: Generating AI workouts...")

    async def _run() -> dict[str, int]:
        ai_workouts = await generate_workouts(count=300)
        click.echo(f"  -> {len(ai_workouts)} AI-generated workouts")

        all_workouts = swimswam_workouts + usms_workouts + curated_workouts + ai_workouts
        click.echo(f"\nTotal: {len(all_workouts)} workouts collected. Running pipeline...")

        if not all_workouts:
            return {"input": 0, "normalized": 0, "classified": 0, "added": 0, "skipped": 0, "normalize_failed": 0}

        return await run_pipeline(all_workouts, chroma_path, dry_run=dry_run)

    stats = asyncio.run(_run())
    _print_stats(stats)


# ---------------------------------------------------------------------------
# status
# ---------------------------------------------------------------------------

@cli.command()
@click.pass_context
def status(ctx: click.Context) -> None:
    """Show ChromaDB collection statistics."""
    from ingestion.chromadb_writer import ChromaDBWriter

    chroma_path = _resolve_chroma_path(ctx.obj["chroma_path_flag"])

    click.echo(f"ChromaDB path: {chroma_path}")
    writer = ChromaDBWriter(chroma_path=chroma_path)
    stats = writer.stats()

    click.echo(f"\nTotal workouts: {stats['total']}")
    click.echo("\nBy source:")
    for source, count in stats["by_source"].items():
        click.echo(f"  {source:<20} {count}")

    if stats["total"] == 0:
        click.echo("\nCollection is empty. Run 'python -m ingestion run-all' to populate.")


# ---------------------------------------------------------------------------
# export
# ---------------------------------------------------------------------------

@cli.command()
@click.option("--output", "-o", required=True, type=click.Path(), help="Output file path.")
@click.option(
    "--format",
    "fmt",
    type=click.Choice(["json"], case_sensitive=False),
    default="json",
    show_default=True,
    help="Export format (only json supported).",
)
@click.pass_context
def export(ctx: click.Context, output: str, fmt: str) -> None:
    """Export ChromaDB collection to a file."""
    import json

    import chromadb

    chroma_path = _resolve_chroma_path(ctx.obj["chroma_path_flag"])

    click.echo(f"Exporting from {chroma_path}...")
    client = chromadb.PersistentClient(path=chroma_path)
    collection = client.get_or_create_collection("swimming_workouts")

    total = collection.count()
    if total == 0:
        click.echo("Collection is empty — nothing to export.")
        return

    # Fetch all documents
    result = collection.get(include=["documents", "metadatas"])

    records = []
    for doc_id, document, metadata in zip(result["ids"], result["documents"], result["metadatas"]):
        records.append({
            "id": doc_id,
            "document": document,
            "metadata": metadata,
        })

    output_path = Path(output)
    output_path.write_text(json.dumps(records, indent=2), encoding="utf-8")
    click.echo(f"Exported {len(records)} workouts to {output_path}")
