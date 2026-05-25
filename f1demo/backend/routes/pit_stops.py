"""Pit stops analysis endpoint."""

from builtins import round as _round
from fastapi import APIRouter, Query, Request, HTTPException
from limiter import limiter
from utils import cached_get, safe_cached_get, JOLPICA, current_year, logger

router = APIRouter()


@router.get("/pit-stops")
@limiter.limit("60/minute")
async def get_pit_stops(request: Request, year: int | None = None, round: int | None = Query(None, alias="round")):
    yr = year or current_year()
    rnd = round
    if yr < 2012 or yr > 2030:
        raise HTTPException(400, "Pit stop data available from 2012 onwards")

    if rnd:
        data = await cached_get(f"{JOLPICA}/{yr}/{rnd}/pitstops.json?limit=100", ttl=300)
        if not data:
            raise HTTPException(502, "Upstream data unavailable")

        race = data.get("MRData", {}).get("RaceTable", {}).get("Races", [])
        if not race:
            raise HTTPException(404, "No pit stop data found")

        stops_raw = race[0].get("PitStops", [])
        race_name = race[0].get("raceName", "")

        results_data = await safe_cached_get(f"{JOLPICA}/{yr}/{rnd}/results.json", {}, ttl=300)
        team_map = {}
        results_races = results_data.get("MRData", {}).get("RaceTable", {}).get("Races", [])
        if results_races:
            for r in results_races[0].get("Results", []):
                team_map[r["Driver"]["familyName"]] = r["Constructor"]["name"]
                team_map[r["Driver"]["driverId"]] = r["Constructor"]["name"]

        pit_stops = []
        for s in stops_raw:
            driver_id = s.get("driverId", "")
            pit_stops.append({
                "driver": driver_id, "team": team_map.get(driver_id, ""),
                "lap": int(s.get("lap", 0)), "duration": s.get("duration", ""),
                "stop_number": int(s.get("stop", 0)),
            })

        team_times = {}
        for s in pit_stops:
            try:
                dur = float(s["duration"].split(":")[0]) if ":" in str(s["duration"]) else float(s["duration"])
            except (ValueError, IndexError):
                continue
            team = s["team"]
            if team:
                team_times.setdefault(team, []).append(dur)

        team_averages = [{"team": t, "avg_duration": _round(sum(v) / len(v), 3), "total_stops": len(v)}
                         for t, v in sorted(team_times.items(), key=lambda x: sum(x[1]) / len(x[1]))]

        fastest = min(pit_stops, key=lambda x: float(x["duration"]) if x["duration"] else 999) if pit_stops else None
        fastest_stop = {"driver": fastest["driver"], "team": fastest["team"],
                        "duration": fastest["duration"], "lap": fastest["lap"]} if fastest else None

        return {"year": yr, "round": rnd, "race_name": race_name,
                "pit_stops": pit_stops, "team_averages": team_averages, "fastest_stop": fastest_stop}

    season_data = await cached_get(f"{JOLPICA}/{yr}.json", ttl=600)
    if not season_data:
        raise HTTPException(502, "Upstream data unavailable")
    races = season_data.get("MRData", {}).get("RaceTable", {}).get("Races", [])
    return {"year": yr, "total_rounds": len(races),
            "message": "Provide a round parameter for detailed pit stop data"}
