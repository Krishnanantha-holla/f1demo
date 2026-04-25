"""Shared HTTP response cache: in-process memory plus optional Redis (REDIS_URL)."""
from __future__ import annotations

import json
import logging
import os
import time
from typing import Any

logger = logging.getLogger("f1dashboard.cache")

_MEMORY: dict[str, dict] = {}
_REDIS = None


def _redis_client():
    global _REDIS
    url = (os.getenv("REDIS_URL") or "").strip()
    if not url:
        return None
    if _REDIS is None:
        import redis

        _REDIS = redis.from_url(url, decode_responses=True)
    return _REDIS


def cache_lookup(key: str, ttl: float) -> tuple[Any | None, bool]:
    """Return (data, hit). `ttl` is freshness window in seconds."""
    now = time.time()
    ent = _MEMORY.get(key)
    if ent is not None and now - ent["ts"] < ttl:
        return ent["data"], True

    r = _redis_client()
    if not r:
        return None, False
    try:
        raw = r.get(f"f1cache:{key}")
        if not raw:
            return None, False
        ent = json.loads(raw)
        if now - ent["ts"] >= ttl:
            return None, False
        _MEMORY[key] = ent
        return ent["data"], True
    except Exception as exc:
        logger.warning("redis cache read failed: %s", exc)
        return None, False


def cache_write(key: str, data: Any, ttl_seconds: int) -> None:
    now = time.time()
    ent = {"data": data, "ts": now}
    _MEMORY[key] = ent
    r = _redis_client()
    if not r:
        return
    try:
        ex = max(int(ttl_seconds), 30)
        r.setex(f"f1cache:{key}", ex, json.dumps(ent, default=str))
    except Exception as exc:
        logger.warning("redis cache write failed: %s", exc)


def cache_clear() -> None:
    _MEMORY.clear()
    r = _redis_client()
    if not r:
        return
    try:
        for k in r.scan_iter(match="f1cache:*"):
            r.delete(k)
    except Exception as exc:
        logger.warning("redis cache clear failed: %s", exc)


def cache_backend_name() -> str:
    return "redis" if _redis_client() else "memory"
