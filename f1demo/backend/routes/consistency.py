"""Driver consistency analysis endpoint."""

import math
from fastapi import APIRouter, Request, HTTPException
from limiter import limiter
from utils import cached_get, JOLPICA, current_year, logger

router = APIRouter()


@router.get("/consistency")
@limiter.limit("60/minute")
async def get_consistency(request: Request, year: int | None = None):
    yr = year or current_year()
    if yr < 1950 or yr > 2030:
        raise HTTPException(400, "Invalid year")

    data = await cached_get(f"{JOLPICA}/{yr}/results.json?limit=500", ttl=300)
    if not data:
        raise HTTPException(502, "Upstream data unavailable")

    races = data.get("MRData", {}).get("RaceTable", {}).get("Races", [])
    if not races:
        raise HTTPException(404, "No race data found")

    # Collect per-driver finishes
    drivers = {}  # code -> {name, team, finishes: [pos]}
    for race in races:
        for r in race.get("Results", []):
            code = r["Driver"]["code"]
            if code not in drivers:
                drivers[code] = {
                    "name": f"{r['Driver']['givenName']} {r['Driver']['familyName']}",
                    "team": r["Constructor"]["name"], "finishes": [],
                }
            drivers[code]["finishes"].append(int(r["position"]))

    total_races = len(races)
    result = []
    for code, d in drivers.items():
        f = d["finishes"]
        n = len(f)
        if n < 2:
            continue
        avg_f = sum(f) / n
        std_dev = math.sqrt(sum((x - avg_f) ** 2 for x in f) / n)
        points_finishes = sum(1 for x in f if x <= 10)
        result.append({
            "code": code, "name": d["name"], "team": d["team"],
            "avg_finish": round(avg_f, 2), "std_dev": round(std_dev, 2),
            "points_finishes_pct": round(points_finishes / n * 100, 1),
            "best_finish": min(f), "worst_finish": max(f),
            "consistency_score": round(std_dev, 2), "finishes": f,
        })

    result.sort(key=lambda x: x["consistency_score"])
    return {"year": yr, "total_races": total_races, "drivers": result}
