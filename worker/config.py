"""
Configuration management for worker service
"""

import os
from typing import Optional


class WorkerConfig:
    """Configuration for worker service"""
    
    # Database configuration
    SUPABASE_URL: str = os.getenv('SUPABASE_URL', '')
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')
    
    # Redis configuration
    REDIS_URL: str = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
    
    # Scraper configuration
    MAX_WORKERS: int = int(os.getenv('SCRAPER_MAX_WORKERS', '4'))
    MIN_DELAY: float = float(os.getenv('SCRAPER_MIN_DELAY', '0.1'))
    MAX_DELAY: float = float(os.getenv('SCRAPER_MAX_DELAY', '0.5'))
    BASE_RETRY_DELAY: float = float(os.getenv('SCRAPER_RETRY_DELAY', '1.0'))
    MAX_RETRIES: int = int(os.getenv('SCRAPER_MAX_RETRIES', '3'))
    
    # Task configuration
    TASK_SOFT_TIME_LIMIT: int = int(os.getenv('TASK_SOFT_TIME_LIMIT', '3600'))
    TASK_TIME_LIMIT: int = int(os.getenv('TASK_TIME_LIMIT', '7200'))
    
    # SwimRankings configuration
    SWIMRANKINGS_BASE_URL: str = 'https://www.swimrankings.net'
    
    @classmethod
    def validate(cls) -> None:
        """Validate required configuration"""
        if not cls.SUPABASE_URL:
            raise ValueError("SUPABASE_URL environment variable is required")
        if not cls.SUPABASE_SERVICE_ROLE_KEY:
            raise ValueError("SUPABASE_SERVICE_ROLE_KEY environment variable is required")
    
    @classmethod
    def get_max_workers(cls, override: Optional[int] = None) -> int:
        """Get max workers with optional override"""
        if override is not None:
            return override
        return cls.MAX_WORKERS


# Validate configuration on import
WorkerConfig.validate()
