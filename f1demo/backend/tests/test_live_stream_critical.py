import pytest
import httpx
from unittest.mock import MagicMock
from services.live_stream import _compute_delay, openf1_json_tail, _RETRY_STATE, _reset_retry_count, _increment_retry_count

def test_compute_delay_progression():
    """Test _compute_delay progression"""
    # Base interval is 8.0, jitter is 0.7-1.3
    # retry_count 0: multiplier 1, base 8.0, delay ~5.6 to 10.4
    delay0 = _compute_delay(0, base_interval=8.0, max_interval=30.0)
    assert 5.5 <= delay0 <= 10.5
    
    # retry_count 1: multiplier 2, base 16.0, delay ~11.2 to 20.8
    delay1 = _compute_delay(1, base_interval=8.0, max_interval=30.0)
    assert 11.0 <= delay1 <= 21.0
    
    # retry_count 10: multiplier 3.75 (30/8), base 30.0, delay ~21.0 to 39.0
    delay10 = _compute_delay(10, base_interval=8.0, max_interval=30.0)
    assert 20.0 <= delay10 <= 40.0

def test_openf1_json_tail():
    """Test openf1_json_tail with various formats"""
    # Mock response with list
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 200
    mock_resp.json.return_value = [1, 2, 3, 4, 5]
    
    assert openf1_json_tail(mock_resp, 3) == [3, 4, 5]
    assert openf1_json_tail(mock_resp, 10) == [1, 2, 3, 4, 5]
    
    # Mock response with dict
    mock_resp.json.return_value = {"a": 1}
    assert openf1_json_tail(mock_resp, 3) == [{"a": 1}]
    
    # Mock empty/error
    mock_resp.status_code = 500
    assert openf1_json_tail(mock_resp, 3) == []

def test_retry_state():
    """Test retry count functions"""
    _reset_retry_count()
    assert _RETRY_STATE["count"] == 0
    _increment_retry_count()
    assert _RETRY_STATE["count"] == 1
    _reset_retry_count()
    assert _RETRY_STATE["count"] == 0
