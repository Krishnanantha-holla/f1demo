import pytest
import pytest_asyncio
import pandas as pd
from httpx import AsyncClient, ASGITransport
from unittest.mock import MagicMock, patch
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from main import app

@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

@pytest.mark.asyncio
async def test_telemetry_endpoint_valid(client):
    """Test telemetry endpoint with valid parameters"""
    mock_session = MagicMock()
    mock_lap = MagicMock()
    mock_car_data = MagicMock()
    
    # Setup mock car data
    df = pd.DataFrame([
        {"Time": 0.1, "Speed": 200, "Throttle": 100},
        {"Time": 0.2, "Speed": 210, "Throttle": 100}
    ])
    mock_car_data.reset_index.return_value = df
    mock_lap.get_car_data.return_value = mock_car_data
    mock_session.laps.pick_driver.return_value.pick_fastest.return_value = mock_lap
    
    with patch("routes.telemetry.fastf1.get_session", return_value=mock_session):
        with patch("routes.telemetry.HAS_FASTF1", True):
            response = await client.get("/api/telemetry/2024/Austrian Grand Prix/R/VER")
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
            if len(data) > 0:
                assert "Speed" in data[0]

@pytest.mark.asyncio
async def test_telemetry_invalid_params(client):
    """Test 400 responses for invalid parameters"""
    # Bad year
    response = await client.get("/api/telemetry/2010/Austria/R/VER")
    assert response.status_code == 400
    
    # Bad session
    response = await client.get("/api/telemetry/2024/Austria/INVALID/VER")
    assert response.status_code == 400
    
    # Bad driver
    response = await client.get("/api/telemetry/2024/Austria/R/V") # Too short
    assert response.status_code == 400

@pytest.mark.asyncio
async def test_laps_endpoint(client):
    """Test laps endpoint"""
    mock_session = MagicMock()
    laps_df = pd.DataFrame([
        {
            "Driver": "VER",
            "LapNumber": 1,
            "LapTime": pd.Timedelta(seconds=70),
            "Compound": "SOFT",
            "IsPersonalBest": True,
            "Sector1Time": pd.Timedelta(seconds=20),
            "Sector2Time": pd.Timedelta(seconds=25),
            "Sector3Time": pd.Timedelta(seconds=25),
            "Stint": 1,
            "Position": 1
        }
    ])
    mock_session.laps = laps_df
    
    with patch("routes.telemetry.fastf1.get_session", return_value=mock_session):
        with patch("routes.telemetry.HAS_FASTF1", True):
            response = await client.get("/api/laps/2024/Austrian Grand Prix/R")
            assert response.status_code == 200
            data = response.json()
            assert "data" in data
            assert len(data["data"]) == 1
            assert data["data"][0]["Driver"] == "VER"
