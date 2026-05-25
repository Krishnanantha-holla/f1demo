import json
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock
import pytest
from pathlib import Path
from backend.automator import detect_live_session, get_state, save_state, set_mode

def test_detect_live_session_true():
    now = datetime.now(timezone.utc)
    mock_data = [{
        "date_start": (now - timedelta(minutes=30)).isoformat().replace("+00:00", "Z"),
        "date_end": (now + timedelta(minutes=30)).isoformat().replace("+00:00", "Z"),
        "session_key": 1234
    }]
    with patch('requests.get') as mock_get:
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = mock_data
        assert detect_live_session() is True

def test_detect_live_session_false_past():
    now = datetime.now(timezone.utc)
    mock_data = [{
        "date_start": (now - timedelta(hours=2)).isoformat().replace("+00:00", "Z"),
        "date_end": (now - timedelta(hours=1)).isoformat().replace("+00:00", "Z"),
        "session_key": 1234
    }]
    with patch('requests.get') as mock_get:
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = mock_data
        assert detect_live_session() is False

def test_detect_live_session_empty():
    with patch('requests.get') as mock_get:
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = []
        assert detect_live_session() is False

def test_detect_live_session_error():
    with patch('requests.get') as mock_get:
        mock_get.side_effect = Exception("error")
        assert detect_live_session() is False

def test_state_management(tmp_path):
    # Mock STATE_FILE and STATE_LOCK for isolation
    test_state_file = tmp_path / "state.json"
    with patch('backend.automator.STATE_FILE', test_state_file), \
         patch('backend.automator.STATE_LOCK', MagicMock()):
        
        # Test default state
        state = get_state()
        assert state["mode"] == "idle"
        
        # Test saving state
        new_state = {"last_session": 123, "last_commit": "abc", "mode": "live"}
        save_state(new_state)
        
        # Test getting updated state
        state = get_state()
        assert state["mode"] == "live"
        assert state["last_session"] == 123
        assert state["last_commit"] == "abc"

def test_set_mode(tmp_path):
    test_state_file = tmp_path / "state.json"
    with patch('backend.automator.STATE_FILE', test_state_file), \
         patch('backend.automator.STATE_LOCK', MagicMock()):
        
        set_mode("live")
        state = get_state()
        assert state["mode"] == "live"
        
        set_mode("idle")
        state = get_state()
        assert state["mode"] == "idle"

