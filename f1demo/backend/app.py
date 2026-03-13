"""F1 Dashboard — Flask API Backend
Proxies OpenF1 API calls with caching to avoid rate limits.
"""
import time
import requests
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

OPENF1_BASE = "https://api.openf1.org/v1"
TI_RAW = "https://raw.githubusercontent.com/TracingInsights"
TI_API = "https://api.github.com/repos/TracingInsights"
CACHE = {}
CACHE_TTL = 60  # seconds


def cached_get(url, ttl=CACHE_TTL):
    """GET with in-memory cache."""
    now = time.time()
    if url in CACHE and now - CACHE[url]["ts"] < ttl:
        return CACHE[url]["data"]
    resp = requests.get(url, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    CACHE[url] = {"data": data, "ts": now}
    return data


# ── Health ──
@app.route("/api/health")
def health():
    try:
        requests.get(f"{OPENF1_BASE}/sessions?session_key=latest", timeout=5)
        return jsonify({"status": "ok"})
    except Exception:
        return jsonify({"status": "error"}), 502


# ── Drivers (latest session) ──
@app.route("/api/drivers")
def drivers():
    session_key = request.args.get("session_key", "latest")
    data = cached_get(f"{OPENF1_BASE}/drivers?session_key={session_key}")
    return jsonify(data)


# ── Driver Championship Standings ──
@app.route("/api/standings/drivers")
def driver_standings():
    session_key = request.args.get("session_key", "latest")
    data = cached_get(f"{OPENF1_BASE}/championship_drivers?session_key={session_key}")
    data.sort(key=lambda x: x.get("position_current", 99))
    return jsonify(data)


# ── Constructor Championship Standings ──
@app.route("/api/standings/constructors")
def constructor_standings():
    session_key = request.args.get("session_key", "latest")
    data = cached_get(f"{OPENF1_BASE}/championship_teams?session_key={session_key}")
    data.sort(key=lambda x: x.get("position_current", 99))

    # Enrich: some entries may have team_name=null; fill from driver data
    missing = any(not t.get("team_name") for t in data)
    if missing:
        try:
            drivers = cached_get(f"{OPENF1_BASE}/drivers?session_key={session_key}")
            driver_champ = cached_get(f"{OPENF1_BASE}/championship_drivers?session_key={session_key}")
            # Build driver_number -> team_name mapping from drivers endpoint
            dn_to_team = {d["driver_number"]: d["team_name"] for d in drivers if d.get("team_name")}
            # Compute total points per team
            team_pts = {}
            for dc in driver_champ:
                tn = dn_to_team.get(dc.get("driver_number"))
                if tn:
                    team_pts.setdefault(tn, 0)
                    team_pts[tn] += dc.get("points_current", 0) or 0
            # Match constructor entries by points
            used = set()
            for t in data:
                if not t.get("team_name"):
                    pts = t.get("points_current", -1)
                    for tn, tp in team_pts.items():
                        if tn not in used and tp == pts:
                            t["team_name"] = tn
                            used.add(tn)
                            break
        except Exception:
            pass

    return jsonify(data)


# ── Meetings (Calendar) ──
@app.route("/api/meetings")
def meetings():
    year = request.args.get("year", str(time.localtime().tm_year))
    data = cached_get(f"{OPENF1_BASE}/meetings?year={year}", ttl=300)
    return jsonify(data)


# ── Sessions ──
@app.route("/api/sessions")
def sessions():
    session_key = request.args.get("session_key", "latest")
    data = cached_get(f"{OPENF1_BASE}/sessions?session_key={session_key}")
    return jsonify(data)


# ── Sessions for a meeting ──
@app.route("/api/sessions/meeting/<int:meeting_key>")
def sessions_for_meeting(meeting_key):
    data = cached_get(f"{OPENF1_BASE}/sessions?meeting_key={meeting_key}")
    return jsonify(data)


# ── Positions (latest session) ──
@app.route("/api/positions")
def positions():
    session_key = request.args.get("session_key", "latest")
    data = cached_get(f"{OPENF1_BASE}/position?session_key={session_key}", ttl=10)
    return jsonify(data)


# ── Laps ──
@app.route("/api/laps")
def laps():
    session_key = request.args.get("session_key", "latest")
    driver = request.args.get("driver_number")
    url = f"{OPENF1_BASE}/laps?session_key={session_key}"
    if driver:
        url += f"&driver_number={driver}"
    data = cached_get(url, ttl=15)
    return jsonify(data)


# ── Pit Stops ──
@app.route("/api/pits")
def pits():
    session_key = request.args.get("session_key", "latest")
    data = cached_get(f"{OPENF1_BASE}/pit?session_key={session_key}", ttl=15)
    return jsonify(data)


# ── Stints (tyre data) ──
@app.route("/api/stints")
def stints():
    session_key = request.args.get("session_key", "latest")
    data = cached_get(f"{OPENF1_BASE}/stints?session_key={session_key}", ttl=15)
    return jsonify(data)


# ── Weather ──
@app.route("/api/weather")
def weather():
    session_key = request.args.get("session_key", "latest")
    data = cached_get(f"{OPENF1_BASE}/weather?session_key={session_key}", ttl=30)
    # Return only the latest weather entry
    if data:
        return jsonify(data[-1])
    return jsonify({})


# ── Team Radio ──
@app.route("/api/team_radio")
def team_radio():
    session_key = request.args.get("session_key", "latest")
    driver = request.args.get("driver_number")
    url = f"{OPENF1_BASE}/team_radio?session_key={session_key}"
    if driver:
        url += f"&driver_number={driver}"
    data = cached_get(url, ttl=30)
    return jsonify(data)


# ── Race Control Messages ──
@app.route("/api/race_control")
def race_control():
    session_key = request.args.get("session_key", "latest")
    data = cached_get(f"{OPENF1_BASE}/race_control?session_key={session_key}", ttl=10)
    return jsonify(data)


# ── Car Data (Telemetry) ──
@app.route("/api/car_data")
def car_data():
    session_key = request.args.get("session_key", "latest")
    driver = request.args.get("driver_number")
    url = f"{OPENF1_BASE}/car_data?session_key={session_key}"
    if driver:
        url += f"&driver_number={driver}"
    data = cached_get(url, ttl=5)
    return jsonify(data)


# ── Intervals ──
@app.route("/api/intervals")
def intervals():
    session_key = request.args.get("session_key", "latest")
    data = cached_get(f"{OPENF1_BASE}/intervals?session_key={session_key}", ttl=10)
    return jsonify(data)


# ── Session Result (race results / podium) ──
@app.route("/api/session_result")
def session_result():
    session_key = request.args.get("session_key", "latest")
    url = f"{OPENF1_BASE}/session_result?session_key={session_key}"
    position = request.args.get("position")
    if position:
        url += f"&position<={position}"
    data = cached_get(url, ttl=60)
    return jsonify(data)


# ── Starting Grid ──
@app.route("/api/starting_grid")
def starting_grid():
    session_key = request.args.get("session_key")
    if not session_key:
        return jsonify([])
    data = cached_get(f"{OPENF1_BASE}/starting_grid?session_key={session_key}", ttl=120)
    return jsonify(data)


# ── Overtakes ──
@app.route("/api/overtakes")
def overtakes():
    session_key = request.args.get("session_key")
    if not session_key:
        return jsonify([])
    data = cached_get(f"{OPENF1_BASE}/overtakes?session_key={session_key}", ttl=60)
    return jsonify(data)


# ── Circuit Map (MultiViewer API) ──
@app.route("/api/circuit_map/<int:circuit_key>")
def circuit_map(circuit_key):
    year = request.args.get("year", str(time.localtime().tm_year))
    url = f"https://api.multiviewer.app/api/v1/circuits/{circuit_key}/{year}"
    now = time.time()
    if url in CACHE and now - CACHE[url]["ts"] < 3600:
        return jsonify(CACHE[url]["data"])
    resp = requests.get(url, timeout=15, headers={"User-Agent": "f1-dashboard/1.0"})
    resp.raise_for_status()
    data = resp.json()
    CACHE[url] = {"data": data, "ts": now}
    return jsonify(data)


# ═══════════════════════════════════════════
# TracingInsights Data Proxy
# ═══════════════════════════════════════════

@app.route("/api/ti/events/<int:year>")
def ti_events(year):
    """List events (Grand Prix directories) for a given year."""
    url = f"{TI_API}/{year}/contents"
    data = cached_get(url, ttl=3600)
    events = [
        item["name"] for item in data
        if item["type"] == "dir" and ("Grand Prix" in item["name"] or "Testing" in item["name"])
    ]
    return jsonify(events)


@app.route("/api/ti/sessions/<int:year>/<path:event>")
def ti_sessions(year, event):
    """List sessions for an event."""
    url = f"{TI_API}/{year}/contents/{requests.utils.quote(event)}"
    data = cached_get(url, ttl=3600)
    sessions = [item["name"] for item in data if item["type"] == "dir"]
    return jsonify(sessions)


@app.route("/api/ti/drivers/<int:year>/<path:event>/<path:session>")
def ti_drivers(year, event, session):
    """Get driver list for a session."""
    url = f"{TI_RAW}/{year}/main/{requests.utils.quote(event)}/{requests.utils.quote(session)}/drivers.json"
    data = cached_get(url, ttl=3600)
    return jsonify(data)


@app.route("/api/ti/laptimes/<int:year>/<path:event>/<path:session>/<driver>")
def ti_laptimes(year, event, session, driver):
    """Get lap times for a specific driver in a session."""
    url = f"{TI_RAW}/{year}/main/{requests.utils.quote(event)}/{requests.utils.quote(session)}/{driver}/laptimes.json"
    data = cached_get(url, ttl=600)
    return jsonify(data)


@app.route("/api/ti/telemetry/<int:year>/<path:event>/<path:session>/<driver>/<int:lap>")
def ti_telemetry(year, event, session, driver, lap):
    """Get per-lap telemetry data for a driver."""
    url = f"{TI_RAW}/{year}/main/{requests.utils.quote(event)}/{requests.utils.quote(session)}/{driver}/{lap}_tel.json"
    data = cached_get(url, ttl=600)
    return jsonify(data)


@app.route("/api/ti/weather/<int:year>/<path:event>/<path:session>")
def ti_weather(year, event, session):
    """Get weather data for a session."""
    url = f"{TI_RAW}/{year}/main/{requests.utils.quote(event)}/{requests.utils.quote(session)}/weather.json"
    data = cached_get(url, ttl=3600)
    return jsonify(data)


if __name__ == "__main__":
    app.run(debug=True, port=5050)
