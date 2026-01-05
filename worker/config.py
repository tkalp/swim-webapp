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
    MAX_WORKERS: int = int(os.getenv('MAX_WORKERS') or '16')  # Increased from 2: network I/O bound, safe to parallelize
    MIN_DELAY: float = float(os.getenv('SCRAPER_MIN_DELAY') or '0.1')
    MAX_DELAY: float = float(os.getenv('SCRAPER_MAX_DELAY') or '0.5')
    BASE_RETRY_DELAY: float = float(os.getenv('SCRAPER_RETRY_DELAY') or '1.0')
    MAX_RETRIES: int = int(os.getenv('SCRAPER_MAX_RETRIES') or '3')
    
    # Pipeline configuration
    PIPELINE_QUEUE_SIZE: int = int(os.getenv('PIPELINE_QUEUE_SIZE') or '3')  # Max events in queue
    SPLIT_BATCH_SIZE: int = int(os.getenv('SPLIT_BATCH_SIZE') or '3')  # Splits per batch - reduced from 5 for better concurrency (network-bound, not CPU-bound)
    SPLITS_MAX_WORKERS: int = int(os.getenv('SPLITS_MAX_WORKERS') or '8')  # Max concurrent split fetches (increased from 2, network I/O bound)
    GLOBAL_SPLITS_SEMAPHORE_SIZE: int = int(os.getenv('GLOBAL_SPLITS_SEMAPHORE_SIZE') or '16')  # Global concurrent splits across all events (optimization #1)
    RESULT_BATCH_SIZE: int = int(os.getenv('RESULT_BATCH_SIZE', '50'))  # Results per existence check query
    EVENT_BATCH_SIZE: int = int(os.getenv('EVENT_BATCH_SIZE', '5'))  # Events per parallel batch fetch
    
    # Task configuration
    TASK_SOFT_TIME_LIMIT: int = int(os.getenv('TASK_SOFT_TIME_LIMIT', '3600'))
    TASK_TIME_LIMIT: int = int(os.getenv('TASK_TIME_LIMIT', '7200'))
    
    # SwimRankings configuration
    SWIMRANKINGS_BASE_URL: str = 'https://www.swimrankings.net'
    
    # Fetch mode configuration
    FETCH_MODE: str = os.getenv('FETCH_MODE', 'curl')  # curl, httpx, or playwright
    
    # Proxy configuration
    USE_OXYLABS_PROXY: bool = os.getenv('USE_OXYLABS_PROXY', 'false').lower() == 'true'
    OXYLABS_USERNAME: str = os.getenv('OXYLABS_USERNAME', '')
    OXYLABS_PASSWORD: str = os.getenv('OXYLABS_PASSWORD', '')
    OXYLABS_COUNTRY: str = os.getenv('OXYLABS_COUNTRY', 'us')
    
    # Sync configuration
    # Results synced within this window (hours) are considered fresh and won't be re-fetched
    # Default 48h balances avoiding duplicate work vs catching meet corrections
    # Use 24h for aggressive updates, 72h for lenient
    SYNC_FRESHNESS_HOURS: int = int(os.getenv('SYNC_FRESHNESS_HOURS', '48'))
    
    # Splits configuration
    # Set to true to completely skip fetching splits from SwimRankings
    # Useful for testing, development, or when splits data is not needed
    SKIP_SPLITS: bool = os.getenv('SKIP_SPLITS', 'false').lower() == 'true'
    
    @classmethod
    def get_proxy_config(cls) -> dict:
        """Get proxy configuration for Playwright"""
        if not cls.USE_OXYLABS_PROXY or not cls.OXYLABS_USERNAME or not cls.OXYLABS_PASSWORD:
            import logging
            logger = logging.getLogger('config')
            logger.info(f"Proxy disabled: USE_PROXY={cls.USE_OXYLABS_PROXY}, has_username={bool(cls.OXYLABS_USERNAME)}, has_password={bool(cls.OXYLABS_PASSWORD)}")
            return {}
        
        import logging
        logger = logging.getLogger('config')
        logger.info(f"Configuring Oxylabs proxy with username: {cls.OXYLABS_USERNAME[:5]}...")
        
        # Oxylabs residential proxy format: customer-USERNAME-cc-COUNTRY
        # Use lowercase country code as per Oxylabs docs
        country_code = cls.OXYLABS_COUNTRY.lower()
        proxy_username = f"customer-{cls.OXYLABS_USERNAME}-cc-{country_code}"
        proxy_url = f"http://{proxy_username}:{cls.OXYLABS_PASSWORD}@pr.oxylabs.io:7777"
        
        logger.info(f"Using Oxylabs proxy with country: {country_code.upper()}")
        
        return {
            'server': proxy_url,
            'username': proxy_username,
            'password': cls.OXYLABS_PASSWORD
        }
    
    @classmethod
    def validate(cls) -> None:
        """Validate required configuration"""
        if not cls.SUPABASE_URL:
            raise ValueError("SUPABASE_URL environment variable is required")
        if not cls.SUPABASE_SERVICE_ROLE_KEY:
            raise ValueError("SUPABASE_SERVICE_ROLE_KEY environment variable is required")
        
        # Log configuration status
        import logging
        logger = logging.getLogger('config')
        if cls.SKIP_SPLITS:
            logger.info("⚠️  SKIP_SPLITS is enabled - race splits will NOT be fetched")
    
    @classmethod
    def get_max_workers(cls, override: Optional[int] = None) -> int:
        """Get max workers with optional override"""
        if override is not None:
            return override
        return cls.MAX_WORKERS


# Validate configuration on import
WorkerConfig.validate()
