"""Handlers for utility commands: login, dump."""

import os

from swimrankings import SwimRankings
from .globals import make_client


def cmd_login(args):
    """Log in and persist credentials."""
    email = args.email or os.environ.get("SWIMRANKINGS_EMAIL") or input("Email: ")
    password = args.password or os.environ.get("SWIMRANKINGS_PASSWORD") or input("Password: ")
    with SwimRankings(email=email, password=password, rate_limit_min=args.delay) as sr:
        sr.login(email, password)
        print("Login successful.", flush=True)


def cmd_dump(args):
    """Fetch raw HTML from a URL and print to stdout."""
    with make_client(args) as sr:
        html = sr.dump(args.url)
        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(html)
            print(f"HTML saved to {args.output}", flush=True)
        else:
            print(html)
