from __future__ import annotations

from datetime import datetime, timezone, timedelta


def current_year() -> int:
    return datetime.now().year


def ensure_utc(dt_value):
    if dt_value is None:
        return None
    if hasattr(dt_value, "to_pydatetime"):
        dt_value = dt_value.to_pydatetime()
    if getattr(dt_value, "tzinfo", None) is None:
        return dt_value.replace(tzinfo=timezone.utc)
    return dt_value.astimezone(timezone.utc)


def serialize_value(value):
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def serialize_event_row(row) -> dict:
    data = row.to_dict() if hasattr(row, "to_dict") else dict(row)
    return {key: serialize_value(value) for key, value in data.items()}


def event_session_windows(row) -> list[dict]:
    windows = []
    for index in range(1, 6):
        session_name = row.get(f"Session{index}")
        session_start = row.get(f"Session{index}DateUtc")
        if not session_name or session_start is None:
            continue
        start = ensure_utc(session_start)
        if start is None:
            continue

        next_start = None
        for next_index in range(index + 1, 6):
            candidate = row.get(f"Session{next_index}DateUtc")
            if candidate is not None:
                next_start = ensure_utc(candidate)
                break

        duration_hours = 4 if session_name in {"Race", "Sprint"} else 2
        end = next_start if next_start and next_start > start else start + timedelta(hours=duration_hours)
        windows.append({
            "name": session_name,
            "start": start,
            "end": end,
        })
    return windows


def build_free_context(
    has_fastf1: bool,
    fastf1_module,
    year: int | None = None,
) -> dict:
    yr = year or current_year()
    now = datetime.now(timezone.utc)

    context = {
        "year": yr,
        "now": now.isoformat(),
        "current_event": None,
        "current_session": None,
        "next_event": None,
        "last_event": None,
    }

    if not has_fastf1:
        return context

    try:
        schedule = fastf1_module.get_event_schedule(yr, include_testing=False)
    except Exception:
        return context

    serialized_rows = []
    for _, row in schedule.iterrows():
        serialized_rows.append(serialize_event_row(row))
        event_date = ensure_utc(row.get("EventDate"))
        first_session = None
        for index in range(1, 6):
            candidate = ensure_utc(row.get(f"Session{index}DateUtc"))
            if candidate is not None:
                first_session = candidate
                break
        event_end = event_date + timedelta(days=1) if event_date else None

        if event_end and event_end < now:
            context["last_event"] = serialize_event_row(row)

        if first_session and first_session > now and context["next_event"] is None:
            context["next_event"] = serialize_event_row(row)

        if first_session and event_end and first_session <= now <= event_end and context["current_event"] is None:
            context["current_event"] = serialize_event_row(row)

        for window in event_session_windows(row):
            if window["start"] <= now <= window["end"]:
                context["current_event"] = serialize_event_row(row)
                context["current_session"] = {
                    "session_name": window["name"],
                    "date_start": window["start"].isoformat(),
                    "date_end": window["end"].isoformat(),
                }
                break

        if context["current_event"]:
            break

    context["schedule"] = serialized_rows
    return context
