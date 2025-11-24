"""
HTTP fetchers for web scraping
"""

from worker.fetchers.base_fetcher import BaseFetcher
from worker.fetchers.curl_fetcher import CurlFetcher
from worker.fetchers.httpx_fetcher import HttpxFetcher
from worker.fetchers.playwright_fetcher import PlaywrightFetcher
from worker.fetchers.fetcher_factory import FetcherFactory

__all__ = [
    'BaseFetcher',
    'CurlFetcher',
    'HttpxFetcher',
    'PlaywrightFetcher',
    'FetcherFactory'
]
