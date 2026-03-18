"""Shared test configuration for worker tests."""
import sys
import os
import importlib
import importlib.util
import types

_scraper_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "swim-scraper"))
if _scraper_path not in sys.path:
    sys.path.insert(0, _scraper_path)

# The swimrankings package __init__.py imports DrissionPage (browser automation)
# which is not available in the test environment.  Pre-populate sys.modules with
# stub entries so that importing swimrankings.models works without side effects.
def _bootstrap_swimrankings_models() -> None:
    """Load swimrankings.models directly, bypassing the package __init__."""
    pkg_name = "swimrankings"
    models_name = "swimrankings.models"

    if models_name in sys.modules:
        return  # Already loaded — nothing to do.

    # Stub the top-level package if not already present.
    if pkg_name not in sys.modules:
        stub_pkg = types.ModuleType(pkg_name)
        stub_pkg.__path__ = [os.path.join(_scraper_path, "swimrankings")]  # type: ignore[attr-defined]
        stub_pkg.__package__ = pkg_name
        sys.modules[pkg_name] = stub_pkg

    # Load models.py directly without executing __init__.py.
    models_path = os.path.join(_scraper_path, "swimrankings", "models.py")
    spec = importlib.util.spec_from_file_location(models_name, models_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load swimrankings.models from {models_path}")

    module = importlib.util.module_from_spec(spec)
    module.__package__ = pkg_name
    sys.modules[models_name] = module
    spec.loader.exec_module(module)  # type: ignore[union-attr]

    # Expose key names on the stub package for convenience.
    pkg = sys.modules[pkg_name]
    for attr in ("RaceResult", "Stroke", "Athlete", "Meet", "AthleteHistory",
                 "parse_time", "MeetResult", "Ranking"):
        if hasattr(module, attr):
            setattr(pkg, attr, getattr(module, attr))


_bootstrap_swimrankings_models()
