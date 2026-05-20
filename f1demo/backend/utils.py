"""Shared utilities and configuration for F1 Dashboard API."""

import time
import json
import asyncio
import os
import logging
from pathlib import Path

from cachetools import TTLCache
import httpx
from filelock import FileLock
from fastapi import HTTPException
import re

from services.free_context import (
    build_free_context,
    current_year as svc_current_year,
    ensure_utc as svc_ensure_utc,
    event_session_windows as svc_event_session_windows,
)

# ── Structured logging ──
logger = logging.getLogger("f1dashboard")

# ── Try importing fastf1 (optional — degrades gracefully if not installed) ──
try:
    import fastf1

    fastf1.Cache.enable_cache("./cache")
    HAS_FASTF1 = True
except ImportError:
    fastf1 = None
    HAS_FASTF1 = False
    logger.warning(
        "fastf1 not installed — historical data endpoints will be unavailable"
    )

# ── Cache setup ──
CACHE_TTL = 60  # seconds
_cache: TTLCache = TTLCache(maxsize=512, ttl=CACHE_TTL)
_cache_lock = asyncio.Lock()
STATE_FILE = Path("./state.json")
STATE_LOCK = FileLock(str(STATE_FILE) + ".lock")

# ── API URLs ──
OPENF1 = "https://api.openf1.org/v1"
JOLPICA = "https://api.jolpi.ca/ergast/f1"
TI_RAW = "https://raw.githubusercontent.com/TracingInsights"
TI_API = "https://api.github.com/repos/TracingInsights"

# ── OpenF1 Authentication ──
OPENF1_TOKEN_URL = "https://api.openf1.org/token"
OPENF1_USERNAME = os.getenv("OPENF1_USERNAME")
OPENF1_PASSWORD = os.getenv("OPENF1_PASSWORD")
OPENF1_ACCESS_TOKEN = os.getenv("OPENF1_ACCESS_TOKEN")
OPENF1_AUTH_ENABLED = bool(OPENF1_ACCESS_TOKEN or (OPENF1_USERNAME and OPENF1_PASSWORD))

APP_ENV = os.getenv("APP_ENV", "development").strip().lower()

# ── Internal API secret for authenticating internal-only endpoints ──
INTERNAL_SECRET = os.getenv("INTERNAL_SECRET")
if APP_ENV == "production" and (
    not INTERNAL_SECRET or INTERNAL_SECRET == "changeme-in-production"
):
    raise RuntimeError("INTERNAL_SECRET must be set in production")
if not INTERNAL_SECRET:
    INTERNAL_SECRET = "changeme-in-development"

OPENF1_TOKEN_STATE = {
    "token": OPENF1_ACCESS_TOKEN,
    "expires_at": 10**12 if OPENF1_ACCESS_TOKEN else 0,
}
OPENF1_TOKEN_LOCK = asyncio.Lock()


def _read_state_file() -> dict:
    """Read automator state file."""
    with STATE_LOCK:
        if STATE_FILE.exists():
            return json.loads(STATE_FILE.read_text())
    return {"last_session": None, "last_commit": None, "mode": "idle"}


async def cached_get(url: str, ttl: int = CACHE_TTL) -> dict | list | None:
    """Fetch from cache or HTTP with fallback.

    Respect per-call `ttl` by incorporating it into the cache key so callers
    can request different expiry windows without changing the global cache
    instance TTL.
    """
    key = f"{ttl}:{url}"
    async with _cache_lock:
        if key in _cache:
            return _cache[key]

    async with httpx.AsyncClient(timeout=15.0) as client:
        headers = await _openf1_headers()
        resp = await client.get(url, headers=headers)
        if resp.status_code == 401 and OPENF1_AUTH_ENABLED:
            headers = await _openf1_headers(force_refresh=True)
            resp = await client.get(url, headers=headers)
        if resp.status_code == 404:
            logger.debug("404 from %s", url)
            return None
        if resp.status_code >= 500:
            logger.warning("Upstream %s from %s", resp.status_code, url)
        resp.raise_for_status()
        data = resp.json()

    async with _cache_lock:
        _cache[key] = data
    return data


async def safe_cached_get(url: str, default, ttl: int = CACHE_TTL):
    """Cached GET with fallback default."""
    try:
        result = await cached_get(url, ttl=ttl)
        return result if result is not None else default
    except Exception as exc:
        logger.warning("safe_cached_get failed %s: %s", url, exc)
        return default


async def clear_request_cache() -> None:
    """Clear the in-process TTLCache used by cached_get."""
    async with _cache_lock:
        _cache.clear()


def current_year() -> int:
    """Get current F1 season year."""
    return svc_current_year()


def _event_session_windows(row) -> list[dict]:
    """Extract session windows from schedule row."""
    return svc_event_session_windows(row)


def _build_free_context(year: int | None = None) -> dict:
    """Build free context data."""
    ff1 = fastf1 if HAS_FASTF1 else None
    return build_free_context(HAS_FASTF1, ff1, year=year)


def _ensure_utc(dt_value):
    """Ensure datetime is UTC."""
    return svc_ensure_utc(dt_value)


def _fastf1_schedule_records(year: int) -> list[dict]:
    """Get schedule records from FastF1."""
    if not HAS_FASTF1:
        return []
    try:
        schedule = fastf1.get_event_schedule(year, include_testing=False)
    except Exception:
        return []

    records = []
    for index, (_, row) in enumerate(schedule.iterrows(), start=1):
        data = row.to_dict()
        round_num = int(data.get("RoundNumber") or index)
        start = data.get("EventDate")
        end = start
        for session_index in range(5, 0, -1):
            candidate = data.get(f"Session{session_index}DateUtc")
            if candidate is not None:
                end = candidate
                break
        records.append(
            {
                "meeting_key": round_num,
                "year": year,
                "meeting_name": data.get("EventName")
                or data.get("OfficialEventName")
                or f"Round {round_num}",
                "location": data.get("Location") or data.get("Country") or "",
                "country_name": data.get("Country") or data.get("CountryName") or "",
                "circuit_short_name": data.get("CircuitShortName")
                or data.get("Location")
                or data.get("EventName")
                or "",
                "circuit_key": data.get("CircuitKey"),
                "date_start": start.isoformat()
                if hasattr(start, "isoformat")
                else None,
                "date_end": end.isoformat() if hasattr(end, "isoformat") else None,
                "source": "fastf1",
                "_schedule_row": data,
            }
        )
    return records


def _fastf1_sessions_for_round(year: int, meeting_key: int) -> list[dict]:
    """Get sessions for a specific round from FastF1."""
    schedule_records = _fastf1_schedule_records(year)
    match = next(
        (
            row
            for row in schedule_records
            if int(row.get("meeting_key") or -1) == int(meeting_key)
        ),
        None,
    )
    if not match:
        return []

    row = match["_schedule_row"]
    windows = svc_event_session_windows(row)
    sessions = []
    for index, window in enumerate(windows, start=1):
        sessions.append(
            {
                "session_key": int(meeting_key) * 10 + index,
                "session_name": window["name"],
                "date_start": window["start"].isoformat(),
                "date_end": window["end"].isoformat(),
                "source": "fastf1",
            }
        )
    return sessions


async def _fetch_openf1_token() -> tuple[str | None, int]:
    """Fetch a short-lived OpenF1 OAuth token using configured credentials."""
    if not (OPENF1_USERNAME and OPENF1_PASSWORD):
        return None, 0

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            OPENF1_TOKEN_URL,
            data={"username": OPENF1_USERNAME, "password": OPENF1_PASSWORD},
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "accept": "application/json",
            },
        )

    if resp.status_code != 200:
        return None, 0

    body = resp.json() if resp.content else {}
    token = body.get("access_token")
    try:
        expires_in = int(body.get("expires_in", 0))
    except Exception:
        expires_in = 0
    return token, expires_in


async def _get_openf1_token(force_refresh: bool = False) -> str | None:
    """Return an access token if available via env or OAuth credentials."""
    now = time.time()
    current = OPENF1_TOKEN_STATE.get("token")
    if not force_refresh and current and now < OPENF1_TOKEN_STATE.get("expires_at", 0):
        return current

    if OPENF1_ACCESS_TOKEN and not (OPENF1_USERNAME and OPENF1_PASSWORD):
        return OPENF1_ACCESS_TOKEN

    async with OPENF1_TOKEN_LOCK:
        now = time.time()
        current = OPENF1_TOKEN_STATE.get("token")
        if (
            not force_refresh
            and current
            and now < OPENF1_TOKEN_STATE.get("expires_at", 0)
        ):
            return current

        token, expires_in = await _fetch_openf1_token()
        if not token:
            return current

        safe_ttl = max(expires_in - 30, 30)
        OPENF1_TOKEN_STATE["token"] = token
        OPENF1_TOKEN_STATE["expires_at"] = now + safe_ttl
        return token


async def _openf1_headers(force_refresh: bool = False) -> dict:
    """Get HTTP headers for OpenF1 API requests."""
    headers = {"accept": "application/json"}
    if OPENF1_AUTH_ENABLED:
        token = await _get_openf1_token(force_refresh=force_refresh)
        if token:
            headers["Authorization"] = f"Bearer {token}"
    return headers


def _validate_ti_param(value: str, param_name: str, max_length: int = 100):
    """Validate TracingInsights path parameters to prevent injection attacks."""
    if not value or len(value) > max_length:
        raise HTTPException(
            status_code=400, detail=f"Invalid {param_name}: length constraint"
        )
    if not re.match(r"^[a-zA-Z0-9\s\-_()]+$", value):
        raise HTTPException(
            status_code=400, detail=f"Invalid {param_name}: invalid characters"
        )
