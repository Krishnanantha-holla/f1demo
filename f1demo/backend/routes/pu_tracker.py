"""Power Unit element tracker endpoint."""

import json
import math
from pathlib import Path
from fastapi import APIRouter, Request, HTTPException
from limiter import limiter
from utils import cached_get, JOLPICA, current_year, logger

router = APIRouter()
PU_DATA = json.loads((Path(__file__).resolve().parent.parent / "data" / "pu_allocations.json").read_text())


@router.get("/pu-elements")
@limiter.limit("60/minute")
async def get_pu_elements(request: Request, year: int | None = None):
    yr = year or current_year()
    if yr < 2022 or yr > 2030:
        raise HTTPException(400, "PU tracking available from 2022 onwards")

    # Get races completed
    season = await cached_get(f"{JOLPICA}/{yr}.json", ttl=600)
    total_races = PU_DATA["total_races"]
    races_completed = 0
    if season:
        races = season.get("MRData", {}).get("RaceTable", {}).get("Races", [])
        races_completed = len(races)

    alloc = PU_DATA["allocations"]
    drivers_out = []

    for d in PU_DATA["drivers"]:
        usage = {}
        for component, limit in alloc.items():
            races_per = total_races / limit
            usage[component] = min(limit, math.ceil(races_completed / races_per)) if races_completed > 0 else 1

        # Determine penalty risk
        risk = "LOW"
        for component, limit in alloc.items():
            if usage[component] >= limit:
                risk = "HIGH"
                break
            elif usage[component] == limit - 1:
                risk = "MEDIUM"

        drivers_out.append({"driver": d["driver"], "team": d["team"], **usage, "penalty_risk": risk})

    return {"year": yr, "races_completed": races_completed, "allocations": alloc, "drivers": drivers_out}
