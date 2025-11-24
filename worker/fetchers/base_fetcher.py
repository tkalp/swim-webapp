"""
Base fetcher interface
Single Responsibility: Define contract for HTTP fetching
"""

from abc import ABC, abstractmethod
from typing import Dict, Optional, List
import random
import logging

logger = logging.getLogger('base_fetcher')


class BaseFetcher(ABC):
    """Abstract base class for HTTP fetchers"""
    
    def __init__(
        self,
        use_proxy: bool = False,
        proxy_username: Optional[str] = None,
        proxy_password: Optional[str] = None,
        proxy_country: str = 'us'
    ):
        """
        Initialize fetcher
        
        Args:
            use_proxy: Whether to use Oxylabs proxy
            proxy_username: Oxylabs username
            proxy_password: Oxylabs password
            proxy_country: Country code for proxy
        """
        self.use_proxy = use_proxy
        self.proxy_username = proxy_username
        self.proxy_password = proxy_password
        self.proxy_country = proxy_country
        
        # User agents for rotation
        self.user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
        ]
    
    def get_random_user_agent(self) -> str:
        """Get a random user agent"""
        return random.choice(self.user_agents)
    
    def get_proxy_config(self) -> Dict[str, str]:
        """
        Get proxy configuration
        
        Returns:
            Dictionary with proxy configuration
        """
        if not self.use_proxy or not self.proxy_username or not self.proxy_password:
            return {}
        
        country_code = self.proxy_country.lower()
        proxy_username = f"customer-{self.proxy_username}-cc-{country_code}"
        
        return {
            'server': 'http://pr.oxylabs.io:7777',
            'username': proxy_username,
            'password': self.proxy_password,
            'country': country_code
        }
    
    @abstractmethod
    async def fetch(self, url: str, retry_count: int = 0) -> str:
        """
        Fetch HTML content from URL
        
        Args:
            url: URL to fetch
            retry_count: Current retry attempt (0-indexed)
            
        Returns:
            HTML content as string
            
        Raises:
            Exception: If fetch fails after all retries
        """
        pass
    
    @abstractmethod
    def get_name(self) -> str:
        """Get the name of this fetcher (for logging)"""
        pass
