"""Schedule, standings, and free context endpoints."""

import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Request, HTTPException

from utils import (
    logger,
    HAS_FASTF1,
    fastf1,
    current_year,
    _build_free_context,
    cached_get,
    JOLPICA,
    OPENF1,
)
from limiter import limiter

router = APIRouter()


@router.get("/schedule")
async def schedule(year: int = None):
    """Get F1 season schedule."""
    yr = year or current_year()
    if not HAS_FASTF1:
        raise HTTPException(status_code=503, detail="FastF1 not installed")

    def _get_schedule():
        s = fastf1.get_event_schedule(yr, include_testing=False)
        records = s.to_dict(orient="records")
        for r in records:
            for k, v in r.items():
                if hasattr(v, "isoformat"):
                    r[k] = v.isoformat()
        return records

    try:
        return await asyncio.to_thread(_get_schedule)
    except Exception as e:
        logger.error("schedule error year=%s: %s", yr, e)
        raise HTTPException(status_code=500, detail="Failed to fetch schedule")


@router.get("/next-race")
async def next_race():
    """Get next upcoming race."""
    if not HAS_FASTF1:
        raise HTTPException(status_code=503, detail="FastF1 not installed")

    def _get_next_race():
        yr = current_year()
        s = fastf1.get_event_schedule(yr, include_testing=False)
        now = datetime.now(timezone.utc)
        ts = s["EventDate"]
        # Normalize to UTC regardless of whether the column is tz-aware or tz-naive.
        if getattr(ts.dt, "tz", None) is None:
            ts = ts.dt.tz_localize("UTC")
        else:
            ts = ts.dt.tz_convert("UTC")
        upcoming = s[ts > now]
        if upcoming.empty:
            return {}
        row = upcoming.iloc[0].to_dict()
        for k, v in row.items():
            if hasattr(v, "isoformat"):
                row[k] = v.isoformat()
        return row

    try:
        return await asyncio.to_thread(_get_next_race)
    except Exception as e:
        logger.error("next_race error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to fetch next race")


@router.get("/standings/drivers")
@limiter.limit("30/minute")
async def driver_standings(request: Request, year: int = None):
    """Get driver championship standings."""
    yr = year or current_year()
    try:
        data = await cached_get(f"{JOLPICA}/{yr}/driverStandings.json", ttl=300)
        return data["MRData"]["StandingsTable"]["StandingsLists"][0]["DriverStandings"]
    except Exception:
        try:
            return await cached_get(
                f"{OPENF1}/championship_drivers?session_key=latest", ttl=120
            )
        except Exception:
            return []


@router.get("/standings/constructors")
@limiter.limit("30/minute")
async def constructor_standings(request: Request, year: int = None):
    """Get constructor championship standings."""
    yr = year or current_year()
    try:
        data = await cached_get(f"{JOLPICA}/{yr}/constructorStandings.json", ttl=300)
        return data["MRData"]["StandingsTable"]["StandingsLists"][0][
            "ConstructorStandings"
        ]
    except Exception:
        try:
            return await cached_get(
                f"{OPENF1}/championship_teams?session_key=latest", ttl=120
            )
        except Exception:
            return []


@router.get("/results/last")
async def last_results():
    """Get last race results."""
    try:
        data = await cached_get(f"{JOLPICA}/current/last/results.json", ttl=300)
        return data["MRData"]["RaceTable"]["Races"][0]
    except Exception:
        return {}


@router.get("/results/{year}/{round_num}")
async def race_results(year: int, round_num: int):
    """Get race results for specific round."""
    try:
        data = await cached_get(f"{JOLPICA}/{year}/{round_num}/results.json", ttl=600)
        return data
    except Exception:
        return {}


@router.get("/free/context")
async def free_context(year: int = None):
    """Get free context data."""

    def _get_context():
        return _build_free_context(year)

    try:
        return await asyncio.to_thread(_get_context)
    except Exception as e:
        logger.error("free_context error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to fetch context")


@router.get("/free/roster")
async def free_roster(year: int = None):
    """Get driver roster with standings data."""
    yr = year or current_year()
    roster: dict[int, dict] = {}

    try:
        standings = await cached_get(f"{JOLPICA}/{yr}/driverStandings.json", ttl=300)
        driver_standings = standings["MRData"]["StandingsTable"]["StandingsLists"][0][
            "DriverStandings"
        ]
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
            entry = roster.setdefault(
                number,
                {
                    "driver_number": number,
                    "first_name": driver.get("givenName") or "",
                    "last_name": driver.get("familyName") or "",
                    "full_name": f"{driver.get('givenName', '')} {driver.get('familyName', '')}".strip(),
                    "name_acronym": driver.get("code") or "",
                    "team_name": None,
                    "position": 0,
                    "points": 0,
                    "wins": 0,
                },
            )
            constructor = result.get("Constructor") or {}
            if constructor.get("name"):
                entry["team_name"] = constructor.get("name")
    except Exception:
        pass

    return list(
        sorted(
            roster.values(),
            key=lambda item: (
                item.get("position") or 999,
                item.get("driver_number") or 999,
            ),
        )
    )
