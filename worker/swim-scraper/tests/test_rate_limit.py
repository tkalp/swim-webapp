import time
from swimrankings.rate_limit import RateLimiter


def test_first_call_no_delay():
    """First call to wait() should return instantly (no prior request)."""
    limiter = RateLimiter(min_delay=0.2, max_delay=0.3)
    start = time.time()
    limiter.wait()
    elapsed = time.time() - start
    assert elapsed < 0.1, f"First call should be instant, took {elapsed:.2f}s"


def test_second_call_enforces_min_delay():
    """Second call to wait() should sleep at least min_delay since the first."""
    limiter = RateLimiter(min_delay=0.2, max_delay=0.3)
    limiter.wait()  # first call — instant
    start = time.time()
    limiter.wait()  # second call — should wait
    elapsed = time.time() - start
    assert elapsed >= 0.15, f"Second call should enforce delay, only waited {elapsed:.2f}s"
