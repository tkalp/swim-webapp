"""Handlers for cache subcommands — offline queries, no browser needed."""

import sys
from swimrankings.cache import CacheStore
from .globals import output


def _get_store(args) -> CacheStore:
    """Get a CacheStore from CLI args."""
    return CacheStore(db_path=getattr(args, 'cache_path', '~/.swimrankings_cache.db'))


def cmd_athletes(args):
    """List all cached athletes."""
    store = _get_store(args)
    athletes = store.list_athletes()
    output(athletes, args)
    store.close()


def cmd_results(args):
    """Query cached results for an athlete."""
    store = _get_store(args)
    results = store.query_results(
        args.athlete_id,
        event=getattr(args, 'event', None),
        course=getattr(args, 'course', None),
        stroke=getattr(args, 'stroke', None),
        season=getattr(args, 'season', None),
    )
    output(results, args, headers=["event", "course", "time", "points", "date", "city", "meet"])
    store.close()


def cmd_meets(args):
    """List all cached meets."""
    store = _get_store(args)
    meets = store.list_meets()
    output(meets, args)
    store.close()


def cmd_stats(args):
    """Show cache statistics."""
    store = _get_store(args)
    s = store.stats()
    output(s, args)
    store.close()


def cmd_clear(args):
    """Clear the cache."""
    store = _get_store(args)
    athlete_id = getattr(args, 'athlete_id', None)
    store.clear(athlete_id=athlete_id)
    if athlete_id:
        print(f"Cleared cache for athlete {athlete_id}", file=sys.stderr)
    else:
        print("Cache cleared", file=sys.stderr)
    store.close()
