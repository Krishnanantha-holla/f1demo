"""F1 Dashboard — Automator
Runs 24/7. Watches F1 calendar, detects live sessions, polls TracingInsights
for new data commits, handles season rollover. Zero manual intervention.
"""
import json
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
import schedule

try:
    import fastf1
    fastf1.Cache.enable_cache('./cache')
    HAS_FASTF1 = True
except ImportError:
    HAS_FASTF1 = False

CURRENT_YEAR = datetime.now().year
STATE_FILE = Path('./state.json')


def get_state():
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {"last_session": None, "last_commit": None, "mode": "idle"}


def save_state(state):
    STATE_FILE.write_text(json.dumps(state, default=str))


def detect_live_session():
    """Check if any F1 session is currently live via OpenF1."""
    try:
        r = requests.get(
            "https://api.openf1.org/v1/sessions?session_key=latest", timeout=5
        )
        if r.status_code != 200:
            return False
        data = r.json()
        if not data:
            return False
        s = data[0] if isinstance(data, list) else data
        start = datetime.fromisoformat(s["date_start"].replace("Z", "+00:00"))
        end = datetime.fromisoformat(s["date_end"].replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        return start <= now <= end
    except Exception:
        return False


def check_tracinginsights():
    """Poll GitHub for new TracingInsights data commits."""
    state = get_state()
    year = datetime.now().year
    try:
        r = requests.get(
            f"https://api.github.com/repos/TracingInsights/{year}/commits?per_page=1",
            headers={"Accept": "application/vnd.github.v3+json"},
            timeout=10,
        )
        if r.status_code == 200 and r.json():
            latest = r.json()[0]["sha"]
            if latest != state.get("last_commit"):
                print(f"[AUTOMATOR] New data in TracingInsights/{year}! Refreshing...")
                state["last_commit"] = latest
                save_state(state)
                trigger_refresh()
    except Exception as e:
        print(f"[AUTOMATOR] GitHub check failed: {e}")


def trigger_refresh():
    """Tell FastAPI backend to clear its cache."""
    try:
        requests.post("http://localhost:8000/internal/refresh-cache", timeout=5)
    except Exception:
        pass


def set_mode(mode: str):
    """Update session mode: live | post-session | idle"""
    state = get_state()
    if state.get("mode") != mode:
        state["mode"] = mode
        save_state(state)
        print(f"[AUTOMATOR] Mode → {mode}")
        # Write mode file for frontend polling
        public = Path('./public')
        public.mkdir(exist_ok=True)
        (public / 'session_mode.json').write_text(
            json.dumps({"mode": mode, "ts": datetime.now().isoformat()})
        )


def check_season_rollover():
    """On Jan 1, update CURRENT_YEAR and pre-warm cache."""
    global CURRENT_YEAR
    new_year = datetime.now().year
    if new_year != CURRENT_YEAR:
        print(f"[AUTOMATOR] Season rollover! {CURRENT_YEAR} → {new_year}")
        CURRENT_YEAR = new_year
        if HAS_FASTF1:
            try:
                fastf1.get_event_schedule(new_year)
                print(f"[AUTOMATOR] Pre-cached {new_year} schedule")
            except Exception:
                pass


def main_loop():
    if detect_live_session():
        set_mode("live")
    else:
        set_mode("idle")
    check_tracinginsights()
    check_season_rollover()


# Schedule checks
schedule.every(2).minutes.do(main_loop)
schedule.every(15).minutes.do(check_tracinginsights)
schedule.every(1).hours.do(check_season_rollover)

if __name__ == "__main__":
    print("[AUTOMATOR] Running. Watching for sessions and data updates...")
    main_loop()  # Run once immediately
    while True:
        schedule.run_pending()
        time.sleep(30)
