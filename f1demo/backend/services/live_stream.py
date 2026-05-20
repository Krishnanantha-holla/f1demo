from __future__ import annotations

import asyncio
import random
from datetime import datetime, timezone

import httpx
from fastapi import WebSocket, WebSocketDisconnect


def openf1_json_tail(resp: httpx.Response, tail: int):
    if resp.status_code != 200:
        return []
    try:
        data = resp.json()
    except Exception:
        return []
    if isinstance(data, list):
        return data[-tail:] if len(data) > tail else data
    return [data] if data else []


async def stream_live_session(
    websocket: WebSocket,
    *,
    openf1_base: str,
    openf1_auth_enabled: bool,
    openf1_headers,
    logger,
):
    await websocket.accept()
    session_key = websocket.query_params.get("session_key", "latest")
    logger.info(
        "WebSocket client connected: %s session_key=%s", websocket.client, session_key
    )
    try:
        while True:
            try:
                headers = await openf1_headers()
                async with httpx.AsyncClient(timeout=8.0) as client:
                    pos = await client.get(
                        f"{openf1_base}/positions?session_key={session_key}",
                        headers=headers,
                    )
                    if pos.status_code == 401 and openf1_auth_enabled:
                        headers = await openf1_headers(force_refresh=True)
                        pos = await client.get(
                            f"{openf1_base}/positions?session_key={session_key}",
                            headers=headers,
                        )
                    ivl = await client.get(
                        f"{openf1_base}/intervals?session_key={session_key}",
                        headers=headers,
                    )
                    ot = await client.get(
                        f"{openf1_base}/overtakes?session_key={session_key}",
                        headers=headers,
                    )
                    wthr = await client.get(
                        f"{openf1_base}/weather?session_key={session_key}",
                        headers=headers,
                    )
                    rc = await client.get(
                        f"{openf1_base}/race_control_messages?session_key={session_key}",
                        headers=headers,
                    )

                weather_raw = openf1_json_tail(wthr, 5)
                weather_one = weather_raw[-1] if weather_raw else None

                await websocket.send_json(
                    {
                        "positions": openf1_json_tail(pos, 120),
                        "intervals": openf1_json_tail(ivl, 80),
                        "overtakes": openf1_json_tail(ot, 100),
                        "weather": weather_one,
                        "race_control": openf1_json_tail(rc, 20),
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                )
            except WebSocketDisconnect:
                raise
            except Exception as exc:
                logger.warning("WebSocket poll error: %s", exc)
                try:
                    await websocket.send_json(
                        {
                            "error": str(exc),
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                    )
                except Exception:
                    raise WebSocketDisconnect()
                # On exception, increase retry count to back off more aggressively
                _increment_retry_count()
                delay = _compute_delay(retry_count=current_retry_count())
                logger.info("WebSocket backoff delay=%.2fs", delay)
                await asyncio.sleep(delay)
            else:
                # Successful poll — reset failure counter and use normal interval with jitter
                _reset_retry_count()
                delay = _compute_delay(retry_count=0)
                await asyncio.sleep(delay)
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected: %s", websocket.client)
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


# Helper: compute delay (seconds) with exponential backoff and jitter
def _compute_delay(
    retry_count: int, base_interval: float = 8.0, max_interval: float = 30.0
) -> float:
    """Compute an interval in seconds using exponential backoff with jitter.

    - `retry_count` 0 => normal base interval with jitter
    - higher `retry_count` increases backoff exponentially (capped)
    Returns a float number of seconds.
    """
    # exponential backoff multiplier
    multiplier = min(2**retry_count, max_interval / base_interval)
    base = base_interval * multiplier
    # jitter between 0.7x and 1.3x
    jitter = 0.7 + random.random() * 0.6
    return base * jitter


# Simple counters for retry state. Use module-level functions so we can test backoff behavior deterministically.
_RETRY_STATE = {"count": 0}


def current_retry_count() -> int:
    return _RETRY_STATE.get("count", 0)


def _reset_retry_count():
    _RETRY_STATE["count"] = 0


def _increment_retry_count():
    _RETRY_STATE["count"] = _RETRY_STATE.get("count", 0) + 1
