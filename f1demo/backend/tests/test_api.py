"""
API endpoint tests for F1 Dashboard backend.
Tests critical endpoints and security constraints.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from main import app
from utils import INTERNAL_SECRET


@pytest_asyncio.fixture
async def client():
    """Async HTTP client for testing."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_health_endpoint(client):
    """Test /api/health returns 200 with expected fields."""
    response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "openf1" in data
    assert "cache_backend" in data


@pytest.mark.asyncio
async def test_season_endpoint(client):
    """Test /api/season returns current year."""
    response = await client.get("/api/season")
    assert response.status_code == 200
    data = response.json()
    assert "year" in data
    assert isinstance(data["year"], int)
    assert 2018 <= data["year"] <= 2050


@pytest.mark.asyncio
async def test_refresh_cache_requires_secret(client):
    """Test /internal/refresh-cache returns 403 without valid secret."""
    response = await client.post("/internal/refresh-cache")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_refresh_cache_with_secret(client):
    """Test /internal/refresh-cache succeeds with valid secret header."""
    response = await client.post(
        "/internal/refresh-cache", headers={"X-Internal-Secret": INTERNAL_SECRET}
    )
    assert response.status_code == 200
    data = response.json()
    assert data.get("status") == "cache_cleared"


@pytest.mark.asyncio
async def test_refresh_cache_clears_in_process_ttlcache(client):
    """/internal/refresh-cache must also wipe the in-process TTLCache used by cached_get."""
    import utils as _utils

    # Pre-populate the in-process cache so we can detect the clear.
    async with _utils._cache_lock:
        _utils._cache["60:https://example.test/foo"] = {"hello": "world"}
    assert len(_utils._cache) >= 1

    response = await client.post(
        "/internal/refresh-cache",
        headers={"X-Internal-Secret": INTERNAL_SECRET},
    )
    assert response.status_code == 200
    assert len(_utils._cache) == 0


@pytest.mark.asyncio
async def test_laps_invalid_year_returns_400(client):
    """Test /api/laps with year < 2018 returns 400."""
    response = await client.get("/api/laps/2010/Austria/R")
    assert response.status_code == 400
    data = response.json()
    assert "detail" in data


@pytest.mark.asyncio
async def test_laps_invalid_session_type_returns_400(client):
    """Test /api/laps with invalid session_type returns 400."""
    response = await client.get("/api/laps/2024/Austria/XX")
    assert response.status_code == 400
    data = response.json()
    assert "detail" in data


@pytest.mark.asyncio
async def test_telemetry_invalid_driver_returns_400(client):
    """Test /api/telemetry with invalid driver code returns 400."""
    response = await client.get("/api/telemetry/2024/Austria/R/TOOLONGCODE")
    assert response.status_code == 400
    data = response.json()
    assert "detail" in data


@pytest.mark.asyncio
async def test_compare_drivers_invalid_count_returns_400(client):
    """Test /api/compare with <2 or >5 drivers returns 400."""
    response = await client.get(
        "/api/compare?year=2024&event=Austria&session_type=R&drivers=VER"
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_ti_invalid_event_name_returns_400(client):
    """Test TracingInsights events endpoint rejects invalid event names with forbidden characters."""
    # Test with a path component containing slashes (which are not in the allowed character set)
    # Note: the slash needs to be percent-encoded as %2F in the URL
    response = await client.get("/api/ti/sessions/2024/event%2fname")
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_ti_session_invalid_characters_returns_400(client):
    """Test TracingInsights rejects path traversal with special chars."""
    response = await client.get("/api/ti/drivers/2024/Austria/Race/<script>")
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_ti_invalid_lap_range_returns_400(client):
    """Test TracingInsights telemetry rejects invalid lap numbers."""
    response = await client.get("/api/ti/telemetry/2024/Austria/Race/VER/99999")
    assert response.status_code == 400
