"""Tests for the LTTB downsampling helper."""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from services.downsample import lttb, lttb_records  # noqa: E402


def test_lttb_returns_input_when_threshold_geq_length():
    data = [(0.0, 0.0), (1.0, 1.0), (2.0, 2.0)]
    assert lttb(data, 5) == data
    assert lttb(data, 3) == data


def test_lttb_returns_input_when_threshold_too_small():
    data = [(i, i) for i in range(10)]
    assert lttb(data, 0) == data
    assert lttb(data, 1) == data
    assert lttb(data, 2) == data


def test_lttb_caps_output_length():
    data = [(float(i), math.sin(i * 0.1)) for i in range(1000)]
    out = lttb(data, 100)
    assert len(out) == 100


def test_lttb_preserves_endpoints():
    data = [(float(i), float(i) * 2) for i in range(500)]
    out = lttb(data, 50)
    assert out[0] == data[0]
    assert out[-1] == data[-1]


def test_lttb_preserves_monotonicity_on_x():
    data = [(float(i), math.sin(i * 0.05) * 100) for i in range(2000)]
    out = lttb(data, 200)
    xs = [p[0] for p in out]
    assert xs == sorted(xs)


def test_lttb_records_caps_and_preserves_payload():
    records = [
        {"TimeSeconds": float(i), "Speed": math.sin(i * 0.05) * 250, "Throttle": i % 100}
        for i in range(3000)
    ]
    out = lttb_records(records, "TimeSeconds", "Speed", 500)
    assert len(out) <= 500
    # Payload preserved for surviving records (non-x/y fields kept verbatim).
    sample = out[0]
    assert "Throttle" in sample
    # Record order preserved
    times = [r["TimeSeconds"] for r in out]
    assert times == sorted(times)


def test_lttb_records_passthrough_when_under_threshold():
    records = [{"TimeSeconds": float(i), "Speed": float(i)} for i in range(50)]
    out = lttb_records(records, "TimeSeconds", "Speed", 100)
    assert out == records


def test_lttb_records_handles_empty():
    assert lttb_records([], "x", "y", 100) == []
