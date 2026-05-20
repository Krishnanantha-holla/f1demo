"""Health check endpoints."""

import json
import time

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from utils import (
    STATE_FILE,
    STATE_LOCK,
    OPENF1,
    _openf1_headers,
    OPENF1_AUTH_ENABLED,
    current_year,
)
from cache_store import cache_backend_name

router = APIRouter()


@router.get("/health")
async def health(request: Request):
    """Health check endpoint."""
    payload: dict = {
        "status": "ok",
        "openf1": "unreachable",
        "cache_backend": cache_backend_name(),
        "automator": None,
    }
    automator_stale = False
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            r = await c.get(
                f"{OPENF1}/sessions?session_key=latest", headers=await _openf1_headers()
            )
            if r.status_code == 401 and OPENF1_AUTH_ENABLED:
                r = await c.get(
                    f"{OPENF1}/sessions?session_key=latest",
                    headers=await _openf1_headers(force_refresh=True),
                )
        if r.status_code == 200:
            payload["openf1"] = "ok"
        else:
            payload["status"] = "degraded"
            payload["openf1"] = f"http_{r.status_code}"
    except Exception:
        payload["status"] = "degraded"
        pass

    try:
        with STATE_LOCK:
            if STATE_FILE.exists():
                st = STATE_FILE.stat()
                age = time.time() - st.st_mtime
                state = json.loads(STATE_FILE.read_text())
                payload["automator"] = {
                    "mode": state.get("mode"),
                    "state_age_seconds": round(age, 1),
                }
                automator_stale = age > 600
    except Exception as exc:
        payload["automator"] = {"error": str(exc)}

    if automator_stale:
        payload["status"] = "degraded"

    response = JSONResponse(payload)
    response.headers["Cache-Control"] = "no-store"
    return response


@router.get("/season")
def season():
    """Get current F1 season year."""
    return {"year": current_year()}
