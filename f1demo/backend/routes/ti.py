"""TracingInsights data proxy endpoints."""
import re
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException

from utils import logger, cached_get, TI_RAW, TI_API

router = APIRouter()


def _validate_ti_param(value: str, param_name: str, max_length: int = 100):
    """Validate TracingInsights path parameters to prevent injection attacks."""
    if not value or len(value) > max_length:
        raise HTTPException(status_code=400, detail=f"Invalid {param_name}: length constraint")
    if not re.match(r'^[a-zA-Z0-9\s\-_()]+$', value):
        raise HTTPException(status_code=400, detail=f"Invalid {param_name}: invalid characters")


@router.get("/ti/events/{year}")
async def ti_events(year: int):
    """Get TracingInsights events for a year."""
    if year < 1950 or year > 2100:
        raise HTTPException(status_code=400, detail="Invalid year")
    url = f"{TI_API}/{year}/contents"
    try:
        data = await cached_get(url, ttl=3600)
        events = [
            item["name"]
            for item in data
            if item["type"] == "dir"
            and ("Grand Prix" in item["name"] or "Testing" in item["name"])
        ]
        return events
    except Exception as e:
        logger.error("ti_events error year=%s: %s", year, e)
        raise HTTPException(status_code=500, detail="Failed to fetch TI events")


@router.get("/ti/sessions/{year}/{event:path}")
async def ti_sessions(year: int, event: str):
    """Get sessions for a TI event."""
    _validate_ti_param(event, "event")
    from urllib.parse import quote
    url = f"{TI_API}/{year}/contents/{quote(event)}"
    try:
        data = await cached_get(url, ttl=3600)
        sessions = [item["name"] for item in data if item["type"] == "dir"]
        return sessions
    except Exception as e:
        logger.error("ti_sessions error year=%s event=%s: %s", year, event, e)
        raise HTTPException(status_code=500, detail="Failed to fetch TI sessions")


@router.get("/ti/drivers/{year}/{event:path}/{session:path}")
async def ti_drivers(year: int, event: str, session: str):
    """Get drivers for a TI session."""
    _validate_ti_param(event, "event")
    _validate_ti_param(session, "session")
    from urllib.parse import quote
    url = f"{TI_RAW}/{year}/main/{quote(event)}/{quote(session)}/drivers.json"
    try:
        return await cached_get(url, ttl=3600)
    except Exception as e:
        logger.error("ti_drivers error: %s", e)
        return []


@router.get("/ti/laptimes/{year}/{event:path}/{session:path}/{driver}")
async def ti_laptimes(year: int, event: str, session: str, driver: str):
    """Get lap times from TI."""
    _validate_ti_param(event, "event")
    _validate_ti_param(session, "session")
    _validate_ti_param(driver, "driver", max_length=10)
    from urllib.parse import quote
    url = f"{TI_RAW}/{year}/main/{quote(event)}/{quote(session)}/{driver}/laptimes.json"
    try:
        return await cached_get(url, ttl=600)
    except Exception as e:
        logger.error("ti_laptimes error: %s", e)
        return []


@router.get("/ti/telemetry/{year}/{event:path}/{session:path}/{driver}/{lap}")
async def ti_telemetry(year: int, event: str, session: str, driver: str, lap: int):
    """Get telemetry from TI."""
    _validate_ti_param(event, "event")
    _validate_ti_param(session, "session")
    _validate_ti_param(driver, "driver", max_length=10)
    if lap < 0 or lap > 10000:
        raise HTTPException(status_code=400, detail="Invalid lap number")
    from urllib.parse import quote
    url = f"{TI_RAW}/{year}/main/{quote(event)}/{quote(session)}/{driver}/{lap}_tel.json"
    try:
        return await cached_get(url, ttl=600)
    except Exception as e:
        logger.error("ti_telemetry error: %s", e)
        return []


@router.get("/ti/weather/{year}/{event:path}/{session:path}")
async def ti_weather(year: int, event: str, session: str):
    """Get weather from TI."""
    _validate_ti_param(event, "event")
    _validate_ti_param(session, "session")
    from urllib.parse import quote
    url = f"{TI_RAW}/{year}/main/{quote(event)}/{quote(session)}/weather.json"
    try:
        return await cached_get(url, ttl=3600)
    except Exception as e:
        logger.error("ti_weather error: %s", e)
        return []
