"""Time parsing, conversion, and differential calculation utilities."""
from typing import Optional
import math


class TimeParser:
    """Utilities for parsing and converting swimming times."""
    
    @staticmethod
    def parse_to_seconds(time_str: str) -> Optional[float]:
        """Parse time string to seconds.
        
        Supports formats:
        - mm:ss.ms (e.g., "1:23.45")
        - ss.ms (e.g., "59.12")
        - h:mm:ss.ms (e.g., "1:05:23.45")
        
        Args:
            time_str: Time string to parse
            
        Returns:
            Time in seconds, or None if invalid
        """
        if not time_str or not isinstance(time_str, str):
            return None
        
        try:
            if ':' in time_str:
                parts = time_str.split(':')
                if len(parts) == 2:
                    minutes = float(parts[0])
                    seconds = float(parts[1])
                    return minutes * 60 + seconds
                elif len(parts) == 3:
                    hours = float(parts[0])
                    minutes = float(parts[1])
                    seconds = float(parts[2])
                    return hours * 3600 + minutes * 60 + seconds
            else:
                return float(time_str)
        except (ValueError, AttributeError):
            return None
        
        return None
    
    @staticmethod
    def parse_legacy(time_str: str) -> Optional[float]:
        """Parse time string with legacy format support.
        
        Handles comma decimal separators and various formats.
        
        Args:
            time_str: Time string to parse
            
        Returns:
            Time in seconds, or None if invalid
        """
        if not time_str:
            return None
        
        try:
            clean = time_str.replace(',', '.')
            
            if ':' in clean:
                parts = clean.split(':')
                if len(parts) == 2:
                    minutes = float(parts[0])
                    seconds = float(parts[1])
                    return minutes * 60 + seconds
            
            return float(clean)
        except (ValueError, AttributeError):
            return None


class PoolConverter:
    """Convert times between short course (SCM) and long course (LCM) pools."""
    
    # Conversion factors: percentage slower in LCM vs SCM
    # Based on turn advantage in short course
    CONVERSION_FACTORS = {
        50: 0.015,   # 1.5%
        100: 0.025,  # 2.5%
        200: 0.030,  # 3.0%
        400: 0.035,  # 3.5%
        800: 0.038,  # 3.8%
        1500: 0.040, # 4.0%
    }
    
    DEFAULT_FACTOR = 0.03  # 3% default
    
    @classmethod
    def convert(
        cls,
        time_seconds: float,
        distance: int,
        from_pool: str,
        to_pool: str
    ) -> Optional[float]:
        """Convert time between pool types.
        
        Args:
            time_seconds: Original time in seconds
            distance: Event distance in meters
            from_pool: Source pool type (SCM/LCM)
            to_pool: Target pool type (SCM/LCM)
            
        Returns:
            Converted time in seconds, or None if conversion not applicable
        """
        if from_pool == to_pool:
            return time_seconds
        
        factor = cls.CONVERSION_FACTORS.get(distance, cls.DEFAULT_FACTOR)
        
        if from_pool == 'SCM' and to_pool == 'LCM':
            # SCM -> LCM: slower (add time)
            return time_seconds * (1 + factor)
        elif from_pool == 'LCM' and to_pool == 'SCM':
            # LCM -> SCM: faster (subtract time)
            return time_seconds * (1 - factor)
        
        return time_seconds


class DifferentialCalculator:
    """Calculate probability scores from time differentials."""
    
    @staticmethod
    def differential_to_score(differential: float, k: float = 0.5) -> float:
        """Convert time differential to probability score using sigmoid function.
        
        Maps time differences to probability scores:
        - 5 second advantage → ~0.90 probability
        - 2 second advantage → ~0.70 probability
        - 0 second difference → 0.50 probability
        
        Args:
            differential: Time difference (positive = swimmer_a faster)
            k: Sigmoid steepness parameter (default 0.5 for swimming)
            
        Returns:
            Probability score between 0 and 1
        """
        return 1 / (1 + math.exp(-k * differential))
