"""Time-related value objects for swim times and durations."""
from typing import Optional


class SwimTime:
    """Value object representing a swim time.
    
    Handles conversion between various time formats commonly used in swimming:
    - PostgreSQL interval strings (HH:MM:SS.ss)
    - Minutes:seconds format (MM:SS.ss)
    - Seconds only (SS.ss)
    """
    
    def __init__(self, time_str: str):
        """Initialize a SwimTime from a string representation.
        
        Args:
            time_str: Time string in format HH:MM:SS.ss, MM:SS.ss, or SS.ss
            
        Raises:
            ValueError: If time string format is invalid
        """
        self.original = time_str
        self._seconds = self._parse_to_seconds(time_str)
    
    @staticmethod
    def _parse_to_seconds(time_str: str) -> float:
        """Convert time string to seconds.
        
        Args:
            time_str: Time in format HH:MM:SS.ss, MM:SS.ss, or SS.ss
            
        Returns:
            float: Time in seconds
            
        Raises:
            ValueError: If format is invalid
        """
        if not time_str:
            return float('inf')
        
        parts = time_str.split(':')
        
        try:
            if len(parts) == 3:
                # HH:MM:SS.ss format
                hours = int(parts[0])
                minutes = int(parts[1])
                seconds = float(parts[2])
                return hours * 3600 + minutes * 60 + seconds
            elif len(parts) == 2:
                # MM:SS.ss format
                minutes = int(parts[0])
                seconds = float(parts[1])
                return minutes * 60 + seconds
            else:
                # SS.ss format
                return float(time_str)
        except (ValueError, IndexError) as e:
            raise ValueError(f"Invalid time format: {time_str}") from e
    
    @property
    def seconds(self) -> float:
        """Get time in seconds."""
        return self._seconds
    
    @property
    def is_valid(self) -> bool:
        """Check if time is valid (not infinity)."""
        return self._seconds != float('inf')
    
    def __str__(self) -> str:
        """String representation of the time."""
        return self.original
    
    def __repr__(self) -> str:
        """Developer representation of the time."""
        return f"SwimTime('{self.original}', {self._seconds}s)"
    
    def __eq__(self, other) -> bool:
        """Compare two swim times."""
        if not isinstance(other, SwimTime):
            return False
        return self._seconds == other._seconds
    
    def __lt__(self, other) -> bool:
        """Compare if this time is faster (less seconds)."""
        if not isinstance(other, SwimTime):
            return NotImplemented
        return self._seconds < other._seconds
    
    def __le__(self, other) -> bool:
        """Compare if this time is faster or equal."""
        if not isinstance(other, SwimTime):
            return NotImplemented
        return self._seconds <= other._seconds


def interval_to_seconds(interval_str: str) -> float:
    """Convert PostgreSQL interval string to seconds.
    
    This is a convenience function that maintains backward compatibility
    with existing code while using the SwimTime value object internally.
    
    Args:
        interval_str: Time string in format HH:MM:SS.ss, MM:SS.ss, or SS.ss
        
    Returns:
        float: Time in seconds, or float('inf') for invalid times
    """
    try:
        swim_time = SwimTime(interval_str)
        return swim_time.seconds
    except ValueError:
        return float('inf')
