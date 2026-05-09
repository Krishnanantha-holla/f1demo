"""Run once per season: python scripts/generate_bios.py > bios.json"""

import json

import requests


year = 2026
r = requests.get(f"https://api.jolpi.ca/ergast/f1/{year}/driverStandings.json", timeout=15)
standings = r.json()["MRData"]["StandingsTable"]["StandingsLists"][0]["DriverStandings"]

drivers = {}
for entry in standings:
    d = entry["Driver"]
    number = d.get("permanentNumber", "0")
    drivers[number] = {
        "full_name": f"{d['givenName']} {d['familyName']}",
        "nationality": d.get("nationality", ""),
        "wins": int(entry.get("wins", 0)),
        "points": float(entry.get("points", 0)),
        "position": int(entry.get("position", 0)),
        "team": entry["Constructors"][0]["name"] if entry.get("Constructors") else None,
        "bio": "",
    }

print(json.dumps({"drivers": drivers, "constructors": {}}, indent=2))