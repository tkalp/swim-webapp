"""
Configuration management for worker service.
"""

import os


class WorkerConfig:
    """Configuration for worker service."""

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")

    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # Task limits
    TASK_SOFT_TIME_LIMIT: int = int(os.getenv("TASK_SOFT_TIME_LIMIT", "3600"))
    TASK_TIME_LIMIT: int = int(os.getenv("TASK_TIME_LIMIT", "7200"))

    # SwimRankings credentials
    SWIMRANKINGS_EMAIL: str = os.getenv("SWIMRANKINGS_EMAIL", "")
    SWIMRANKINGS_PASSWORD: str = os.getenv("SWIMRANKINGS_PASSWORD", "")

    # DrissionPage / Chromium
    CHROMIUM_PATH: str = os.getenv("CHROMIUM_PATH", "/usr/bin/chromium")
    BROWSER_PROFILE_DIR: str = os.getenv("BROWSER_PROFILE_DIR", "/tmp/swimrankings_profile")
    CF_TIMEOUT: int = int(os.getenv("CF_TIMEOUT", "90"))

    # Sync freshness — results synced within this window are skipped
    SYNC_FRESHNESS_HOURS: int = int(os.getenv("SYNC_FRESHNESS_HOURS", "1"))

    @classmethod
    def validate(cls) -> None:
        """Validate required configuration."""
        if not cls.DATABASE_URL:
            raise ValueError("DATABASE_URL environment variable is required")


# Validate on import
WorkerConfig.validate()
