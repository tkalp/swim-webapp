"""Abstract base class for workout scrapers."""

from __future__ import annotations

from abc import ABC, abstractmethod

from ingestion.models import RawWorkout


class BaseScraper(ABC):
    """Base interface that every workout scraper must implement."""

    @abstractmethod
    def scrape(self) -> list[RawWorkout]:
        """Discover and return all workouts from this source."""
        ...

    @property
    @abstractmethod
    def source_name(self) -> str:
        """Human-readable name of the data source (e.g. 'SwimSwam')."""
        ...
