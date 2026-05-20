"""Endpoint tests for the /api/circuit-map route."""
import sys
from pathlib import Path

# Make `backend/` importable as a top-level package, matching test_api.py's pattern.
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402


client = TestClient(app)


def test_circuit_map_returns_metadata():
    """Known circuit returns 200 with at least the core metadata keys."""
    resp = client.get("/api/circuit-map/Bahrain")
    assert resp.status_code == 200
    data = resp.json()
    assert "fullName" in data
    # At least one of the geometric keys should be present.
    assert any(k in data for k in ("svgPath", "svgViewBox", "trackPath", "turns"))


def test_circuit_map_404_for_unknown():
    """Unknown circuit returns 404."""
    resp = client.get("/api/circuit-map/NotARealCircuit")
    assert resp.status_code == 404
