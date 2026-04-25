from __future__ import annotations

import asyncio
import email.utils
import logging

import dateutil.parser
import httpx


SOURCES = [
    {"url": "https://www.autosport.com/rss/feed/f1", "source": "Autosport"},
    {"url": "https://www.motorsport.com/rss/f1/news/", "source": "Motorsport.com"},
    {"url": "https://www.racefans.net/feed/", "source": "RaceFans"},
    {"url": "https://www.planetf1.com/feed", "source": "PlanetF1"},
    {"url": "https://www.crash.net/rss/f1", "source": "Crash.net"},
    {"url": "https://www.gpfans.com/en/rss.xml", "source": "GPFans"},
    {"url": "https://www.skysports.com/rss/12821", "source": "Sky Sports F1"},
    {"url": "https://feeds.bbci.co.uk/sport/formula1/rss.xml", "source": "BBC Sport F1"},
    {"url": "https://www.formula1.com/content/fom-website/en/latest/all.xml", "source": "Formula1.com"},
]


def _parse_date(date_str: str) -> float:
    if not date_str:
        return 0
    try:
        parsed = email.utils.parsedate_tz(date_str)
        if parsed:
            return float(email.utils.mktime_tz(parsed))
    except Exception:
        pass
    try:
        return float(dateutil.parser.parse(date_str).timestamp())
    except Exception:
        return 0


def _extract_image(entry):
    if hasattr(entry, "media_content") and len(entry.media_content) > 0:
        return entry.media_content[0].get("url")
    if hasattr(entry, "media_thumbnail") and len(entry.media_thumbnail) > 0:
        return entry.media_thumbnail[0].get("url")
    if hasattr(entry, "enclosures") and len(entry.enclosures) > 0:
        enc = entry.enclosures[0]
        if hasattr(enc, "type") and "image" in enc.type:
            return enc.href
    return None


def _extract_summary(entry):
    if hasattr(entry, "summary"):
        return entry.summary
    if hasattr(entry, "description"):
        return entry.description
    return ""


def _extract_published(entry):
    if hasattr(entry, "published"):
        return entry.published
    if hasattr(entry, "updated"):
        return entry.updated
    return ""


async def fetch_news(cache_lookup, cache_write, logger: logging.Logger):
    try:
        import feedparser
    except ImportError:
        logger.error("feedparser not installed")
        return []

    cache_key = "news_feed_v2"
    cached_news, hit = cache_lookup(cache_key, 900)
    if hit:
        return cached_news

    articles = []

    async def fetch_feed(source):
        try:
            async with httpx.AsyncClient(
                timeout=12.0,
                follow_redirects=True,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/121.0.0.0 Safari/537.36"
                    ),
                    "Accept": "application/rss+xml, application/xml, text/xml, */*",
                },
            ) as client:
                resp = await client.get(source["url"])
                if resp.status_code != 200:
                    logger.warning("Feed %s returned %s", source["source"], resp.status_code)
                    return

                feed = feedparser.parse(resp.content)
                for entry in feed.entries[:10]:
                    summary = _extract_summary(entry)
                    articles.append({
                        "title": entry.title if hasattr(entry, "title") else "Untitled",
                        "link": entry.link if hasattr(entry, "link") else "",
                        "published": _extract_published(entry),
                        "source": source["source"],
                        "image": _extract_image(entry),
                        "summary": summary[:300] if summary else "",
                    })

                logger.info("Fetched %d articles from %s", len(feed.entries[:10]), source["source"])
        except Exception as exc:
            logger.warning("Failed to fetch feed %s: %s", source["source"], exc)

    await asyncio.gather(*(fetch_feed(source) for source in SOURCES))

    if not articles:
        logger.warning("No articles fetched from any source")
        return []

    articles.sort(key=lambda article: _parse_date(article.get("published", "")), reverse=True)

    seen_titles = set()
    unique_articles = []
    for article in articles:
        title_lower = article["title"].lower()
        if title_lower in seen_titles:
            continue
        seen_titles.add(title_lower)
        unique_articles.append(article)

    logger.info("Returning %d unique articles", len(unique_articles))
    out = unique_articles[:50]
    cache_write(cache_key, out, 900)
    return out
