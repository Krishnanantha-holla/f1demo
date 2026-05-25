"""Driver statistics endpoint."""

import re
from fastapi import APIRouter, Request, HTTPException
from limiter import limiter
from utils import cached_get, JOLPICA, current_year, logger

router = APIRouter()

# Map 3-letter codes to Ergast driver IDs
DRIVER_CODE_TO_ID = {
    "VER": "max_verstappen", "NOR": "norris", "LEC": "leclerc",
    "PIA": "piastri", "HAM": "hamilton", "RUS": "russell",
    "SAI": "sainz", "ALO": "alonso", "GAS": "gasly",
    "STR": "stroll", "TSU": "tsunoda", "ALB": "albon",
    "HUL": "hulkenberg", "PER": "perez", "ANT": "antonelli",
    "DOO": "doohan", "HAD": "hadjar", "BOR": "bortoleto",
    "OCO": "ocon", "MAG": "kevin_magnussen", "BOT": "bottas",
    "ZHO": "zhou", "RIC": "ricciardo", "LAW": "lawson",
    "BEA": "bearman", "COL": "colapinto",
}


@router.get("/driver-stats")
@limiter.limit("30/minute")
async def get_driver_stats(request: Request, driver: str = "VER", year: int | None = None):
    code = driver.strip().upper()
    if not re.match(r"^[A-Z]{3}$", code):
        raise HTTPException(400, "Driver code must be 3 uppercase letters")
    yr = year or current_year()
    if yr < 1950 or yr > 2030:
        raise HTTPException(400, "Invalid year")

    driver_id = DRIVER_CODE_TO_ID.get(code, code.lower())
    results_data = await cached_get(f"{JOLPICA}/{yr}/drivers/{driver_id}/results.json?limit=100", ttl=300)
    qual_data = await cached_get(f"{JOLPICA}/{yr}/drivers/{driver_id}/qualifying.json?limit=100", ttl=300)
    standings_data = await cached_get(f"{JOLPICA}/{yr}/drivers/{driver_id}/driverStandings.json", ttl=300)

    if not results_data:
        raise HTTPException(404, "No results found for driver/year")

    races = results_data.get("MRData", {}).get("RaceTable", {}).get("Races", [])
    quals = qual_data.get("MRData", {}).get("RaceTable", {}).get("Races", []) if qual_data else []

    wins = 0
    podiums = 0
    fastest_laps = 0
    total_points = 0.0
    laps_led = 0
    positions = []
    season_progression = []
    cumulative_pts = 0.0
    start_vs_finish = []

    for race in races:
        for r in race.get("Results", []):
            pos = int(r["position"])
            pts = float(r.get("points", 0))
            grid = int(r.get("grid", 0))
            laps = int(r.get("laps", 0))
            positions.append(pos)
            total_points += pts
            cumulative_pts += pts
            if pos == 1:
                wins += 1
                laps_led += laps
            if pos <= 3:
                podiums += 1
            if r.get("FastestLap", {}).get("rank") == "1":
                fastest_laps += 1
            start_vs_finish.append({"round": int(race["round"]), "grid": grid, "finish": pos, "delta": grid - pos})
            season_progression.append({"round": int(race["round"]), "points": cumulative_pts})

    # Qualifying stats
    qual_positions = []
    for q in quals:
        for r in q.get("QualifyingResults", []):
            qual_positions.append(int(r["position"]))

    num_races = len(positions)
    avg_finish = round(sum(positions) / num_races, 2) if num_races else None
    qual_avg = round(sum(qual_positions) / len(qual_positions), 2) if qual_positions else None
    podium_pct = round(podiums / num_races * 100, 1) if num_races else 0
    points_per_race = round(total_points / num_races, 2) if num_races else 0

    # Standings info
    championship_pos = None
    if standings_data:
        standings_lists = standings_data.get("MRData", {}).get("StandingsTable", {}).get("StandingsLists", [])
        if standings_lists:
            for s in standings_lists[0].get("DriverStandings", []):
                if s.get("Driver", {}).get("code", "").upper() == code:
                    championship_pos = int(s["position"])

    return {
        "driver": code, "year": yr, "wins": wins, "podiums": podiums,
        "fastest_laps": fastest_laps, "total_points": total_points,
        "laps_led": laps_led, "avg_finish": avg_finish,
        "qualifying_avg": qual_avg, "podium_pct": podium_pct,
        "points_per_race": points_per_race, "championship_position": championship_pos,
        "start_vs_finish": start_vs_finish,
        "season_progression": season_progression,
    }
