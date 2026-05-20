import pytest
import pytest_asyncio
import pandas as pd
from datetime import datetime, timezone, timedelta
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
async def test_schedule_endpoint(client):
    """Test the main schedule endpoint with mocked FastF1 data"""
    mock_schedule = pd.DataFrame([
        {
            "EventName": "Australian Grand Prix",
            "EventDate": datetime(2024, 3, 24, tzinfo=timezone.utc),
            "EventFormat": "conventional"
        }
    ])
    
    with patch("routes.schedule.fastf1.get_event_schedule", return_value=mock_schedule):
        with patch("routes.schedule.HAS_FASTF1", True):
            response = await client.get("/api/schedule?year=2024")
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]["EventName"] == "Australian Grand Prix"

@pytest.mark.asyncio
async def test_next_race_endpoint(client):
    """Test next_race() correctly finds the next upcoming race"""
    now = datetime.now(timezone.utc)
    future_date = now + timedelta(days=5)
    past_date = now - timedelta(days=5)
    
    mock_schedule = pd.DataFrame([
        {
            "EventName": "Past Race",
            "EventDate": past_date,
        },
        {
            "EventName": "Next Race",
            "EventDate": future_date,
        }
    ])
    # The code expects 'EventDate' column to be a Series with dt accessor
    mock_schedule["EventDate"] = pd.to_datetime(mock_schedule["EventDate"])
    
    with patch("routes.schedule.fastf1.get_event_schedule", return_value=mock_schedule):
        with patch("routes.schedule.HAS_FASTF1", True):
            response = await client.get("/api/next-race")
            assert response.status_code == 200
            data = response.json()
            assert data["EventName"] == "Next Race"

@pytest.mark.asyncio
async def test_schedule_fastf1_unavailable(client):
    """Test error handling when FastF1 is unavailable"""
    with patch("routes.schedule.HAS_FASTF1", False):
        response = await client.get("/api/schedule")
        assert response.status_code == 503
        assert "FastF1 not installed" in response.json()["detail"]

@pytest.mark.asyncio
async def test_schedule_error_handling(client):
    """Test 500 error when FastF1 fails"""
    with patch("routes.schedule.fastf1.get_event_schedule", side_effect=Exception("FastF1 error")):
        with patch("routes.schedule.HAS_FASTF1", True):
            response = await client.get("/api/schedule?year=2024")
            assert response.status_code == 500
            assert "Failed to fetch schedule" in response.json()["detail"]

