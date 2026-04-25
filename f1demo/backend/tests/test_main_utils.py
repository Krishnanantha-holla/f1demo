from datetime import datetime, timezone

import httpx

import main


def test_ensure_utc_with_naive_datetime():
    naive = datetime(2026, 3, 8, 6, 0, 0)
    out = main._ensure_utc(naive)
    assert out.tzinfo == timezone.utc


def test_event_session_windows_builds_ordered_windows():
    row = {
        "Session1": "Practice 1",
        "Session1DateUtc": datetime(2026, 3, 6, 1, 30),
        "Session2": "Practice 2",
        "Session2DateUtc": datetime(2026, 3, 6, 5, 0),
        "Session3": "Qualifying",
        "Session3DateUtc": datetime(2026, 3, 7, 5, 0),
    }

    windows = main._event_session_windows(row)
    assert [w["name"] for w in windows] == ["Practice 1", "Practice 2", "Qualifying"]
    assert windows[0]["start"] < windows[0]["end"]
    assert windows[0]["end"] == windows[1]["start"]


def test_openf1_json_tail_for_list_and_single_payload():
    list_resp = httpx.Response(200, json=[1, 2, 3, 4])
    one_resp = httpx.Response(200, json={"a": 1})
    bad_resp = httpx.Response(500, json={"error": "upstream"})

    assert main._openf1_json_tail(list_resp, 2) == [3, 4]
    assert main._openf1_json_tail(one_resp, 3) == [{"a": 1}]
    assert main._openf1_json_tail(bad_resp, 3) == []
