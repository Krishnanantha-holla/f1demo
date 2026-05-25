"""Race pace / stint analysis endpoint using FastF1."""

import asyncio
from fastapi import APIRouter, Request, HTTPException
from limiter import limiter
from utils import logger, HAS_FASTF1, fastf1

router = APIRouter()


@router.get("/race-pace")
@limiter.limit("30/minute")
async def get_race_pace(request: Request, year: int = 2025, round: int = 1):
    if not HAS_FASTF1:
        raise HTTPException(503, "FastF1 not available")
    if year < 2018 or year > 2030:
        raise HTTPException(400, "Year must be between 2018 and 2030")
    if round < 1 or round > 30:
        raise HTTPException(400, "Invalid round")

    def _load():
        session = fastf1.get_session(year, round, 'R')
        session.load(telemetry=False, weather=False)
        laps = session.laps[["Driver", "LapNumber", "LapTime", "Compound", "Stint", "PitInTime", "PitOutTime"]].copy()
        # Filter out pit in/out laps
        laps = laps[laps["PitInTime"].isna() & laps["PitOutTime"].isna()]
        laps = laps.dropna(subset=["LapTime", "Compound", "Stint"])
        laps["LapTimeS"] = laps["LapTime"].dt.total_seconds()
        # Remove outliers (> 150% of median)
        median = laps["LapTimeS"].median()
        laps = laps[laps["LapTimeS"] < median * 1.5]

        stints = []
        for (driver, stint_num), group in laps.groupby(["Driver", "Stint"]):
            group = group.sort_values("LapNumber")
            times = group["LapTimeS"].tolist()
            if len(times) < 2:
                continue
            compound = group["Compound"].iloc[0]
            deg_slope = round((times[-1] - times[0]) / len(times), 4)
            avg_pace = round(sum(times) / len(times), 3)
            lap_data = [{"lap_num": int(r["LapNumber"]), "lap_time_s": round(r["LapTimeS"], 3)}
                        for _, r in group.iterrows()]
            stints.append({
                "driver": driver, "driver_code": driver, "stint_number": int(stint_num),
                "compound": compound, "laps": lap_data, "deg_slope": deg_slope, "avg_pace": avg_pace,
            })

        return {"year": year, "round": round, "event_name": session.event["EventName"], "stints": stints}

    try:
        return await asyncio.to_thread(_load)
    except Exception as e:
        logger.error("race_pace error year=%s round=%s: %s", year, round, e)
        raise HTTPException(500, "Failed to load race pace data")
