"""Tests for the news service: feed fetching, ordering, and dedup behavior."""
import asyncio
import sys
import types
from pathlib import Path

# Make `backend/` importable as a top-level package, matching test_api.py's pattern.
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest  # noqa: E402

from services import news_service  # noqa: E402


class _DummyResponse:
    def __init__(self, status_code=200, content=b"<rss/>"):
        self.status_code = status_code
        self.content = content


class _DummyAsyncClient:
    """Stand-in for httpx.AsyncClient that always returns 200 with empty RSS bytes.

    Real RSS parsing is mocked at the feedparser layer below.
    """

    def __init__(self, *_, **__):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url):
        return _DummyResponse()


def _silent_logger():
    return types.SimpleNamespace(
        warning=lambda *a, **kw: None,
        error=lambda *a, **kw: None,
        info=lambda *a, **kw: None,
    )


def _entry(title, link, published):
    """Build a feedparser-like entry with attribute access (not dict)."""
    e = types.SimpleNamespace()
    e.title = title
    e.link = link
    e.published = published
    e.summary = title  # any string is fine
    return e


def test_fetch_news_dedupes_by_title_case_insensitive(monkeypatch):
    """Titles that differ only in case must be deduped; oldest copy is dropped."""
    # Reduce sources to one to make the test deterministic and fast.
    monkeypatch.setattr(news_service, "SOURCES", [{"url": "x", "source": "Test"}])
    monkeypatch.setattr(news_service, "httpx",
                        types.SimpleNamespace(AsyncClient=_DummyAsyncClient))

    # feedparser is imported lazily inside fetch_news; pre-import and patch it.
    import feedparser
    fake_feed = types.SimpleNamespace(entries=[
        _entry("Hamilton wins!",  "https://a", "Mon, 19 May 2026 10:00:00 +0000"),
        _entry("HAMILTON WINS!",  "https://b", "Mon, 19 May 2026 11:00:00 +0000"),
        _entry("Verstappen P2",   "https://c", "Mon, 19 May 2026 12:00:00 +0000"),
    ])
    monkeypatch.setattr(feedparser, "parse", lambda _content: fake_feed)

    cache = {}
    def cache_lookup(key, ttl):
        return cache.get(key), key in cache
    def cache_write(key, value, ttl):
        cache[key] = value

    items = asyncio.run(news_service.fetch_news(cache_lookup, cache_write, _silent_logger()))

    titles = [it["title"] for it in items]
    titles_lower = [t.lower() for t in titles]

    # Dedup: only one of the two "hamilton wins!" survives.
    assert titles_lower.count("hamilton wins!") == 1
    assert "verstappen p2" in titles_lower

    # Ranking: most recent first. Verstappen P2 is the latest, so it leads.
    assert titles[0].lower() == "verstappen p2"


def test_fetch_news_returns_cached_when_hit(monkeypatch):
    """If cache reports a hit, the network path is skipped entirely."""
    sentinel = [{"title": "From cache", "link": "x", "published": "", "source": "T",
                 "image": None, "summary": ""}]

    def cache_lookup(key, ttl):
        return sentinel, True

    def cache_write(*_args, **_kw):  # pragma: no cover — must not run
        raise AssertionError("cache_write should not be called on cache hit")

    # Sources should never be touched on a hit, but make them empty just in case.
    monkeypatch.setattr(news_service, "SOURCES", [])

    items = asyncio.run(news_service.fetch_news(cache_lookup, cache_write, _silent_logger()))
    assert items is sentinel
