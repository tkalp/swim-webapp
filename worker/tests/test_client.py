"""
Tests for SwimRankingsClientManager (worker/client.py).

All tests use mocks — no real browser or network connections are made.
"""
import os
import sys
import types
import unittest
from unittest.mock import MagicMock, patch, PropertyMock

# Satisfy config.validate() before any worker imports pull in worker.config.
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")


def _ensure_swimrankings_stub() -> None:
    """
    Ensure sys.modules has a stub for 'swimrankings' with a SwimRankings class,
    so worker.client can import from it without triggering DrissionPage.
    conftest.py stubs swimrankings with models only; we add SwimRankings here.
    """
    pkg_name = "swimrankings"
    stub = sys.modules.get(pkg_name) or types.ModuleType(pkg_name)
    if not hasattr(stub, "SwimRankings"):
        stub.SwimRankings = MagicMock(name="SwimRankings_stub")  # type: ignore[attr-defined]
        sys.modules[pkg_name] = stub


_ensure_swimrankings_stub()


def _make_config_stub() -> types.SimpleNamespace:
    """Return a SimpleNamespace with the new config attributes expected by client.py."""
    return types.SimpleNamespace(
        SWIMRANKINGS_EMAIL="test@example.com",
        SWIMRANKINGS_PASSWORD="secret",
        CHROMIUM_PATH="/usr/bin/chromium",
        BROWSER_PROFILE_DIR="/tmp/profile",
        CF_TIMEOUT=30,
    )


class TestSwimRankingsClientManager(unittest.TestCase):
    """Tests for the lazy singleton client manager."""

    def setUp(self) -> None:
        """Remove cached client module before each test so imports are fresh."""
        if "worker.client" in sys.modules:
            del sys.modules["worker.client"]

    def _make_alive_client(self) -> MagicMock:
        """Return a mock client whose page.title does NOT raise."""
        client = MagicMock(name="sr_client_alive")
        client.page.title = "SwimRankings"
        return client

    def _make_dead_client(self) -> MagicMock:
        """Return a mock client whose page.title raises (simulates crashed browser)."""
        client = MagicMock(name="sr_client_dead")
        type(client).page = PropertyMock(side_effect=Exception("browser crashed"))
        return client

    # ------------------------------------------------------------------
    # Tests
    # ------------------------------------------------------------------

    def test_get_client_creates_instance(self) -> None:
        """First call creates a new SwimRankings browser instance via start()."""
        alive_client = self._make_alive_client()
        mock_sr_class = MagicMock(name="SwimRankings_class")
        mock_sr_class.return_value.start.return_value = alive_client

        swimrankings_stub = types.SimpleNamespace(SwimRankings=mock_sr_class)
        config_stub = _make_config_stub()

        with patch.dict("sys.modules", {"swimrankings": swimrankings_stub}):
            from worker.client import SwimRankingsClientManager
            SwimRankingsClientManager._instance = None

            with patch("worker.client.SwimRankings", mock_sr_class), \
                 patch("worker.client.config", config_stub):
                result = SwimRankingsClientManager.get_client()

        mock_sr_class.assert_called_once_with(
            email="test@example.com",
            password="secret",
            browser_path="/usr/bin/chromium",
            profile_dir="/tmp/profile",
            cf_timeout=30,
        )
        mock_sr_class.return_value.start.assert_called_once()
        self.assertIs(result, alive_client)

    def test_get_client_reuses_existing(self) -> None:
        """Subsequent calls return the same instance; start() is only called once."""
        alive_client = self._make_alive_client()
        mock_sr_class = MagicMock(name="SwimRankings_class")
        mock_sr_class.return_value.start.return_value = alive_client

        swimrankings_stub = types.SimpleNamespace(SwimRankings=mock_sr_class)
        config_stub = _make_config_stub()

        with patch.dict("sys.modules", {"swimrankings": swimrankings_stub}):
            from worker.client import SwimRankingsClientManager
            SwimRankingsClientManager._instance = None

            with patch("worker.client.SwimRankings", mock_sr_class), \
                 patch("worker.client.config", config_stub):
                first = SwimRankingsClientManager.get_client()
                second = SwimRankingsClientManager.get_client()

        self.assertIs(first, second)
        mock_sr_class.return_value.start.assert_called_once()

    def test_get_client_recreates_if_dead(self) -> None:
        """If the existing browser is dead (page.title raises), a new one is created."""
        dead_client = self._make_dead_client()
        alive_client = self._make_alive_client()

        mock_sr_class = MagicMock(name="SwimRankings_class")
        # First start() returns dead_client; second returns alive_client
        mock_sr_class.return_value.start.side_effect = [dead_client, alive_client]

        swimrankings_stub = types.SimpleNamespace(SwimRankings=mock_sr_class)
        config_stub = _make_config_stub()

        with patch.dict("sys.modules", {"swimrankings": swimrankings_stub}):
            from worker.client import SwimRankingsClientManager
            SwimRankingsClientManager._instance = None

            with patch("worker.client.SwimRankings", mock_sr_class), \
                 patch("worker.client.config", config_stub):
                # Prime the singleton with the dead client
                first = SwimRankingsClientManager.get_client()
                self.assertIs(first, dead_client)

                # Second call should detect dead browser and recreate
                second = SwimRankingsClientManager.get_client()

        self.assertIs(second, alive_client)
        self.assertEqual(mock_sr_class.return_value.start.call_count, 2)

    def test_cleanup_closes_browser(self) -> None:
        """_cleanup() calls close() on the existing instance and sets _instance to None."""
        alive_client = self._make_alive_client()
        mock_sr_class = MagicMock(name="SwimRankings_class")
        mock_sr_class.return_value.start.return_value = alive_client

        swimrankings_stub = types.SimpleNamespace(SwimRankings=mock_sr_class)
        config_stub = _make_config_stub()

        with patch.dict("sys.modules", {"swimrankings": swimrankings_stub}):
            from worker.client import SwimRankingsClientManager
            SwimRankingsClientManager._instance = None

            with patch("worker.client.SwimRankings", mock_sr_class), \
                 patch("worker.client.config", config_stub):
                SwimRankingsClientManager.get_client()
                self.assertIsNotNone(SwimRankingsClientManager._instance)

                SwimRankingsClientManager._cleanup()

        alive_client.close.assert_called_once()
        self.assertIsNone(SwimRankingsClientManager._instance)


if __name__ == "__main__":
    unittest.main()
