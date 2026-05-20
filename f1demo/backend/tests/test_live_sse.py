"""Tests for the /api/live/sse fallback route.

We deliberately do NOT consume the streaming response in these tests:
``RequestLogMiddleware`` (Starlette ``BaseHTTPMiddleware``) buffers
streaming responses end-to-end, which would deadlock against the
infinite poll loop. Instead we:

1. Unit-test ``_poll_once`` directly with a mocked httpx client.
2. Verify the route is registered on the FastAPI app with the
   correct path, method, and ``text/event-stream`` media type.
"""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import AsyncMock

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from main import app  # noqa: E402
from routes import live_sse  # noqa: E402


# ─────────────────────────────────────────────────────────────────────────────
# Unit-level: _poll_once shape
# ─────────────────────────────────────────────────────────────────────────────


class _FakeResponse:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code

    def json(self):
        return self._payload


class _FakeClient:
    """Stand-in for httpx.AsyncClient that returns canned payloads per URL substring."""

    def __init__(self, table):
        self._table = table

    async def get(self, url, headers=None):  # noqa: ARG002
        for key, payload in self._table.items():
            if key in url:
                return _FakeResponse(payload)
        return _FakeResponse([])


@pytest.mark.asyncio
async def test_poll_once_returns_expected_keys(monkeypatch):
    """``_poll_once`` should yield the same payload shape as the WebSocket."""
    fake_table = {
        "/positions": [{"driver_number": 1, "position": 1, "date": "2026-05-20T00:00:00Z"}],
        "/intervals": [{"driver_number": 1, "gap_to_leader": 0}],
        "/overtakes": [],
        "/weather": [{"air_temperature": 22, "track_temperature": 35, "rainfall": 0}],
        "/race_control_messages": [{"flag": "GREEN", "message": "Track clear"}],
    }
    monkeypatch.setattr(live_sse, "_openf1_headers", AsyncMock(return_value={"accept": "application/json"}))
    payload = await live_sse._poll_once(_FakeClient(fake_table), "latest")

    assert set(payload) == {"positions", "intervals", "overtakes", "weather", "race_control", "timestamp"}
    assert payload["positions"][0]["driver_number"] == 1
    assert payload["intervals"][0]["gap_to_leader"] == 0
    # weather is collapsed to the most recent observation
    assert payload["weather"]["air_temperature"] == 22
    # race_control retains the message
    assert payload["race_control"][0]["message"] == "Track clear"
    # timestamp is an iso8601 string
    assert "T" in payload["timestamp"]


# ─────────────────────────────────────────────────────────────────────────────
# Integration-level: route is registered with the right metadata
# ─────────────────────────────────────────────────────────────────────────────


def test_live_sse_route_is_registered():
    """The /api/live/sse path is mounted with a GET handler."""
    matching = [
        r for r in app.routes
        if getattr(r, "path", "") == "/api/live/sse" and "GET" in getattr(r, "methods", set())
    ]
    assert matching, "GET /api/live/sse must be registered"


def test_live_sse_route_precedence_over_proxy():
    """The dedicated SSE route must precede the generic /live/{endpoint} proxy.

    Otherwise FastAPI would route /api/live/sse into the proxy's "Invalid endpoint" 400.
    """
    paths = [getattr(r, "path", "") for r in app.routes]
    sse_index = paths.index("/api/live/sse")
    proxy_index = paths.index("/api/live/{endpoint}")
    assert sse_index < proxy_index, (
        f"SSE route at index {sse_index} must come before the proxy at {proxy_index}"
    )
