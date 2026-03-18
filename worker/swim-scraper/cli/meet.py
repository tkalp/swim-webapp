"""Handlers for meet subcommands."""

from .globals import output, make_client


def cmd_list(args):
    """List recent meets, optionally filtered by nation."""
    nation = getattr(args, 'nation', None)
    with make_client(args) as sr:
        if nation:
            meets = sr.meet_search(nation)
        else:
            meets = sr.recent_meets()
        output(meets, args)


def cmd_results(args):
    """Show results for a specific meet."""
    gender = getattr(args, 'gender', None)
    with make_client(args) as sr:
        results = sr.meet_results(args.meet_id, gender=gender)
        if hasattr(args, 'event') and args.event:
            query = args.event.lower()
            results = [r for r in results if query in r.event.lower()]
        output(results, args)
