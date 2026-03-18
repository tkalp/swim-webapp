"""Handler for the rankings command."""

from .globals import output, make_client


def cmd_rankings(args):
    """Query rankings/leaderboard."""
    with make_client(args) as sr:
        from swimrankings.parsers import parse_event_list, resolve_style_id
        from swimrankings import urls
        html = sr._fetch(urls.athlete_search())
        events = parse_event_list(html)
        match = resolve_style_id(events, args.event)

        rankings = sr.rankings(
            style_id=match["style_id"],
            gender=args.gender,
            nation_id=0,
            season=getattr(args, 'season', None),
        )
        output(rankings, args)
