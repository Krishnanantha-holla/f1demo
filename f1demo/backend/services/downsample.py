"""Largest-Triangle-Three-Buckets (LTTB) time-series downsampling.

LTTB selects ``threshold`` points from a longer series while preserving the
visual shape of the trace — endpoints are kept, and inside each bucket the
point that forms the largest triangle with the previous selected point and
the next bucket's average is chosen.

Reference: Steinarsson, Sveinn (2013), "Downsampling Time Series for
Visual Representation."
"""

from __future__ import annotations

import math
from typing import Sequence


def lttb(data: Sequence[tuple[float, float]], threshold: int) -> list[tuple[float, float]]:
    """Reduce ``data`` (list of ``(x, y)`` tuples) to at most ``threshold`` points.

    - When ``threshold >= len(data)`` or ``threshold <= 2``, the input is
      returned unchanged (as a list).
    - Endpoints are always preserved.
    - Output length is exactly ``threshold`` for non-trivial inputs.
    """
    n = len(data)
    if threshold >= n or threshold <= 2:
        return list(data)

    every = (n - 2) / (threshold - 2)
    sampled: list[tuple[float, float]] = [data[0]]
    a = 0  # index of the previously selected point

    for i in range(threshold - 2):
        # Average for the next bucket (used as the third triangle vertex).
        avg_range_start = int(math.floor((i + 1) * every) + 1)
        avg_range_end = min(int(math.floor((i + 2) * every) + 1), n)
        bucket_size = max(1, avg_range_end - avg_range_start)
        avg_x = sum(p[0] for p in data[avg_range_start:avg_range_end]) / bucket_size
        avg_y = sum(p[1] for p in data[avg_range_start:avg_range_end]) / bucket_size

        # Current bucket: search for the point that maximises triangle area.
        range_offs = int(math.floor(i * every) + 1)
        range_to = int(math.floor((i + 1) * every) + 1)
        ax, ay = data[a]
        max_area = -1.0
        next_a = range_offs
        for j in range(range_offs, range_to):
            x, y = data[j]
            area = abs((ax - avg_x) * (y - ay) - (ax - x) * (avg_y - ay)) * 0.5
            if area > max_area:
                max_area = area
                next_a = j

        sampled.append(data[next_a])
        a = next_a

    sampled.append(data[-1])
    return sampled


def lttb_records(
    records: list[dict], x_key: str, y_key: str, threshold: int
) -> list[dict]:
    """Downsample a list of dict ``records`` keyed by ``x_key`` and ``y_key``.

    Returns the subset of ``records`` whose ``(x, y)`` projection survives LTTB,
    preserving original record order and full payload.
    """
    if threshold >= len(records) or threshold <= 2 or len(records) == 0:
        return list(records)

    indexed: list[tuple[float, float, int]] = []
    for idx, rec in enumerate(records):
        try:
            xv = float(rec[x_key])
            yv = float(rec[y_key])
        except (KeyError, TypeError, ValueError):
            continue
        indexed.append((xv, yv, idx))
    if len(indexed) <= threshold:
        return list(records)

    pairs = [(xv, yv) for xv, yv, _ in indexed]
    chosen = lttb(pairs, threshold)
    chosen_set = {(p[0], p[1]) for p in chosen}
    keep_indices = sorted({idx for xv, yv, idx in indexed if (xv, yv) in chosen_set})
    return [records[i] for i in keep_indices]
