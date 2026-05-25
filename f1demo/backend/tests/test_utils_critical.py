import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi import HTTPException
from backend.utils import cached_get, safe_cached_get, clear_request_cache, _validate_ti_param, current_year

@pytest.mark.asyncio
async def test_cached_get_miss_and_hit():
    url = "https://api.test/data"
    mock_data = {"key": "value"}
    
    with patch('httpx.AsyncClient.get', new_callable=AsyncMock) as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_data
        mock_get.return_value = mock_resp
        await clear_request_cache()
        
        # First call (miss)
        res1 = await cached_get(url)
        assert res1 == mock_data
        assert mock_get.call_count == 1
        
        # Second call (hit)
        res2 = await cached_get(url)
        assert res2 == mock_data
        assert mock_get.call_count == 1

@pytest.mark.asyncio
async def test_cached_get_404():
    url = "https://api.test/404"
    with patch('httpx.AsyncClient.get', new_callable=AsyncMock) as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 404
        mock_get.return_value = mock_resp
        await clear_request_cache()
        res = await cached_get(url)
        assert res is None

@pytest.mark.asyncio
async def test_safe_cached_get_fallback():
    url = "https://api.test/error"
    with patch('httpx.AsyncClient.get', new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = Exception("network error")
        await clear_request_cache()
        res = await safe_cached_get(url, default={"fallback": True})
        assert res == {"fallback": True}

def test_validate_ti_param_valid():
    # Should not raise exception
    _validate_ti_param("valid_name", "test_param")
    _validate_ti_param("Event Name 2023", "test_param")
    _validate_ti_param("Session-1_(Final)", "test_param")

def test_validate_ti_param_invalid_chars():
    with pytest.raises(HTTPException) as exc:
        _validate_ti_param("invalid;name", "test_param")
    assert exc.value.status_code == 400
    assert "invalid characters" in exc.value.detail

def test_validate_ti_param_too_long():
    with pytest.raises(HTTPException) as exc:
        _validate_ti_param("a" * 101, "test_param")
    assert exc.value.status_code == 400
    assert "length constraint" in exc.value.detail

def test_current_year():
    with patch('backend.utils.svc_current_year', return_value=2025):
        assert current_year() == 2025
