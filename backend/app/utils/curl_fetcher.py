"""
Curl-based HTTP fetcher for backend
Optimized subprocess curl implementation for faster HTTP requests
"""

import subprocess
import random
import asyncio
import logging
import os
from typing import Optional, Dict

logger = logging.getLogger(__name__)


class CurlFetcher:
    """Async curl fetcher for SwimRankings searches"""
    
    MAX_RETRIES = 3
    BASE_RETRY_DELAY = 1.0
    
    def __init__(self):
        """Initialize fetcher with proxy configuration"""
        self.use_proxy = os.getenv("USE_OXYLABS_PROXY", "false").lower() == "true"
        self.proxy_username = os.getenv("OXYLABS_USERNAME")
        self.proxy_password = os.getenv("OXYLABS_PASSWORD")
        self.proxy_country = os.getenv("OXYLABS_COUNTRY", "US")
        
    def get_random_user_agent(self) -> str:
        """Get a random realistic user agent"""
        user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
        ]
        return random.choice(user_agents)
    
    def get_proxy_config(self) -> Optional[Dict[str, str]]:
        """Get proxy configuration if enabled"""
        if not self.use_proxy or not self.proxy_username or not self.proxy_password:
            return None
        
        return {
            'server': 'pr.oxylabs.io:7777',
            'username': f'customer-{self.proxy_username}-cc-{self.proxy_country}',
            'password': self.proxy_password,
            'country': self.proxy_country
        }
    
    def _calculate_retry_delay(self, retry_count: int) -> float:
        """Calculate exponential backoff delay with jitter"""
        delay = self.BASE_RETRY_DELAY * (2 ** retry_count)
        jitter = random.uniform(0, 1)
        return delay + jitter
    
    async def fetch(self, url: str, retry_count: int = 0) -> str:
        """
        Fetch HTML content using curl subprocess
        
        Args:
            url: URL to fetch
            retry_count: Current retry attempt
            
        Returns:
            HTML content as string
        """
        try:
            user_agent = self.get_random_user_agent()
            
            # Build curl command
            cmd = ['curl', '-s', '-L', '--compressed']  # silent, follow redirects, accept compression
            
            # Add proxy if configured
            proxy_config = self.get_proxy_config()
            if proxy_config:
                cmd.extend(['-x', proxy_config['server']])
                cmd.extend(['-U', f"{proxy_config['username']}:{proxy_config['password']}"])
                logger.debug(f"Using Oxylabs proxy: {proxy_config['server']} (country: {proxy_config['country'].upper()})")
            else:
                logger.debug("No proxy configured - making direct request")
            
            # Add headers
            cmd.extend([
                '-H', f'User-Agent: {user_agent}',
                '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                '-H', 'Accept-Language: en-US,en;q=0.9',
                '-H', 'DNT: 1',
                '-H', 'Connection: keep-alive',
                '--max-time', '30'
            ])
            
            # Add URL
            cmd.append(url)
            
            # Execute curl asynchronously (non-blocking)
            logger.debug(f"Executing curl for: {url}")
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                error_msg = stderr.decode('utf-8', errors='ignore')
                raise Exception(f"Curl failed with return code {process.returncode}: {error_msg}")
            
            html = stdout.decode('utf-8', errors='ignore')
            html_size = len(html)
            logger.debug(f"Curl fetch successful, HTML size: {html_size} bytes")
            
            # Check for suspiciously small response
            if html_size < 500:
                logger.warning(f"Suspiciously small HTML response ({html_size} bytes)")
                if retry_count < self.MAX_RETRIES:
                    raise Exception("Possible block page detected")
            
            return html
            
        except Exception as e:
            logger.warning(f"Curl fetch error (attempt {retry_count + 1}/{self.MAX_RETRIES}): {e}")
            
            if retry_count < self.MAX_RETRIES:
                delay = self._calculate_retry_delay(retry_count)
                logger.info(f"Retrying in {delay:.2f}s...")
                await asyncio.sleep(delay)
                return await self.fetch(url, retry_count + 1)
            else:
                logger.error(f"Curl fetch failed after {self.MAX_RETRIES} attempts")
                raise
