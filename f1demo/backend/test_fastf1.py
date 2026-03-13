import fastf1
try:
    s = fastf1.get_event_schedule(2026)
    print("FastF1 2026:", len(s))
except Exception as e:
    print("FastF1 2026 Error:", e)

import requests
try:
    r = requests.get("https://api.jolpi.ca/ergast/f1/2026/driverStandings.json")
    print("Jolpica 2026:", r.status_code, r.text[:100])
except Exception as e:
    print("Jolpica 2026 Error:", e)
