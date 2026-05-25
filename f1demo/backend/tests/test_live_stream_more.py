import asyncio
from datetime import datetime, timezone
import types

import pytest

from services import live_stream
from fastapi import WebSocketDisconnect


class _DummyResp:
    def __init__(self, status_code=200, body=None):
        self.status_code = status_code
        self._body = body if body is not None else []

    def json(self):
        return self._body


class _DummyClient:
    def __init__(self, resp):
        self._resp = resp

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, *args, **kwargs):
        return self._resp


class DummyWebSocket:
    def __init__(self):
        self.query_params = {"session_key": "test"}
        self.client = ("127.0.0.1", 12345)
        self.accepted = False
        self.closed = False
        self.sent = []
        self._send_count = 0

    async def accept(self):
        self.accepted = True

    async def send_json(self, obj):
        # record and then simulate a disconnect to exit the loop
        self.sent.append(obj)
        self._send_count += 1
        if self._send_count >= 1:
            raise WebSocketDisconnect()

    async def close(self):
        self.closed = True


@pytest.mark.asyncio
async def test_openf1_json_tail_basic():
    r = _DummyResp(status_code=500)
    assert live_stream.openf1_json_tail(r, 3) == []

    r = _DummyResp(status_code=200, body=[1, 2, 3, 4, 5])
    assert live_stream.openf1_json_tail(r, 3) == [3, 4, 5]

    r = _DummyResp(status_code=200, body={"a": 1})
    assert live_stream.openf1_json_tail(r, 3) == [{"a": 1}]


def test_retry_state_and_compute_delay(monkeypatch):
    # deterministic jitter by patching random.random
    monkeypatch.setattr(live_stream.random, "random", lambda: 0.5)
    live_stream._reset_retry_count()
    assert live_stream.current_retry_count() == 0
    live_stream._increment_retry_count()
    assert live_stream.current_retry_count() == 1

    d0 = live_stream._compute_delay(retry_count=0, base_interval=2.0, max_interval=10.0)
    d1 = live_stream._compute_delay(retry_count=2, base_interval=2.0, max_interval=10.0)
    assert d1 >= d0


@pytest.mark.asyncio
async def test_stream_live_session_one_iteration(monkeypatch):
    # Prepare dummy responses for all endpoints
    body = [{"x": 1}]
    resp = _DummyResp(status_code=200, body=body)

    # Patch httpx.AsyncClient used in the module to our dummy client
    async def dummy_async_client(*args, **kwargs):
        return _DummyClient(resp)

    monkeypatch.setattr(live_stream.httpx, "AsyncClient", lambda *a, **k: _DummyClient(resp))

    # openf1_headers async function
    async def headers_func(force_refresh=False):
        return {"accept": "application/json"}

    ws = DummyWebSocket()

    # logger stub
    class L:
        def info(self, *a, **k):
            pass

        def warning(self, *a, **k):
            pass

    # Run stream_live_session; it should perform one send_json then exit due to WebSocketDisconnect
    await live_stream.stream_live_session(
        ws,
        openf1_base="https://api.test",
        openf1_auth_enabled=False,
        openf1_headers=headers_func,
        logger=L(),
    )

    assert ws.accepted is True
    # ensure at least one message was sent and contained expected keys
    assert len(ws.sent) >= 1
    sent0 = ws.sent[0]
    assert "positions" in sent0 and "timestamp" in sent0
    assert ws.closed is True
