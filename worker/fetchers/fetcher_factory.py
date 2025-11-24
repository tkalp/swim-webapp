"""
Fetcher factory
Single Responsibility: Create appropriate fetcher based on mode
"""

from typing import Optional
import logging

from worker.fetchers.base_fetcher import BaseFetcher
from worker.fetchers.curl_fetcher import CurlFetcher
from worker.fetchers.httpx_fetcher import HttpxFetcher
from worker.fetchers.playwright_fetcher import PlaywrightFetcher
from worker.config import WorkerConfig

logger = logging.getLogger('fetcher_factory')


class FetcherFactory:
    """Factory for creating HTTP fetchers"""
    
    @staticmethod
    def create(
        mode: Optional[str] = None,
        use_proxy: Optional[bool] = None,
        proxy_username: Optional[str] = None,
        proxy_password: Optional[str] = None,
        proxy_country: Optional[str] = None
    ) -> BaseFetcher:
        """
        Create a fetcher based on mode
        
        Args:
            mode: Fetch mode ('curl', 'httpx', 'playwright'). Defaults to config value.
            use_proxy: Whether to use proxy. Defaults to config value.
            proxy_username: Proxy username. Defaults to config value.
            proxy_password: Proxy password. Defaults to config value.
            proxy_country: Proxy country code. Defaults to config value.
            
        Returns:
            BaseFetcher instance
        """
        # Use config defaults if not specified
        mode = mode or WorkerConfig.FETCH_MODE
        use_proxy = use_proxy if use_proxy is not None else WorkerConfig.USE_OXYLABS_PROXY
        proxy_username = proxy_username or WorkerConfig.OXYLABS_USERNAME
        proxy_password = proxy_password or WorkerConfig.OXYLABS_PASSWORD
        proxy_country = proxy_country or WorkerConfig.OXYLABS_COUNTRY
        
        # Common kwargs for all fetchers
        kwargs = {
            'use_proxy': use_proxy,
            'proxy_username': proxy_username,
            'proxy_password': proxy_password,
            'proxy_country': proxy_country
        }
        
        # Create fetcher based on mode
        if mode == 'curl':
            logger.info("Creating CurlFetcher")
            return CurlFetcher(**kwargs)
        elif mode == 'httpx':
            logger.info("Creating HttpxFetcher")
            return HttpxFetcher(**kwargs)
        elif mode == 'playwright':
            logger.info("Creating PlaywrightFetcher")
            return PlaywrightFetcher(**kwargs)
        else:
            logger.warning(f"Unknown fetch mode '{mode}', defaulting to curl")
            return CurlFetcher(**kwargs)
