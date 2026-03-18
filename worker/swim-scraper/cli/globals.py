"""Shared CLI utilities: flag definitions, credential resolution, filter helpers."""

import os
from swimrankings.output import render


def add_global_flags(parser):
    """Add flags common to all commands."""
    parser.add_argument("-e", "--email", default=None, help="swimrankings.net email")
    parser.add_argument("-p", "--password", default=None, help="swimrankings.net password")
    parser.add_argument("--delay", type=float, default=2.0, help="Minimum delay between requests (seconds)")
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable debug logging")
    parser.add_argument("-q", "--quiet", action="store_true", help="Suppress stderr table output")
    parser.add_argument("--no-json", action="store_true", dest="no_json", help="Suppress stdout JSON output")
    parser.add_argument("-o", "--output", default=None, help="Write JSON to this file")
    parser.add_argument("--refresh", action="store_true", help="Force fresh scrape, bypass cache")
    parser.add_argument("--no-cache", action="store_true", dest="no_cache", help="Disable caching entirely")
    parser.add_argument("--cache-path", default="~/.swimrankings_cache.db", help="Cache database path")


def add_filter_flags(parser, event=False, course=False, stroke=False, season=False, gender=False, nation=False):
    """Add filter flags to a subcommand parser. Only adds the flags you request."""
    if event:
        parser.add_argument("--event", default=None, help="Filter by event name (substring match)")
    if course:
        parser.add_argument("--course", default=None, choices=["LCM", "SCM"], help="Filter by pool size")
    if stroke:
        parser.add_argument("--stroke", default=None, choices=["free", "back", "breast", "fly", "medley"],
                            help="Filter by stroke type")
    if season:
        parser.add_argument("--season", default=None, help="Filter by season year")
    if gender:
        parser.add_argument("--gender", default=None, choices=["M", "F"], help="Filter by gender")
    if nation:
        parser.add_argument("--nation", default=None, help="Filter by 3-letter country code")


def apply_filters(results, args):
    """Apply client-side filters to a list of RaceResult-like dicts or objects.

    Works with both RaceResult objects (attribute access) and dicts.
    """
    from swimrankings.models import Stroke

    filtered = results
    if hasattr(args, 'event') and args.event:
        query = args.event.lower()
        filtered = [r for r in filtered if query in _get(r, 'event', '').lower()]
    if hasattr(args, 'course') and args.course:
        filtered = [r for r in filtered if _get(r, 'course', '') == args.course]
    if hasattr(args, 'stroke') and args.stroke:
        stroke_map = {"free": Stroke.FREESTYLE, "back": Stroke.BACKSTROKE,
                      "breast": Stroke.BREASTSTROKE, "fly": Stroke.BUTTERFLY, "medley": Stroke.MEDLEY}
        target = stroke_map[args.stroke]
        filtered = [r for r in filtered if _get(r, 'stroke', None) == target]
    if hasattr(args, 'season') and args.season:
        year = args.season
        filtered = [r for r in filtered if year in _get(r, 'date', '').split()[-1:]]
    return filtered


def _get(obj, key, default=None):
    """Get attribute or dict key from obj."""
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def make_client(args):
    """Create a SwimRankings client with cache support based on CLI args."""
    from swimrankings import SwimRankings
    cache = None
    if not getattr(args, 'no_cache', False):
        from swimrankings.cache import CacheStore
        cache = CacheStore(db_path=getattr(args, 'cache_path', '~/.swimrankings_cache.db'))
    return SwimRankings(
        email=args.email, password=args.password,
        rate_limit_min=args.delay,
        cache=cache, refresh=getattr(args, 'refresh', False),
    )


def output(data, args, headers=None):
    """Convenience wrapper for render() using CLI args."""
    if isinstance(data, list) and data and hasattr(data[0], 'to_dict'):
        data = [item.to_dict() for item in data]
    elif hasattr(data, 'to_dict'):
        data = data.to_dict()
    render(data, headers=headers, quiet=args.quiet, no_json=args.no_json, output=args.output)
