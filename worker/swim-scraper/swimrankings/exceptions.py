"""Custom exceptions for the swimrankings package."""


class SwimRankingsError(Exception):
    """Base exception for all swimrankings errors."""


class EventNotFoundError(SwimRankingsError):
    """Raised when a style_id cannot be resolved from an event name query."""

    def __init__(self, query: str, available: list[str]):
        self.query = query
        self.available = available
        super().__init__(
            f"No event matching '{query}'. Available: {', '.join(available)}"
        )


class ParseError(SwimRankingsError):
    """Raised when HTML structure is unexpected or changed."""


class AuthError(SwimRankingsError):
    """Raised when login fails."""
