"""Tests for new analytics endpoints: head-to-head, driver-stats, race-pace,
pit-stops, pu-elements, results/archive, track-dna, consistency, live-track-map."""

import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("INTERNAL_SECRET", "test-secret")
os.environ.setdefault("ALLOWED_ORIGINS", "http://localhost:5173")

from main import app

client = TestClient(app)


# ── Head-to-Head ──

MOCK_RACE_DATA = {
    "MRData": {"RaceTable": {"Races": [
        {"round": "1", "raceName": "Test GP", "Results": [
            {"Driver": {"code": "VER", "givenName": "Max", "familyName": "Verstappen", "driverId": "max_verstappen"}, "Constructor": {"name": "Red Bull"}, "position": "1", "points": "25", "grid": "1", "laps": "57", "status": "Finished", "Time": {"time": "1:30:00.000"}, "FastestLap": {"rank": "1"}},
            {"Driver": {"code": "HAM", "givenName": "Lewis", "familyName": "Hamilton", "driverId": "hamilton"}, "Constructor": {"name": "Mercedes"}, "position": "2", "points": "18", "grid": "3", "laps": "57", "status": "Finished", "Time": {"time": "+5.123"}, "FastestLap": {"rank": "2"}},
        ]}
    ]}}
}

MOCK_QUAL_DATA = {
    "MRData": {"RaceTable": {"Races": [
        {"round": "1", "QualifyingResults": [
            {"Driver": {"code": "VER", "givenName": "Max", "familyName": "Verstappen"}, "Constructor": {"name": "Red Bull"}, "position": "1", "Q1": "1:30.0", "Q2": "1:29.5", "Q3": "1:29.0"},
            {"Driver": {"code": "HAM", "givenName": "Lewis", "familyName": "Hamilton"}, "Constructor": {"name": "Mercedes"}, "position": "3", "Q1": "1:30.5", "Q2": "1:30.0", "Q3": "1:29.5"},
        ]}
    ]}}
}


@patch("routes.head_to_head.cached_get", new_callable=AsyncMock)
def test_head_to_head(mock_get):
    mock_get.side_effect = [MOCK_RACE_DATA, MOCK_QUAL_DATA]
    resp = client.get("/api/head-to-head?driver1=VER&driver2=HAM&year=2025")
    assert resp.status_code == 200
    data = resp.json()
    assert data["driver1"]["code"] == "VER"
    assert data["driver2"]["code"] == "HAM"
    assert data["driver1"]["wins"] == 1
    assert data["driver1"]["points"] == 25
    assert len(data["races"]) == 1


def test_head_to_head_invalid_code():
    resp = client.get("/api/head-to-head?driver1=XX&driver2=HAM&year=2025")
    assert resp.status_code == 400


# ── Driver Stats ──

MOCK_DRIVER_RESULTS = {
    "MRData": {"RaceTable": {"Races": [
        {"round": "1", "Results": [
            {"Driver": {"code": "VER"}, "Constructor": {"name": "Red Bull"}, "position": "1", "points": "25", "grid": "1", "laps": "57", "status": "Finished", "FastestLap": {"rank": "1"}}
        ]}
    ]}}
}

MOCK_DRIVER_QUAL = {
    "MRData": {"RaceTable": {"Races": [
        {"round": "1", "QualifyingResults": [
            {"Driver": {"code": "VER"}, "position": "1"}
        ]}
    ]}}
}

MOCK_STANDINGS = {
    "MRData": {"StandingsTable": {"StandingsLists": [
        {"DriverStandings": [{"Driver": {"code": "VER"}, "position": "1", "points": "25"}]}
    ]}}
}


@patch("routes.driver_stats.cached_get", new_callable=AsyncMock)
def test_driver_stats(mock_get):
    mock_get.side_effect = [MOCK_DRIVER_RESULTS, MOCK_DRIVER_QUAL, MOCK_STANDINGS]
    resp = client.get("/api/driver-stats?driver=VER&year=2025")
    assert resp.status_code == 200
    data = resp.json()
    assert data["driver"] == "VER"
    assert data["wins"] == 1
    assert data["total_points"] == 25


# ── Consistency ──

@patch("routes.consistency.cached_get", new_callable=AsyncMock)
def test_consistency(mock_get):
    mock_get.return_value = MOCK_RACE_DATA
    resp = client.get("/api/consistency?year=2025")
    assert resp.status_code == 200
    data = resp.json()
    assert "drivers" in data
    assert data["total_races"] == 1


# ── PU Elements ──

@patch("routes.pu_tracker.cached_get", new_callable=AsyncMock)
def test_pu_elements(mock_get):
    mock_get.return_value = {"MRData": {"RaceTable": {"Races": [{"round": "1"}, {"round": "2"}]}}}
    resp = client.get("/api/pu-elements?year=2025")
    assert resp.status_code == 200
    data = resp.json()
    assert "allocations" in data
    assert "drivers" in data
    assert data["races_completed"] == 2


# ── Results Archive ──

@patch("routes.results.cached_get", new_callable=AsyncMock)
def test_results_archive_race(mock_get):
    mock_get.return_value = MOCK_RACE_DATA
    resp = client.get("/api/results/archive?year=2025&round=1&session=R")
    assert resp.status_code == 200
    data = resp.json()
    assert data["session"] == "R"
    assert len(data["classifications"]) == 2


@patch("routes.results.cached_get", new_callable=AsyncMock)
def test_results_archive_qualifying(mock_get):
    mock_get.return_value = MOCK_QUAL_DATA
    resp = client.get("/api/results/archive?year=2025&round=1&session=Q")
    assert resp.status_code == 200
    data = resp.json()
    assert data["session"] == "Q"


# ── Track DNA ──

def test_track_dna_valid():
    resp = client.get("/api/track-dna?circuit_id=bahrain")
    assert resp.status_code == 200
    data = resp.json()
    assert data["circuit_id"] == "bahrain"
    assert "corners" in data
    assert "drs_zones" in data


def test_track_dna_invalid():
    resp = client.get("/api/track-dna?circuit_id=nonexistent")
    assert resp.status_code == 404


# ── Pit Stops ──

MOCK_PIT_DATA = {
    "MRData": {"RaceTable": {"Races": [
        {"round": "1", "raceName": "Test GP", "PitStops": [
            {"driverId": "max_verstappen", "lap": "18", "stop": "1", "duration": "23.5"},
            {"driverId": "hamilton", "lap": "20", "stop": "1", "duration": "24.1"},
        ]}
    ]}}
}

MOCK_RESULTS_FOR_PITS = {
    "MRData": {"RaceTable": {"Races": [
        {"Results": [
            {"Driver": {"familyName": "Verstappen", "driverId": "max_verstappen"}, "Constructor": {"name": "Red Bull"}},
            {"Driver": {"familyName": "Hamilton", "driverId": "hamilton"}, "Constructor": {"name": "Mercedes"}},
        ]}
    ]}}
}


@patch("routes.pit_stops.safe_cached_get", new_callable=AsyncMock)
@patch("routes.pit_stops.cached_get", new_callable=AsyncMock)
def test_pit_stops(mock_cached_get, mock_safe_cached_get):
    mock_cached_get.return_value = MOCK_PIT_DATA
    mock_safe_cached_get.return_value = MOCK_RESULTS_FOR_PITS
    resp = client.get("/api/pit-stops?year=2025&round=1")
    assert resp.status_code == 200
    data = resp.json()
    assert "pit_stops" in data
    assert len(data["pit_stops"]) == 2


# ── Live Track Map ──

@patch("routes.live_track_map.safe_cached_get", new_callable=AsyncMock)
def test_live_track_map(mock_get):
    mock_get.side_effect = [
        [{"driver_number": 1, "x": 10, "y": 20, "date": "2025-01-01T00:00:00Z"}],
        [{"driver_number": 1, "name_acronym": "VER", "team_colour": "3671C6"}],
    ]
    resp = client.get("/api/live-track-map?session_key=latest")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["positions"]) == 1
    assert data["positions"][0]["name_acronym"] == "VER"
