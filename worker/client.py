"""
Lazy singleton manager for the SwimRankings DrissionPage client.

The singleton creates the browser on first use, reuses it across Celery tasks
(concurrency=1), and recreates it automatically if the browser crashes.
"""
import sys
import os
import logging

# Add swim-scraper to path so 'swimrankings' can be imported.
_scraper_path = os.path.join(os.path.dirname(__file__), "swim-scraper")
if _scraper_path not in sys.path:
    sys.path.insert(0, _scraper_path)

from swimrankings import SwimRankings
from worker import config

logger = logging.getLogger("client")


class SwimRankingsClientManager:
    """
    Lazy singleton that owns a single SwimRankings browser session.

    Usage::

        client = SwimRankingsClientManager.get_client()
        results = client.get_athlete_history(athlete_id)
    """

    _instance: SwimRankings | None = None

    @classmethod
    def get_client(cls) -> SwimRankings:
        """
        Return the live SwimRankings client, creating or recreating it as needed.

        On first call the browser is started.  On subsequent calls the existing
        instance is returned unchanged.  If the browser has crashed (page.title
        raises), the stale instance is closed and a fresh one is started.
        """
        if cls._instance is None or not cls._is_alive():
            cls._cleanup()
            logger.info("Creating new SwimRankings client...")
            cls._instance = SwimRankings(
                email=config.SWIMRANKINGS_EMAIL,
                password=config.SWIMRANKINGS_PASSWORD,
                browser_path=config.CHROMIUM_PATH,
                profile_dir=config.BROWSER_PROFILE_DIR,
                cf_timeout=config.CF_TIMEOUT,
            ).start()
            logger.info("SwimRankings client started successfully.")
        return cls._instance

    @classmethod
    def _is_alive(cls) -> bool:
        """Return True if the current browser instance is responsive."""
        try:
            _ = cls._instance.page.title
            return True
        except Exception:
            return False

    @classmethod
    def _cleanup(cls) -> None:
        """Close the existing browser instance (if any) and clear the reference."""
        if cls._instance is not None:
            try:
                cls._instance.close()
            except Exception:
                pass
            cls._instance = None
