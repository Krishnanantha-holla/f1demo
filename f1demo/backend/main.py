"""F1 Dashboard — FastAPI Backend
Layered data architecture: OpenF1 (live), FastF1 (historical), Jolpica/Ergast (standings/results).
Season-agnostic: never hardcodes a year, team, or driver.
"""
import time
import json
import asyncio
import os
import logging
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, WebSocket, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import httpx
import requests as sync_requests

from cache_store import cache_backend_name, cache_clear, cache_lookup, cache_write
from services.free_context import (
    build_free_context,
    current_year as svc_current_year,
    ensure_utc as svc_ensure_utc,
    event_session_windows as svc_event_session_windows,
)
from services.live_stream import openf1_json_tail, stream_live_session
from services.news_service import fetch_news

# ── Structured logging ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("f1dashboard")

# ── Try importing fastf1 (optional — degrades gracefully if not installed) ──
try:
    import fastf1
    fastf1.Cache.enable_cache('./cache')
    HAS_FASTF1 = True
except ImportError:
    HAS_FASTF1 = False
    logger.warning("fastf1 not installed — historical data endpoints will be unavailable")

# ── Rate limiter ──
limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])

# ── Allowed origins — set ALLOWED_ORIGINS env var for production ──
_raw_origins = os.getenv("ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()] or [
    "http://localhost:5173",
    "http://localhost:4173",
    "http://127.0.0.1:5173",
]

app = FastAPI(title="F1 Dashboard API", version="2.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

CACHE_TTL = 60  # seconds


def cached_get_sync(url: str, ttl: int = CACHE_TTL) -> dict | list | None:
    """Synchronous GET with cache (memory + optional Redis)."""
    data, hit = cache_lookup(url, ttl)
    if hit:
        return data
    resp = sync_requests.get(url, timeout=15)
    if resp.status_code == 404:
        logger.debug("404 from %s", url)
        return None
    resp.raise_for_status()
    data = resp.json()
    cache_write(url, data, ttl)
    return data


async def cached_get(url: str, ttl: int = CACHE_TTL) -> dict | list | None:
    """Async GET with cache (memory + optional Redis)."""
    data, hit = cache_lookup(url, ttl)
    if hit:
        return data
    async with httpx.AsyncClient(timeout=15.0) as client:
        headers = await _openf1_headers()
        resp = await client.get(url, headers=headers)
        # If token expired, refresh once and retry.
        if resp.status_code == 401 and OPENF1_AUTH_ENABLED:
            retry_headers = await _openf1_headers(force_refresh=True)
            resp = await client.get(url, headers=retry_headers)
        if resp.status_code == 404:
            logger.debug("404 from %s", url)
            return None
        if resp.status_code >= 500:
            logger.warning("Upstream server error %s from %s", resp.status_code, url)
        resp.raise_for_status()
        data = resp.json()
    cache_write(url, data, ttl)
    return data


async def safe_cached_get(url: str, default, ttl: int = CACHE_TTL):
    """Return cached remote data or a safe fallback when upstream is unavailable."""
    try:
        result = await cached_get(url, ttl=ttl)
        return result if result is not None else default
    except Exception as exc:
        logger.warning("safe_cached_get failed for %s: %s", url, exc)
        return default


def current_year() -> int:
    return svc_current_year()


def _event_session_windows(row) -> list[dict]:
    return svc_event_session_windows(row)


def _build_free_context(year: int | None = None) -> dict:
    ff1 = fastf1 if HAS_FASTF1 else None
    return build_free_context(HAS_FASTF1, ff1, year=year)


def _ensure_utc(dt_value):
    return svc_ensure_utc(dt_value)


# ══════════════════════════════════════════
# OPENF1 API BASE
# ══════════════════════════════════════════
OPENF1 = "https://api.openf1.org/v1"
JOLPICA = "https://api.jolpi.ca/ergast/f1"
TI_RAW = "https://raw.githubusercontent.com/TracingInsights"
TI_API = "https://api.github.com/repos/TracingInsights"

OPENF1_TOKEN_URL = "https://api.openf1.org/token"
OPENF1_USERNAME = os.getenv("OPENF1_USERNAME")
OPENF1_PASSWORD = os.getenv("OPENF1_PASSWORD")
OPENF1_ACCESS_TOKEN = os.getenv("OPENF1_ACCESS_TOKEN")
OPENF1_AUTH_ENABLED = bool(OPENF1_ACCESS_TOKEN or (OPENF1_USERNAME and OPENF1_PASSWORD))

OPENF1_TOKEN_STATE = {
    "token": OPENF1_ACCESS_TOKEN,
    # When passed as static env var, keep it until upstream rejects it.
    "expires_at": 10**12 if OPENF1_ACCESS_TOKEN else 0,
}
OPENF1_TOKEN_LOCK = asyncio.Lock()


async def _fetch_openf1_token() -> tuple[str | None, int]:
    """Fetch a short-lived OpenF1 OAuth token using configured credentials."""
    if not (OPENF1_USERNAME and OPENF1_PASSWORD):
        return None, 0

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            OPENF1_TOKEN_URL,
            data={"username": OPENF1_USERNAME, "password": OPENF1_PASSWORD},
            headers={"Content-Type": "application/x-www-form-urlencoded", "accept": "application/json"},
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

    # If only a static token is configured (no username/password), keep using it.
    if OPENF1_ACCESS_TOKEN and not (OPENF1_USERNAME and OPENF1_PASSWORD):
        return OPENF1_ACCESS_TOKEN

    async with OPENF1_TOKEN_LOCK:
        now = time.time()
        current = OPENF1_TOKEN_STATE.get("token")
        if not force_refresh and current and now < OPENF1_TOKEN_STATE.get("expires_at", 0):
            return current

        token, expires_in = await _fetch_openf1_token()
        if not token:
            return current

        # Refresh a bit early to avoid token expiry mid-request.
        safe_ttl = max(expires_in - 30, 30)
        OPENF1_TOKEN_STATE["token"] = token
        OPENF1_TOKEN_STATE["expires_at"] = now + safe_ttl
        return token


async def _openf1_headers(force_refresh: bool = False) -> dict:
    headers = {"accept": "application/json"}
    if OPENF1_AUTH_ENABLED:
        token = await _get_openf1_token(force_refresh=force_refresh)
        if token:
            headers["Authorization"] = f"Bearer {token}"
    return headers


# ══════════════════════════════════════════
# HEALTH
# ══════════════════════════════════════════
@app.get("/api/health")
@limiter.limit("30/minute")
async def health(request: Request):
    payload: dict = {
        "status": "degraded",
        "openf1": "unreachable",
        "cache_backend": cache_backend_name(),
        "automator": None,
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            r = await c.get(f"{OPENF1}/sessions?session_key=latest", headers=await _openf1_headers())
            if r.status_code == 401 and OPENF1_AUTH_ENABLED:
                r = await c.get(
                    f"{OPENF1}/sessions?session_key=latest",
                    headers=await _openf1_headers(force_refresh=True),
                )
        if r.status_code == 200:
            payload["status"] = "ok"
            payload["openf1"] = "ok"
        else:
            payload["openf1"] = f"http_{r.status_code}"
    except Exception:
        pass

    state_file = Path("./state.json")
    if state_file.exists():
        try:
            st = state_file.stat()
            age = time.time() - st.st_mtime
            state = json.loads(state_file.read_text())
            payload["automator"] = {
                "mode": state.get("mode"),
                "state_age_seconds": round(age, 1),
            }
        except Exception as exc:
            payload["automator"] = {"error": str(exc)}

    return payload


# ══════════════════════════════════════════
# SEASON & SCHEDULE
# ══════════════════════════════════════════
@app.get("/api/season")
def season():
    return {"year": current_year()}


@app.get("/api/schedule")
def schedule(year: int = None):
    yr = year or current_year()
    if not HAS_FASTF1:
        return {"error": "FastF1 not installed"}
    s = fastf1.get_event_schedule(yr, include_testing=False)
    records = s.to_dict(orient="records")
    # Serialize Timestamp objects
    for r in records:
        for k, v in r.items():
            if hasattr(v, "isoformat"):
                r[k] = v.isoformat()
    return records


@app.get("/api/next-race")
def next_race():
    if not HAS_FASTF1:
        return {}
    yr = current_year()
    try:
        s = fastf1.get_event_schedule(yr, include_testing=False)
        now = datetime.now(timezone.utc)
        # EventDate may be a Timestamp — compare safely
        upcoming = s[s["EventDate"].dt.tz_localize("UTC") > now] if s["EventDate"].dt.tz is None else s[s["EventDate"] > now]
        if upcoming.empty:
            return {}
        row = upcoming.iloc[0].to_dict()
        for k, v in row.items():
            if hasattr(v, "isoformat"):
                row[k] = v.isoformat()
        return row
    except Exception:
        return {}


# ══════════════════════════════════════════
# STANDINGS (Jolpica / Ergast)
# ══════════════════════════════════════════
@app.get("/api/standings/drivers")
@limiter.limit("30/minute")
async def driver_standings(request: Request, year: int = None):
    yr = year or current_year()
    try:
        data = await cached_get(f"{JOLPICA}/{yr}/driverStandings.json", ttl=300)
        return data["MRData"]["StandingsTable"]["StandingsLists"][0]["DriverStandings"]
    except Exception:
        # Fallback to OpenF1
        try:
            return await cached_get(f"{OPENF1}/championship_drivers?session_key=latest", ttl=120)
        except Exception:
            return []


@app.get("/api/standings/constructors")
@limiter.limit("30/minute")
async def constructor_standings(request: Request, year: int = None):
    yr = year or current_year()
    try:
        data = await cached_get(f"{JOLPICA}/{yr}/constructorStandings.json", ttl=300)
        return data["MRData"]["StandingsTable"]["StandingsLists"][0]["ConstructorStandings"]
    except Exception:
        try:
            return await cached_get(f"{OPENF1}/championship_teams?session_key=latest", ttl=120)
        except Exception:
            return []


# ══════════════════════════════════════════
# RACE RESULTS (Jolpica / Ergast)
# ══════════════════════════════════════════
@app.get("/api/results/last")
async def last_results():
    try:
        data = await cached_get(f"{JOLPICA}/current/last/results.json", ttl=300)
        return data["MRData"]["RaceTable"]["Races"][0]
    except Exception:
        return {}


@app.get("/api/results/{year}/{round_num}")
async def race_results(year: int, round_num: int):
    try:
        data = await cached_get(f"{JOLPICA}/{year}/{round_num}/results.json", ttl=600)
        return data
    except Exception:
        return {}


@app.get("/api/free/context")
def free_context(year: int = None):
    return _build_free_context(year)


@app.get("/api/free/roster")
async def free_roster(year: int = None):
    yr = year or current_year()
    roster: dict[int, dict] = {}

    try:
        standings = await cached_get(f"{JOLPICA}/{yr}/driverStandings.json", ttl=300)
        driver_standings = standings["MRData"]["StandingsTable"]["StandingsLists"][0]["DriverStandings"]
    except Exception:
        driver_standings = []

    for entry in driver_standings:
        driver = entry.get("Driver", {})
        driver_number = driver.get("permanentNumber")
        if not driver_number:
            continue
        number = int(driver_number)
        constructors = entry.get("Constructors") or []
        team_name = constructors[0].get("name") if constructors else None
        roster[number] = {
            "driver_number": number,
            "first_name": driver.get("givenName") or "",
            "last_name": driver.get("familyName") or "",
            "full_name": f"{driver.get('givenName', '')} {driver.get('familyName', '')}".strip(),
            "name_acronym": driver.get("code") or "",
            "team_name": team_name,
            "position": int(entry.get("position") or 0),
            "points": float(entry.get("points") or 0),
            "wins": int(entry.get("wins") or 0),
        }

    try:
        latest = await cached_get(f"{JOLPICA}/{yr}/last/results.json", ttl=300)
        race = latest["MRData"]["RaceTable"]["Races"][0]
        for result in race.get("Results", []):
            driver = result.get("Driver", {})
            number = driver.get("permanentNumber") or result.get("number")
            if not number:
                continue
            number = int(number)
            entry = roster.setdefault(number, {
                "driver_number": number,
                "first_name": driver.get("givenName") or "",
                "last_name": driver.get("familyName") or "",
                "full_name": f"{driver.get('givenName', '')} {driver.get('familyName', '')}".strip(),
                "name_acronym": driver.get("code") or "",
                "team_name": None,
                "position": 0,
                "points": 0,
                "wins": 0,
            })
            constructor = result.get("Constructor") or {}
            if constructor.get("name"):
                entry["team_name"] = constructor.get("name")
    except Exception:
        pass

    return list(sorted(roster.values(), key=lambda item: (item.get("position") or 999, item.get("driver_number") or 999)))


# ══════════════════════════════════════════
# LAP TIMES (FastF1)
# ══════════════════════════════════════════
@app.get("/api/laps/{year}/{event}/{session_type}")
def get_laps(
    request: Request,
    year: int,
    event: str,
    session_type: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(500, ge=1, le=2000),
):
    if not HAS_FASTF1:
        return {"error": "FastF1 not installed"}
    if year < 2018 or year > 2030:
        return {"error": "year must be between 2018 and 2030"}
    if session_type not in ("R", "Q", "FP1", "FP2", "FP3", "SQ", "SR", "S"):
        return {"error": "invalid session_type"}
    try:
        s = fastf1.get_session(year, event, session_type)
        s.load(telemetry=False, weather=False)
        laps = s.laps[
            ["Driver", "LapNumber", "LapTime", "Compound", "IsPersonalBest",
             "Sector1Time", "Sector2Time", "Sector3Time", "Stint", "Position"]
        ].dropna(subset=["LapTime"])
        laps["LapTimeSeconds"] = laps["LapTime"].dt.total_seconds()
        laps["Sector1Seconds"] = laps["Sector1Time"].dt.total_seconds()
        laps["Sector2Seconds"] = laps["Sector2Time"].dt.total_seconds()
        laps["Sector3Seconds"] = laps["Sector3Time"].dt.total_seconds()
        result = laps[
            ["Driver", "LapNumber", "LapTimeSeconds", "Compound",
             "IsPersonalBest", "Sector1Seconds", "Sector2Seconds",
             "Sector3Seconds", "Stint", "Position"]
        ].to_dict(orient="records")
        total = len(result)
        start = (page - 1) * page_size
        end = start + page_size
        return {
            "data": result[start:end],
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": max(1, (total + page_size - 1) // page_size),
        }
    except Exception as e:
        logger.error("get_laps error year=%s event=%s session=%s: %s", year, event, session_type, e)
        return {"error": str(e)}


# ══════════════════════════════════════════
# TELEMETRY (FastF1)
# ══════════════════════════════════════════
@app.get("/api/telemetry/{year}/{event}/{session_type}/{driver}")
def get_telemetry(
    request: Request,
    year: int,
    event: str,
    session_type: str,
    driver: str,
):
    if not HAS_FASTF1:
        return {"error": "FastF1 not installed"}
    if year < 2018 or year > 2030:
        return {"error": "year must be between 2018 and 2030"}
    if session_type not in ("R", "Q", "FP1", "FP2", "FP3", "SQ", "SR", "S"):
        return {"error": "invalid session_type"}
    if not driver.isalpha() or not (2 <= len(driver) <= 4):
        return {"error": "driver must be a 2-4 letter code"}
    try:
        s = fastf1.get_session(year, event, session_type)
        s.load()
        fastest = s.laps.pick_driver(driver).pick_fastest()
        tel = fastest.get_telemetry()[
            ["Distance", "Speed", "Throttle", "Brake", "RPM", "nGear", "DRS", "X", "Y"]
        ]
        # Sample every 5 rows to reduce payload
        sampled = tel.iloc[::5]
        return sampled.to_dict(orient="records")
    except Exception as e:
        logger.error("get_telemetry error year=%s event=%s session=%s driver=%s: %s", year, event, session_type, driver, e)
        return {"error": str(e)}


# ══════════════════════════════════════════
# OPENF1 LIVE PROXY
# ══════════════════════════════════════════
@app.get("/api/live/{endpoint}")
async def live_proxy(endpoint: str, session_key: str = "latest"):
    try:
        data = await cached_get(
            f"{OPENF1}/{endpoint}?session_key={session_key}", ttl=10
        )
        return data
    except Exception:
        return []


# ── Preserved OpenF1 proxy endpoints (same as original Flask app) ──
@app.get("/api/drivers")
async def drivers(session_key: str = "latest"):
    return await safe_cached_get(f"{OPENF1}/drivers?session_key={session_key}", [], ttl=120)


@app.get("/api/meetings")
async def meetings(year: int = None):
    yr = year or current_year()
    return await safe_cached_get(f"{OPENF1}/meetings?year={yr}", [], ttl=300)


@app.get("/api/sessions")
async def sessions(session_key: str = "latest"):
    return await safe_cached_get(f"{OPENF1}/sessions?session_key={session_key}", [], ttl=120)


@app.get("/api/sessions/meeting/{meeting_key}")
async def sessions_for_meeting(meeting_key: int):
    return await safe_cached_get(f"{OPENF1}/sessions?meeting_key={meeting_key}", [], ttl=300)


@app.get("/api/positions")
async def positions(session_key: str = "latest"):
    return await safe_cached_get(f"{OPENF1}/position?session_key={session_key}", [], ttl=10)


@app.get("/api/laps")
async def laps_openf1(session_key: str = "latest", driver_number: int = None):
    url = f"{OPENF1}/laps?session_key={session_key}"
    if driver_number:
        url += f"&driver_number={driver_number}"
    return await safe_cached_get(url, [], ttl=15)


@app.get("/api/pits")
async def pits(session_key: str = "latest"):
    return await safe_cached_get(f"{OPENF1}/pit?session_key={session_key}", [], ttl=15)


@app.get("/api/stints")
async def stints(session_key: str = "latest"):
    return await safe_cached_get(f"{OPENF1}/stints?session_key={session_key}", [], ttl=15)


@app.get("/api/weather")
async def weather(session_key: str = "latest"):
    data = await safe_cached_get(f"{OPENF1}/weather?session_key={session_key}", [], ttl=30)
    if data and isinstance(data, list):
        return data[-1]
    return {}


@app.get("/api/race_control")
async def race_control(session_key: str = "latest"):
    return await safe_cached_get(f"{OPENF1}/race_control?session_key={session_key}", [], ttl=10)


@app.get("/api/car_data")
async def car_data(session_key: str = "latest", driver_number: int = None):
    url = f"{OPENF1}/car_data?session_key={session_key}"
    if driver_number:
        url += f"&driver_number={driver_number}"
    return await safe_cached_get(url, [], ttl=5)


@app.get("/api/intervals")
async def intervals(session_key: str = "latest"):
    return await safe_cached_get(f"{OPENF1}/intervals?session_key={session_key}", [], ttl=10)


@app.get("/api/session_result")
async def session_result(session_key: str = "latest", position: int = None):
    url = f"{OPENF1}/session_result?session_key={session_key}"
    if position:
        url += f"&position<={position}"
    return await safe_cached_get(url, [], ttl=60)


@app.get("/api/starting_grid")
async def starting_grid(session_key: str = None):
    if not session_key:
        return []
    return await safe_cached_get(f"{OPENF1}/starting_grid?session_key={session_key}", [], ttl=120)


@app.get("/api/overtakes")
async def overtakes(session_key: str = None):
    if not session_key:
        return []
    return await safe_cached_get(f"{OPENF1}/overtakes?session_key={session_key}", [], ttl=60)


@app.get("/api/team_radio")
async def team_radio(session_key: str = "latest", driver_number: int = None):
    url = f"{OPENF1}/team_radio?session_key={session_key}"
    if driver_number:
        url += f"&driver_number={driver_number}"
    return await safe_cached_get(url, [], ttl=30)


@app.get("/api/circuit_map/{circuit_key}")
async def circuit_map(circuit_key: int, year: int = None):
    yr = year or current_year()
    url = f"https://api.multiviewer.app/api/v1/circuits/{circuit_key}/{yr}"
    cache_key = f"multiviewer:{circuit_key}:{yr}"
    data, hit = cache_lookup(cache_key, 3600)
    if hit:
        return data
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, headers={"User-Agent": "f1-dashboard/2.0"})
        resp.raise_for_status()
        data = resp.json()
    cache_write(cache_key, data, 3600)
    return data


# ══════════════════════════════════════════
# SESSION MODE (for frontend polling)
# ══════════════════════════════════════════
@app.get("/api/session-mode")
async def session_mode():
    # Prefer OpenF1 for real-time mode detection; fall back to state file if unavailable.
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                f"{OPENF1}/sessions?session_key=latest",
                headers=await _openf1_headers(),
            )
            if resp.status_code == 401 and OPENF1_AUTH_ENABLED:
                resp = await client.get(
                    f"{OPENF1}/sessions?session_key=latest",
                    headers=await _openf1_headers(force_refresh=True),
                )

        if resp.status_code == 200:
            payload = resp.json() if resp.content else []
            session = payload[0] if isinstance(payload, list) and payload else None
            if session and session.get("date_start") and session.get("date_end"):
                now = datetime.now(timezone.utc)
                start = datetime.fromisoformat(session["date_start"].replace("Z", "+00:00"))
                end = datetime.fromisoformat(session["date_end"].replace("Z", "+00:00"))
                if start <= now <= end:
                    return {"mode": "live", "session": session, "source": "openf1"}

        if resp.status_code == 401:
            try:
                detail = (resp.json() or {}).get("detail", "")
            except Exception:
                detail = resp.text or ""
            if "Live F1 session in progress" in detail:
                return {
                    "mode": "live",
                    "session": None,
                    "source": "openf1",
                    "reason": "openf1_live_restricted",
                    "detail": detail,
                }
    except Exception:
        pass

    state_file = Path("./state.json")
    if state_file.exists():
        return json.loads(state_file.read_text())
    return {"mode": "idle", "ts": datetime.now().isoformat()}


# ══════════════════════════════════════════
# INTERNAL: Cache Refresh (called by automator)
# ══════════════════════════════════════════
@app.post("/internal/refresh-cache")
def refresh_cache():
    cache_clear()
    return {"status": "cache_cleared"}


# ══════════════════════════════════════════
# TRACINGINSIGHTS DATA PROXY
# ══════════════════════════════════════════
@app.get("/api/ti/events/{year}")
async def ti_events(year: int):
    url = f"{TI_API}/{year}/contents"
    data = await cached_get(url, ttl=3600)
    events = [
        item["name"]
        for item in data
        if item["type"] == "dir"
        and ("Grand Prix" in item["name"] or "Testing" in item["name"])
    ]
    return events


@app.get("/api/ti/sessions/{year}/{event:path}")
async def ti_sessions(year: int, event: str):
    from urllib.parse import quote
    url = f"{TI_API}/{year}/contents/{quote(event)}"
    data = await cached_get(url, ttl=3600)
    sessions = [item["name"] for item in data if item["type"] == "dir"]
    return sessions


@app.get("/api/ti/drivers/{year}/{event:path}/{session:path}")
async def ti_drivers(year: int, event: str, session: str):
    from urllib.parse import quote
    url = f"{TI_RAW}/{year}/main/{quote(event)}/{quote(session)}/drivers.json"
    return await cached_get(url, ttl=3600)


@app.get("/api/ti/laptimes/{year}/{event:path}/{session:path}/{driver}")
async def ti_laptimes(year: int, event: str, session: str, driver: str):
    from urllib.parse import quote
    url = f"{TI_RAW}/{year}/main/{quote(event)}/{quote(session)}/{driver}/laptimes.json"
    return await cached_get(url, ttl=600)


@app.get("/api/ti/telemetry/{year}/{event:path}/{session:path}/{driver}/{lap}")
async def ti_telemetry(year: int, event: str, session: str, driver: str, lap: int):
    from urllib.parse import quote
    url = f"{TI_RAW}/{year}/main/{quote(event)}/{quote(session)}/{driver}/{lap}_tel.json"
    return await cached_get(url, ttl=600)


@app.get("/api/ti/weather/{year}/{event:path}/{session:path}")
async def ti_weather(year: int, event: str, session: str):
    from urllib.parse import quote
    url = f"{TI_RAW}/{year}/main/{quote(event)}/{quote(session)}/weather.json"
    return await cached_get(url, ttl=3600)


# ══════════════════════════════════════════
# ENCYCLOPEDIA & NEWS (NEW)
# ══════════════════════════════════════════
@app.get("/api/news")
async def get_news():
    return await fetch_news(cache_lookup, cache_write, logger)

@app.get("/api/bios")
def get_bios():
    # Attempt to load rich bios from bios.json if it exists, otherwise return empty
    bios_path = Path('./bios.json')
    if bios_path.exists():
        return json.loads(bios_path.read_text())
    return {"drivers": {}, "constructors": {}}


# ══════════════════════════════════════════
# WEBSOCKET: LIVE TIMING
# ══════════════════════════════════════════
def _openf1_json_tail(resp: httpx.Response, tail: int):
    return openf1_json_tail(resp, tail)


@app.websocket("/ws/live")
async def ws_live(websocket: WebSocket):
    await stream_live_session(
        websocket,
        openf1_base=OPENF1,
        openf1_auth_enabled=OPENF1_AUTH_ENABLED,
        openf1_headers=_openf1_headers,
        logger=logger,
    )


# ══════════════════════════════════════════
# RUN
# ══════════════════════════════════════════
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
