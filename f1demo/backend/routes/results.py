"""Results archive endpoint."""

from fastapi import APIRouter, Request, HTTPException
from limiter import limiter
from utils import cached_get, JOLPICA, current_year, logger

router = APIRouter()


@router.get("/results/archive")
@limiter.limit("60/minute")
async def get_results_archive(request: Request, year: int | None = None, round: int = 1, session: str = "R"):
    yr = year or current_year()
    if yr < 1950 or yr > 2030:
        raise HTTPException(400, "Invalid year")
    if session not in ("R", "Q", "S"):
        raise HTTPException(400, "Session must be R, Q, or S")

    if session == "Q":
        url = f"{JOLPICA}/{yr}/{round}/qualifying.json"
    elif session == "S":
        url = f"{JOLPICA}/{yr}/{round}/sprint.json"
    else:
        url = f"{JOLPICA}/{yr}/{round}/results.json"

    data = await cached_get(url, ttl=300)
    if not data:
        raise HTTPException(502, "Upstream data unavailable")

    races = data.get("MRData", {}).get("RaceTable", {}).get("Races", [])
    if not races:
        raise HTTPException(404, "No results found")

    race = races[0]
    race_name = race.get("raceName", "")

    classifications = []
    if session == "Q":
        for r in race.get("QualifyingResults", []):
            classifications.append({
                "position": int(r["position"]), "driver_code": r["Driver"]["code"],
                "driver_name": f"{r['Driver']['givenName']} {r['Driver']['familyName']}",
                "team": r["Constructor"]["name"],
                "time": r.get("Q3") or r.get("Q2") or r.get("Q1", ""),
                "gap": None, "laps": None, "points": None, "status": None, "grid": None,
            })
    else:
        key = "SprintResults" if session == "S" else "Results"
        for r in race.get(key, []):
            classifications.append({
                "position": int(r["position"]), "driver_code": r["Driver"]["code"],
                "driver_name": f"{r['Driver']['givenName']} {r['Driver']['familyName']}",
                "team": r["Constructor"]["name"],
                "time": r.get("Time", {}).get("time", r.get("status", "")),
                "gap": r.get("Time", {}).get("time") if int(r["position"]) > 1 else None,
                "laps": int(r.get("laps", 0)), "points": float(r.get("points", 0)),
                "status": r.get("status", ""), "grid": int(r.get("grid", 0)),
            })

    return {"year": yr, "round": round, "race_name": race_name, "session": session, "classifications": classifications}
