import time
import random
import logging

log = logging.getLogger(__name__)

class RateLimiter:
    def __init__(self, min_delay: float = 2.0, max_delay: float = 5.0):
        self.min_delay = min_delay
        self.max_delay = max_delay
        self._last_time = 0.0

    def wait(self):
        now = time.time()
        elapsed = now - self._last_time
        delay = random.uniform(self.min_delay, self.max_delay)
        if elapsed < delay and self._last_time > 0:
            wait = delay - elapsed
            log.debug(f"Rate limit: waiting {wait:.1f}s")
            time.sleep(wait)
        self._last_time = time.time()
