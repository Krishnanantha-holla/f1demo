import json
import os
import sys
import time
import contextlib
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

sys.path.insert(0, str(Path(__file__).parent.parent))

from main import app


class _DummyResponse:
    def __init__(self, status_code=200):
        self.status_code = status_code


class _DummyAsyncClient:
    def __init__(self, *_, **__):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, *_, **__):
        return _DummyResponse(200)


async def _dummy_headers(force_refresh=False):
    return {}


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_health_no_store_and_ok_when_fresh(monkeypatch, tmp_path, client):
    import routes.health as health_mod

    state_file = tmp_path / "state.json"
    state_file.write_text(json.dumps({"mode": "idle"}))
    state_file.touch()
    monkeypatch.setattr(health_mod, "STATE_FILE", state_file)
    monkeypatch.setattr(health_mod, "STATE_LOCK", contextlib.nullcontext())
    monkeypatch.setattr(health_mod, "httpx", type("X", (), {"AsyncClient": _DummyAsyncClient}))
    monkeypatch.setattr(health_mod, "_openf1_headers", _dummy_headers)

    response = await client.get("/api/health")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_health_degrades_when_state_is_stale(monkeypatch, tmp_path, client):
    import routes.health as health_mod

    state_file = tmp_path / "state.json"
    state_file.write_text(json.dumps({"mode": "idle"}))
    monkeypatch.setattr(health_mod, "STATE_FILE", state_file)
    monkeypatch.setattr(health_mod, "STATE_LOCK", contextlib.nullcontext())
    monkeypatch.setattr(health_mod, "httpx", type("X", (), {"AsyncClient": _DummyAsyncClient}))
    monkeypatch.setattr(health_mod, "_openf1_headers", _dummy_headers)
    old = time.time() - 1200
    os.utime(state_file, (old, old))

    response = await client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "degraded"
