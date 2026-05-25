"""Live track map - proxies OpenF1 position data."""

from fastapi import APIRouter, Request, HTTPException
from limiter import limiter
from utils import safe_cached_get, OPENF1, logger

router = APIRouter()


@router.get("/live-track-map")
@limiter.limit("60/minute")
async def get_live_track_map(request: Request, session_key: str = "latest"):
    positions = await safe_cached_get(f"{OPENF1}/position?session_key={session_key}", [], ttl=5)
    drivers = await safe_cached_get(f"{OPENF1}/drivers?session_key={session_key}", [], ttl=30)

    if not positions:
        return {"session_key": session_key, "positions": []}

    # Build driver info lookup
    driver_info = {}
    for d in drivers:
        driver_info[d.get("driver_number")] = {
            "name_acronym": d.get("name_acronym", ""),
            "team_colour": d.get("team_colour", ""),
        }

    # Get latest position per driver
    latest = {}
    for p in positions:
        dn = p.get("driver_number")
        if dn not in latest or p.get("date", "") > latest[dn].get("date", ""):
            latest[dn] = p

    result = []
    for dn, p in latest.items():
        info = driver_info.get(dn, {})
        result.append({
            "driver_number": dn, "name_acronym": info.get("name_acronym", ""),
            "team_colour": info.get("team_colour", ""),
            "x": p.get("x"), "y": p.get("y"), "date": p.get("date"),
        })

    return {"session_key": session_key, "positions": result}
