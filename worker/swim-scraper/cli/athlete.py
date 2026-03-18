"""Handlers for athlete subcommands."""

from collections import defaultdict
from .globals import apply_filters, output, make_client


def cmd_search(args):
    """Search for athletes by name."""
    nation = getattr(args, 'nation', None)
    with make_client(args) as sr:
        athletes = sr.search(args.name, nation=nation)
        output(athletes, args)


def cmd_details(args):
    """Show athlete profile details."""
    with make_client(args) as sr:
        athlete = sr.athlete_details(args.athlete_id)
        output(athlete, args)


def cmd_times(args):
    """Show personal-best times for an athlete."""
    with make_client(args) as sr:
        bests = sr.personal_bests(args.athlete_id)
        bests = apply_filters(bests, args)
        output(bests, args, headers=["event", "course", "time", "points", "date", "city", "meet"])


def cmd_history(args):
    """Show all times ever posted for an athlete (flat list)."""
    with make_client(args) as sr:
        history = sr.history(args.athlete_id)
        import sys
        if history.athlete_name:
            print(f"Athlete: {history.athlete_name} ({history.athlete_id})", file=sys.stderr)
            print(f"Total results: {history.total_results}", file=sys.stderr)
        results = apply_filters(history.results, args)
        output(results, args, headers=["event", "course", "time", "points", "date", "city", "meet"])


def cmd_compare(args):
    """Compare two athletes side-by-side."""
    with make_client(args) as sr:
        comparison = sr.compare(args.athlete_id_1, args.athlete_id_2)
        if hasattr(args, 'event') and args.event:
            query = args.event.lower()
            comparison.events = [e for e in comparison.events if query in e.event.lower()]
        if hasattr(args, 'course') and args.course:
            comparison.events = [e for e in comparison.events if e.course == args.course]
        output(comparison, args)


def cmd_progression(args):
    """Show time progression for a specific event."""
    with make_client(args) as sr:
        results = sr.progression(args.athlete_id, event_query=args.event)
        if hasattr(args, 'course') and args.course:
            results = [r for r in results if r.course == args.course]
        output(results, args, headers=["date", "time", "points", "course", "city", "meet"])


def cmd_qualify(args):
    """Compare athlete PBs against qualification standards."""
    import json
    import os
    import sys
    from swimrankings.models import parse_time

    standards_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "standards.json")
    if args.list_standards:
        if os.path.exists(standards_path):
            with open(standards_path) as f:
                standards = json.load(f)
            for key, val in standards.items():
                print(f"  {key}: {val['name']}", file=sys.stderr)
        else:
            print("No standards file found.", file=sys.stderr)
        return

    if not os.path.exists(standards_path):
        print(f"Standards file not found: {standards_path}", file=sys.stderr)
        return

    with open(standards_path) as f:
        all_standards = json.load(f)

    if args.standard not in all_standards:
        print(f"Unknown standard '{args.standard}'. Available: {', '.join(all_standards.keys())}", file=sys.stderr)
        return

    standard = all_standards[args.standard]
    cuts = standard["events"]

    with make_client(args) as sr:
        bests = sr.personal_bests(args.athlete_id)

    rows = []
    for cut in cuts:
        matching = [b for b in bests if cut["event"].lower() in b.event.lower()
                    and b.course == cut["course"]]
        if matching:
            pb = matching[0]
            pb_secs = parse_time(pb.time)
            cut_secs = parse_time(cut["time"])
            diff = pb_secs - cut_secs
            status = "QUALIFIED" if diff <= 0 else f"+{diff:.2f}s"
            rows.append({
                "event": cut["event"],
                "course": cut["course"],
                "cut_time": cut["time"],
                "pb_time": pb.time,
                "diff": f"{diff:+.2f}",
                "status": status,
            })
        else:
            rows.append({
                "event": cut["event"],
                "course": cut["course"],
                "cut_time": cut["time"],
                "pb_time": "\u2014",
                "diff": "\u2014",
                "status": "NO TIME",
            })

    output(rows, args, headers=["event", "course", "cut_time", "pb_time", "diff", "status"])
