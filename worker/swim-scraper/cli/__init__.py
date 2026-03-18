"""CLI package — argument parser and dispatch."""

import argparse
import logging
import sys

from .globals import add_global_flags, add_filter_flags
from . import athlete, meet, rankings, util, cache as cache_cmds
from swimrankings.exceptions import SwimRankingsError


def build_parser():
    """Build the argument parser with all command groups."""
    # Parent parser with global flags — inherited by all subparsers
    global_parent = argparse.ArgumentParser(add_help=False)
    add_global_flags(global_parent)

    parser = argparse.ArgumentParser(
        prog="swimrankings",
        description="CLI for scraping swimrankings.net",
        parents=[global_parent],
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # --- login ---
    subparsers.add_parser("login", help="Log in and save credentials", parents=[global_parent])

    # --- dump ---
    sp_dump = subparsers.add_parser("dump", help="Fetch raw HTML from a URL", parents=[global_parent])
    sp_dump.add_argument("url", help="URL to fetch")

    # --- athlete ---
    sp_athlete = subparsers.add_parser("athlete", help="Athlete commands")
    athlete_sub = sp_athlete.add_subparsers(dest="athlete_command", required=True)

    sp_search = athlete_sub.add_parser("search", help="Search for athletes by name", parents=[global_parent])
    sp_search.add_argument("name", help="Athlete name")
    add_filter_flags(sp_search, nation=True)

    sp_details = athlete_sub.add_parser("details", help="Show athlete profile", parents=[global_parent])
    sp_details.add_argument("athlete_id", help="Athlete ID")

    sp_times = athlete_sub.add_parser("times", help="Show personal-best times", parents=[global_parent])
    sp_times.add_argument("athlete_id", help="Athlete ID")
    add_filter_flags(sp_times, event=True, course=True, stroke=True)

    sp_history = athlete_sub.add_parser("history", help="Show all race results", parents=[global_parent])
    sp_history.add_argument("athlete_id", help="Athlete ID")
    add_filter_flags(sp_history, event=True, course=True, stroke=True, season=True)

    sp_compare = athlete_sub.add_parser("compare", help="Compare two athletes", parents=[global_parent])
    sp_compare.add_argument("athlete_id_1", help="First athlete ID")
    sp_compare.add_argument("athlete_id_2", help="Second athlete ID")
    add_filter_flags(sp_compare, event=True, course=True)

    sp_progression = athlete_sub.add_parser("progression", help="Time progression for one event", parents=[global_parent])
    sp_progression.add_argument("athlete_id", help="Athlete ID")
    sp_progression.add_argument("--event", required=True, help="Event name (e.g. '100m Breaststroke')")
    add_filter_flags(sp_progression, course=True)

    sp_qualify = athlete_sub.add_parser("qualify", help="Compare PBs against qualification times", parents=[global_parent])
    sp_qualify.add_argument("athlete_id", nargs="?", help="Athlete ID")
    qualify_group = sp_qualify.add_mutually_exclusive_group(required=True)
    qualify_group.add_argument("--standard", default=None, help="Qualification standard key (e.g. OQT2024)")
    qualify_group.add_argument("--list-standards", action="store_true", help="List available standards")

    # --- meet ---
    sp_meet = subparsers.add_parser("meet", help="Meet commands")
    meet_sub = sp_meet.add_subparsers(dest="meet_command", required=True)

    sp_meet_list = meet_sub.add_parser("list", help="List recent meets", parents=[global_parent])
    add_filter_flags(sp_meet_list, nation=True)

    sp_meet_results = meet_sub.add_parser("results", help="Show meet results", parents=[global_parent])
    sp_meet_results.add_argument("meet_id", help="Meet ID")
    add_filter_flags(sp_meet_results, event=True, gender=True)

    # --- rankings ---
    sp_rankings = subparsers.add_parser("rankings", help="Query rankings/leaderboard", parents=[global_parent])
    sp_rankings.add_argument("--event", required=True, help="Event name (e.g. '100m Freestyle')")
    sp_rankings.add_argument("--gender", required=True, choices=["M", "F"], help="Gender")
    add_filter_flags(sp_rankings, nation=True, season=True, course=True)

    # --- cache ---
    sp_cache = subparsers.add_parser("cache", help="Offline cache commands")
    cache_sub = sp_cache.add_subparsers(dest="cache_command", required=True)

    cache_sub.add_parser("athletes", help="List cached athletes", parents=[global_parent])

    sp_cache_results = cache_sub.add_parser("results", help="Query cached results", parents=[global_parent])
    sp_cache_results.add_argument("athlete_id", help="Athlete ID")
    add_filter_flags(sp_cache_results, event=True, course=True, stroke=True, season=True)

    cache_sub.add_parser("meets", help="List cached meets", parents=[global_parent])

    cache_sub.add_parser("stats", help="Show cache statistics", parents=[global_parent])

    sp_cache_clear = cache_sub.add_parser("clear", help="Clear the cache", parents=[global_parent])
    sp_cache_clear.add_argument("athlete_id", nargs="?", help="Athlete ID (optional)")

    return parser


def main():
    """Parse args and dispatch to the appropriate handler."""
    parser = build_parser()
    args = parser.parse_args()

    level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    try:
        _dispatch(args)
    except SwimRankingsError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


def _dispatch(args):
    """Route to the correct command handler."""
    if args.command == "login":
        util.cmd_login(args)
    elif args.command == "dump":
        util.cmd_dump(args)
    elif args.command == "athlete":
        handlers = {
            "search": athlete.cmd_search,
            "details": athlete.cmd_details,
            "times": athlete.cmd_times,
            "history": athlete.cmd_history,
            "compare": athlete.cmd_compare,
            "progression": athlete.cmd_progression,
            "qualify": athlete.cmd_qualify,
        }
        handlers[args.athlete_command](args)
    elif args.command == "meet":
        handlers = {
            "list": meet.cmd_list,
            "results": meet.cmd_results,
        }
        handlers[args.meet_command](args)
    elif args.command == "rankings":
        rankings.cmd_rankings(args)
    elif args.command == "cache":
        handlers = {
            "athletes": cache_cmds.cmd_athletes,
            "results": cache_cmds.cmd_results,
            "meets": cache_cmds.cmd_meets,
            "stats": cache_cmds.cmd_stats,
            "clear": cache_cmds.cmd_clear,
        }
        handlers[args.cache_command](args)
