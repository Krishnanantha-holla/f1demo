"""Server-Sent Events fallback for environments where WebSocket is blocked.

Mirrors the payload shape of the ``/ws/live`` WebSocket so the frontend can
swap transports transparently after a few WS failures.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from utils import OPENF1, OPENF1_AUTH_ENABLED, _openf1_headers
from services.live_stream import openf1_json_tail

router = APIRouter()
logger = logging.getLogger("f1dashboard.sse")


async def _poll_once(client: httpx.AsyncClient, session_key: str) -> dict:
    """Single poll cycle: fetch the same five OpenF1 endpoints as the WS path."""
    headers = await _openf1_headers()
    pos = await client.get(
        f"{OPENF1}/positions?session_key={session_key}", headers=headers
    )
    if pos.status_code == 401 and OPENF1_AUTH_ENABLED:
        headers = await _openf1_headers(force_refresh=True)
        pos = await client.get(
            f"{OPENF1}/positions?session_key={session_key}", headers=headers
        )
    ivl = await client.get(
        f"{OPENF1}/intervals?session_key={session_key}", headers=headers
    )
    ot = await client.get(
        f"{OPENF1}/overtakes?session_key={session_key}", headers=headers
    )
    wthr = await client.get(
        f"{OPENF1}/weather?session_key={session_key}", headers=headers
    )
    rc = await client.get(
        f"{OPENF1}/race_control_messages?session_key={session_key}", headers=headers
    )

    weather_raw = openf1_json_tail(wthr, 5)
    weather_one = weather_raw[-1] if weather_raw else None

    return {
        "positions": openf1_json_tail(pos, 120),
        "intervals": openf1_json_tail(ivl, 80),
        "overtakes": openf1_json_tail(ot, 100),
        "weather": weather_one,
        "race_control": openf1_json_tail(rc, 20),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/live/sse")
async def live_sse(request: Request, session_key: str = "latest"):
    """Stream the same payload as ``/ws/live`` over Server-Sent Events.

    Clients should consume with ``new EventSource('/api/live/sse?session_key=…')``
    and listen for the default ``message`` event. Errors are emitted as a
    named ``error`` event so consumers can degrade gracefully.
    """

    async def event_stream():
        # 30-byte preamble defeats some proxy buffering schemes.
        yield ": connected\n\n"
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                while not await request.is_disconnected():
                    try:
                        payload = await _poll_once(client, session_key)
                        yield f"data: {json.dumps(payload)}\n\n"
                    except Exception as exc:  # pragma: no cover - upstream variability
                        logger.warning("SSE poll error: %s", exc)
                        err = {
                            "message": str(exc),
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                        yield f"event: error\ndata: {json.dumps(err)}\n\n"
                    await asyncio.sleep(8)
        except asyncio.CancelledError:
            # Client closed the stream; nothing more to do.
            return

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
