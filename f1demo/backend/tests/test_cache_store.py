import importlib


def load_cache_store():
    module = importlib.import_module("cache_store")
    return importlib.reload(module)


def test_memory_cache_hit_and_expiry(monkeypatch):
    monkeypatch.delenv("REDIS_URL", raising=False)
    cache_store = load_cache_store()

    key = "unit:test:key"
    cache_store.cache_write(key, {"value": 42}, ttl_seconds=60)

    data, hit = cache_store.cache_lookup(key, ttl=60)
    assert hit is True
    assert data == {"value": 42}

    data, hit = cache_store.cache_lookup(key, ttl=0)
    assert hit is False
    assert data is None


def test_cache_clear_memory(monkeypatch):
    monkeypatch.delenv("REDIS_URL", raising=False)
    cache_store = load_cache_store()

    cache_store.cache_write("a", {"x": 1}, ttl_seconds=60)
    cache_store.cache_write("b", {"x": 2}, ttl_seconds=60)
    cache_store.cache_clear()

    for key in ("a", "b"):
        data, hit = cache_store.cache_lookup(key, ttl=60)
        assert hit is False
        assert data is None


def test_cache_backend_name_defaults_to_memory(monkeypatch):
    monkeypatch.delenv("REDIS_URL", raising=False)
    cache_store = load_cache_store()
    assert cache_store.cache_backend_name() == "memory"
