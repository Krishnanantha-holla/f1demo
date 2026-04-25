from __future__ import annotations

import asyncio
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
    logger.info("WebSocket client connected: %s session_key=%s", websocket.client, session_key)
    try:
        while True:
            try:
                headers = await openf1_headers()
                async with httpx.AsyncClient(timeout=8.0) as client:
                    pos = await client.get(f"{openf1_base}/position?session_key={session_key}", headers=headers)
                    if pos.status_code == 401 and openf1_auth_enabled:
                        headers = await openf1_headers(force_refresh=True)
                        pos = await client.get(f"{openf1_base}/position?session_key={session_key}", headers=headers)
                    ivl = await client.get(f"{openf1_base}/intervals?session_key={session_key}", headers=headers)
                    ot = await client.get(f"{openf1_base}/overtakes?session_key={session_key}", headers=headers)
                    wthr = await client.get(f"{openf1_base}/weather?session_key={session_key}", headers=headers)
                    rc = await client.get(f"{openf1_base}/race_control?session_key={session_key}", headers=headers)

                weather_raw = openf1_json_tail(wthr, 5)
                weather_one = weather_raw[-1] if weather_raw else None

                await websocket.send_json({
                    "positions": openf1_json_tail(pos, 120),
                    "intervals": openf1_json_tail(ivl, 80),
                    "overtakes": openf1_json_tail(ot, 100),
                    "weather": weather_one,
                    "race_control": openf1_json_tail(rc, 20),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
            except WebSocketDisconnect:
                raise
            except Exception as exc:
                logger.warning("WebSocket poll error: %s", exc)
                try:
                    await websocket.send_json({
                        "error": str(exc),
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })
                except Exception:
                    raise WebSocketDisconnect()
            await asyncio.sleep(8)
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected: %s", websocket.client)
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
