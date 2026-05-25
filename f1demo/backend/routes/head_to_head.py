"""Head-to-head driver comparison endpoint."""

import re
from fastapi import APIRouter, Request, HTTPException
from limiter import limiter
from utils import cached_get, JOLPICA, current_year, logger

router = APIRouter()


def _validate_driver_code(code: str) -> str:
    code = code.strip().upper()
    if not re.match(r"^[A-Z]{3}$", code):
        raise HTTPException(400, "Driver code must be 3 uppercase letters")
    return code


@router.get("/head-to-head")
@limiter.limit("30/minute")
async def head_to_head(request: Request, driver1: str, driver2: str, year: int | None = None):
    d1 = _validate_driver_code(driver1)
    d2 = _validate_driver_code(driver2)
    yr = year or current_year()
    if yr < 1950 or yr > 2030:
        raise HTTPException(400, "Invalid year")

    race_data = await cached_get(f"{JOLPICA}/{yr}/results.json?limit=500", ttl=300)
    qual_data = await cached_get(f"{JOLPICA}/{yr}/qualifying.json?limit=500", ttl=300)

    if not race_data or not qual_data:
        raise HTTPException(502, "Upstream data unavailable")

    races = race_data.get("MRData", {}).get("RaceTable", {}).get("Races", [])
    quals = qual_data.get("MRData", {}).get("RaceTable", {}).get("Races", [])

    # Build qualifying lookup: round -> {driver_code: position}
    qual_map = {}
    for q in quals:
        rnd = int(q["round"])
        qual_map[rnd] = {}
        for r in q.get("QualifyingResults", []):
            qual_map[rnd][r["Driver"]["code"]] = int(r["position"])

    stats = {d1: {"wins": 0, "podiums": 0, "points": 0, "dnfs": 0, "positions": [], "qual_positions": []},
             d2: {"wins": 0, "podiums": 0, "points": 0, "dnfs": 0, "positions": [], "qual_positions": []}}
    h2h_race = {d1: 0, d2: 0}
    h2h_qual = {d1: 0, d2: 0}
    rounds = []

    for race in races:
        rnd = int(race["round"])
        results = race.get("Results", [])
        round_data = {"round": rnd, "race_name": race.get("raceName", "")}
        d1_res = d2_res = None

        for r in results:
            code = r["Driver"]["code"]
            if code == d1:
                d1_res = r
            elif code == d2:
                d2_res = r

        if not d1_res or not d2_res:
            continue

        for code, res in [(d1, d1_res), (d2, d2_res)]:
            pos = int(res["position"])
            pts = float(res.get("points", 0))
            status = res.get("status", "")
            stats[code]["positions"].append(pos)
            stats[code]["points"] += pts
            if pos <= 3:
                stats[code]["podiums"] += 1
            if pos == 1:
                stats[code]["wins"] += 1
            if "Finished" not in status and "+1 Lap" not in status and "+2 Lap" not in status:
                stats[code]["dnfs"] += 1

        d1_pos = int(d1_res["position"])
        d2_pos = int(d2_res["position"])
        if d1_pos < d2_pos:
            h2h_race[d1] += 1
        elif d2_pos < d1_pos:
            h2h_race[d2] += 1

        # Qualifying
        d1_qual = qual_map.get(rnd, {}).get(d1)
        d2_qual = qual_map.get(rnd, {}).get(d2)
        if d1_qual:
            stats[d1]["qual_positions"].append(d1_qual)
        if d2_qual:
            stats[d2]["qual_positions"].append(d2_qual)
        if d1_qual and d2_qual:
            if d1_qual < d2_qual:
                h2h_qual[d1] += 1
            elif d2_qual < d1_qual:
                h2h_qual[d2] += 1

        round_data["d1_pos"] = d1_pos
        round_data["d2_pos"] = d2_pos
        round_data["d1_quali"] = d1_qual
        round_data["d2_quali"] = d2_qual
        rounds.append(round_data)

    def avg(lst):
        return round(sum(lst) / len(lst), 2) if lst else None

    return {
        "year": yr,
        "driver1": {
            "code": d1, "wins": stats[d1]["wins"], "podiums": stats[d1]["podiums"],
            "points": stats[d1]["points"], "dnfs": stats[d1]["dnfs"],
            "avg_finish": avg(stats[d1]["positions"]),
            "avg_qualifying": avg(stats[d1]["qual_positions"]),
        },
        "driver2": {
            "code": d2, "wins": stats[d2]["wins"], "podiums": stats[d2]["podiums"],
            "points": stats[d2]["points"], "dnfs": stats[d2]["dnfs"],
            "avg_finish": avg(stats[d2]["positions"]),
            "avg_qualifying": avg(stats[d2]["qual_positions"]),
        },
        "h2h_race": h2h_race,
        "h2h_qualifying": h2h_qual,
        "races": rounds,
    }
