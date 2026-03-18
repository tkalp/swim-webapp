# swim-scraper

Python library and CLI for scraping swimming times from [swimrankings.net](https://www.swimrankings.net/).

Built on [DrissionPage](https://github.com/g1879/DrissionPage) to drive a real Chromium browser, which allows it to handle Cloudflare Turnstile challenges automatically after a one-time manual click.

## Requirements

- Python 3.11+
- Chromium (default path: `/usr/bin/chromium`)
- DrissionPage

```bash
pip3 install DrissionPage
```

## Quick Start

### Library

```python
from swimrankings import SwimRankings

with SwimRankings(email="you@example.com", password="secret") as sr:
    # Search for athletes
    athletes = sr.search("Adam Peaty")
    print(athletes[0].name, athletes[0].id)

    # Get personal bests
    bests = sr.personal_bests(athletes[0].id)
    for r in bests:
        print(f"{r.event} ({r.course}): {r.time}")

    # Get full race history
    history = sr.history(athletes[0].id)
    print(f"{history.athlete_name}: {history.total_results} results")

    # List recent meets
    meets = sr.recent_meets()
```

### CLI

```bash
python swimrankings_scraper.py search "Adam Peaty"
python swimrankings_scraper.py times 4636962
python swimrankings_scraper.py history 4636962
python swimrankings_scraper.py meets
```

## Authentication

Credentials are resolved in the following order:

1. **Constructor arguments** -- `email` and `password` passed to `SwimRankings()`
2. **Environment variables** -- `SWIMRANKINGS_EMAIL` and `SWIMRANKINGS_PASSWORD`
3. **Credential file** -- `~/.swimrankings_creds.json` (created with `save_credentials()` or the `login` CLI command)

To save credentials for future use:

```bash
python swimrankings_scraper.py login you@example.com secret
```

Or from Python:

```python
sr.login("you@example.com", "secret")  # saves to ~/.swimrankings_creds.json
```

The credential file is stored with mode `0600` (owner-only read/write).

## API Reference

### Constructor

```python
SwimRankings(
    email=None,
    password=None,
    rate_limit_min=2.0,
    rate_limit_max=5.0,
    browser_path="/usr/bin/chromium",
    profile_dir="/tmp/swimrankings_profile",
    cf_timeout=90,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `email` | `str` | `None` | Login email. Falls back to env/file if omitted. |
| `password` | `str` | `None` | Login password. Falls back to env/file if omitted. |
| `rate_limit_min` | `float` | `2.0` | Minimum seconds between requests. |
| `rate_limit_max` | `float` | `5.0` | Maximum seconds between requests. |
| `browser_path` | `str` | `"/usr/bin/chromium"` | Path to the Chromium binary. |
| `profile_dir` | `str` | `"/tmp/swimrankings_profile"` | Persistent browser profile directory. |
| `cf_timeout` | `int` | `90` | Seconds to wait for Cloudflare challenge. |

### Methods

| Method | Arguments | Return Type | Description |
|---|---|---|---|
| `start()` | -- | `SwimRankings` | Launch browser, warm up session, auto-login. Called automatically by `__enter__`. |
| `close()` | -- | `None` | Shut down the browser. Called automatically by `__exit__`. |
| `search(name)` | `name: str` | `list[Athlete]` | Search for athletes by name. |
| `personal_bests(athlete_id)` | `athlete_id: str` | `list[RaceResult]` | Get personal best times (first result per event/course). |
| `history(athlete_id)` | `athlete_id: str` | `AthleteHistory` | Get full race history across all events and seasons. |
| `recent_meets()` | -- | `list[Meet]` | Fetch the list of recent meets. |
| `login(email, password)` | `email: str, password: str` | `None` | Manually log in and save credentials to disk. |

## Data Models

All data classes provide a `to_dict()` method for JSON serialization.

### `Stroke` (Enum)

Values: `FREESTYLE`, `BACKSTROKE`, `BREASTSTROKE`, `BUTTERFLY`, `MEDLEY`, `UNKNOWN`.

Use `Stroke.from_event(event_name)` to derive stroke from an event string (e.g., `"100m Breaststroke"` returns `Stroke.BREASTSTROKE`).

### `Athlete`

| Field | Type | Description |
|---|---|---|
| `id` | `str` | Athlete ID on swimrankings.net |
| `name` | `str` | Athlete full name |

### `RaceResult`

| Field | Type | Description |
|---|---|---|
| `event` | `str` | Event name (e.g., `"100m Breaststroke"`) |
| `course` | `str` | `"LCM"` (50m) or `"SCM"` (25m) |
| `time` | `str` | Swim time (e.g., `"57.13"` or `"2:06.12"`) |
| `points` | `str` | FINA/World Aquatics points |
| `date` | `str` | Competition date |
| `city` | `str` | Competition city |
| `meet` | `str` | Meet name |
| `stroke` | `Stroke` | Auto-derived from `event` name if not set explicitly |

### `Meet`

| Field | Type | Description |
|---|---|---|
| `id` | `str` | Meet ID on swimrankings.net |
| `name` | `str` | Meet name |

### `AthleteHistory`

| Field | Type | Description |
|---|---|---|
| `athlete_id` | `str` | Athlete ID |
| `athlete_name` | `str` | Athlete full name |
| `events` | `list[str]` | List of event names scraped |
| `seasons` | `list[str]` | Available seasons/years |
| `results` | `list[RaceResult]` | All race results |
| `total_results` | `int` | Property: `len(results)` |

## CLI Options

```
usage: swimrankings_scraper.py [-e EMAIL] [-p PASSWORD] [--delay SECONDS] COMMAND ...

Global options:
  -e, --email EMAIL       Login email (or set SWIMRANKINGS_EMAIL)
  -p, --password PASSWORD Login password (or set SWIMRANKINGS_PASSWORD)
  --delay SECONDS         Fixed delay between requests (default: random 2-5s)

Commands:
  login [EMAIL] [PASSWORD]   Log in and save credentials to ~/.swimrankings_creds.json
  search NAME                Search for an athlete by name
  times ATHLETE_ID           Get personal bests for an athlete by ID
  history ATHLETE_ID         Get full race history for an athlete (all events, all times)
  meets                      List recent meets
  dump URL [-o FILE]         Dump raw HTML from any swimrankings URL (default: dump.html)
```

All data commands (search, times, history, meets) save output to `swimrankings_<command>.json`.

## Rate Limiting

Requests are spaced with a random delay between `rate_limit_min` and `rate_limit_max` seconds (default 2--5s) to avoid triggering blocks.

**Library:**

```python
sr = SwimRankings(rate_limit_min=3.0, rate_limit_max=8.0)
```

**CLI:**

```bash
python swimrankings_scraper.py --delay 4 history 4636962
```

The `--delay` flag sets both min and max to the same value for a fixed interval.

## Cloudflare Handling

swimrankings.net uses Cloudflare Turnstile. This scraper handles it as follows:

1. **Persistent profile** -- A browser profile is stored at `profile_dir` (default `/tmp/swimrankings_profile`). Cloudflare clearance cookies persist across runs.
2. **First run** -- On the very first launch (no existing profile), Cloudflare will present a Turnstile challenge. You need to **click the checkbox manually** in the browser window. The scraper waits up to `cf_timeout` seconds (default 90) for this.
3. **Subsequent runs** -- With a valid profile, Cloudflare is bypassed automatically using the stored cookies. No manual interaction needed unless cookies expire.

## Project Structure

```
swim-scraper/
  swimrankings/
    __init__.py          Package exports (SwimRankings, models)
    client.py            SwimRankings client class (public API)
    models.py            Data classes: Stroke, Athlete, RaceResult, Meet, AthleteHistory
    parsers.py           HTML parsing functions (pure, no browser dependency)
    browser.py           Browser creation and Cloudflare challenge handling
    auth.py              Credential storage and login logic
    urls.py              URL builder functions for swimrankings.net
    rate_limit.py        RateLimiter class (random delay between requests)
  tests/
    test_models.py       Tests for data models and Stroke.from_event
    test_parsers.py      Tests for HTML parsers
    test_rate_limit.py   Tests for rate limiter
  swimrankings_scraper.py  CLI entrypoint (standalone script)
```
