"""OpenF1 live session and timing data endpoints."""

from fastapi import APIRouter, WebSocket, HTTPException

from utils import (
    logger,
    cached_get,
    safe_cached_get,
    OPENF1,
    OPENF1_AUTH_ENABLED,
    _openf1_headers,
)
from services.live_stream import stream_live_session

router = APIRouter()
ws_router = APIRouter()


@router.get("/live/{endpoint}")
async def live_proxy(endpoint: str, session_key: str = "latest"):
    """Proxy live data from OpenF1."""
    if endpoint not in (
        "positions",
        "intervals",
        "overtakes",
        "race_control",
        "weather",
        "car_data",
        "pits",
        "stints",
        "team_radio",
    ):
        raise HTTPException(status_code=400, detail="Invalid live endpoint")
    # Some OpenF1 resource names differ from our public proxy names. Map them here.
    target = endpoint
    if endpoint == "race_control":
        target = "race_control_messages"
    url = f"{OPENF1}/{target}?session_key={session_key}"
    try:
        return await cached_get(url, ttl=8)
    except Exception as e:
        logger.error("live_proxy error endpoint=%s: %s", endpoint, e)
        raise HTTPException(status_code=500, detail="Failed to fetch live data")


@router.get("/drivers")
async def drivers(session_key: str = "latest"):
    """Get drivers in current session."""
    return await safe_cached_get(
        f"{OPENF1}/drivers?session_key={session_key}", [], ttl=120
    )


@router.get("/meetings")
async def meetings(year: int = None):
    """Get F1 meetings."""
    url = f"{OPENF1}/meetings" + (f"?year={year}" if year else "")
    return await safe_cached_get(url, [], ttl=3600)


@router.get("/sessions")
async def sessions(session_key: str = "latest"):
    """Get sessions."""
    return await safe_cached_get(
        f"{OPENF1}/sessions?session_key={session_key}", [], ttl=120
    )


@router.get("/sessions/meeting/{meeting_key}")
async def sessions_for_meeting(meeting_key: int):
    """Get sessions for a meeting."""
    return await safe_cached_get(
        f"{OPENF1}/sessions?meeting_key={meeting_key}", [], ttl=3600
    )


@router.get("/positions")
async def positions(session_key: str = "latest"):
    """Get current race positions."""
    return await safe_cached_get(
        f"{OPENF1}/positions?session_key={session_key}", [], ttl=8
    )


@router.get("/laps")
async def laps_openf1(session_key: str = "latest", driver_number: int = None):
    """Get laps from OpenF1."""
    url = f"{OPENF1}/laps?session_key={session_key}"
    if driver_number:
        url += f"&driver_number={driver_number}"
    return await safe_cached_get(url, [], ttl=60)


@router.get("/pits")
async def pits(session_key: str = "latest"):
    """Get pit stop data."""
    return await safe_cached_get(
        f"{OPENF1}/pit_stops?session_key={session_key}", [], ttl=30
    )


@router.get("/stints")
async def stints(session_key: str = "latest"):
    """Get stint data."""
    return await safe_cached_get(
        f"{OPENF1}/stints?session_key={session_key}", [], ttl=60
    )


@router.get("/weather")
async def weather(session_key: str = "latest"):
    """Get weather data."""
    return await safe_cached_get(
        f"{OPENF1}/weather?session_key={session_key}", [], ttl=30
    )


@router.get("/race_control")
async def race_control(session_key: str = "latest"):
    """Get race control messages."""
    data = await safe_cached_get(
        f"{OPENF1}/race_control_messages?session_key={session_key}", [], ttl=15
    )
    return data


@router.get("/car_data")
async def car_data(session_key: str = "latest", driver_number: int = None):
    """Get car telemetry data."""
    url = f"{OPENF1}/car_data?session_key={session_key}"
    if driver_number:
        url += f"&driver_number={driver_number}"
    return await safe_cached_get(url, [], ttl=30)


@router.get("/intervals")
async def intervals(session_key: str = "latest"):
    """Get interval gaps."""
    return await safe_cached_get(
        f"{OPENF1}/intervals?session_key={session_key}", [], ttl=8
    )


@router.get("/session_result")
async def session_result(session_key: str = "latest", position: int = None):
    """Get session results."""
    url = f"{OPENF1}/session_history"
    if position:
        url += f"?position={position}&session_key={session_key}"
    else:
        url += f"?session_key={session_key}"
    return await safe_cached_get(url, {}, ttl=120)


@router.get("/starting_grid")
async def starting_grid(session_key: str = None):
    """Get starting grid."""
    if not session_key:
        session_key = "latest"
    return await safe_cached_get(
        f"{OPENF1}/starting_grid?session_key={session_key}", [], ttl=3600
    )


@router.get("/overtakes")
async def overtakes(session_key: str = None):
    """Get overtake events."""
    if not session_key:
        session_key = "latest"
    return await safe_cached_get(
        f"{OPENF1}/overtakes?session_key={session_key}", [], ttl=30
    )


@router.get("/team_radio")
async def team_radio(session_key: str = "latest", driver_number: int = None):
    """Get team radio messages."""
    url = f"{OPENF1}/team_radio?session_key={session_key}"
    if driver_number:
        url += f"&driver_number={driver_number}"
    return await safe_cached_get(url, [], ttl=300)


@router.get("/session-mode")
async def session_mode():
    """Get current session mode."""
    # This endpoint checks automator state and returns current mode
    from utils import _read_state_file

    try:
        state = _read_state_file()
        return {
            "mode": state.get("mode", "idle"),
            "ts": __import__("datetime")
            .datetime.now(__import__("datetime").timezone.utc)
            .isoformat(),
        }
    except Exception:
        return {
            "mode": "idle",
            "ts": __import__("datetime")
            .datetime.now(__import__("datetime").timezone.utc)
            .isoformat(),
        }


@ws_router.websocket("/ws/live")
async def ws_live(websocket: WebSocket):
    """WebSocket endpoint for live timing updates."""
    await stream_live_session(
        websocket,
        openf1_base=OPENF1,
        openf1_auth_enabled=OPENF1_AUTH_ENABLED,
        openf1_headers=_openf1_headers,
        logger=logger,
    )
