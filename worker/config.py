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
    
    # Proxy configuration
    USE_OXYLABS_PROXY: bool = os.getenv('USE_OXYLABS_PROXY', 'false').lower() == 'true'
    OXYLABS_USERNAME: str = os.getenv('OXYLABS_USERNAME', '')
    OXYLABS_PASSWORD: str = os.getenv('OXYLABS_PASSWORD', '')
    OXYLABS_COUNTRY: str = os.getenv('OXYLABS_COUNTRY', 'us')
    
    @classmethod
    def get_proxy_config(cls) -> dict:
        """Get proxy configuration for Playwright"""
        if not cls.USE_OXYLABS_PROXY or not cls.OXYLABS_USERNAME or not cls.OXYLABS_PASSWORD:
            return {}
        
        # Oxylabs residential proxy endpoint
        proxy_url = f"http://{cls.OXYLABS_USERNAME}:{cls.OXYLABS_PASSWORD}@pr.oxylabs.io:7777"
        
        return {
            'server': proxy_url,
            'username': cls.OXYLABS_USERNAME,
            'password': cls.OXYLABS_PASSWORD
        }
    
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
