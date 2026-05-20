import types
import builtins

import pytest

from backend import automator


class DummyResp:
    def __init__(self, status_code=200, text=""):
        self.status_code = status_code
        self.text = text


def test_trigger_refresh_success(monkeypatch, capsys):
    def fake_post(url, headers=None, timeout=None):
        assert url.endswith("/internal/refresh-cache")
        assert "X-Internal-Secret" in (headers or {})
        return DummyResp(200, "ok")

    monkeypatch.setattr(automator, "requests", types.SimpleNamespace(post=fake_post))
    automator.trigger_refresh()
    captured = capsys.readouterr()
    assert "refresh-cache succeeded" in captured.out


def test_trigger_refresh_forbidden(monkeypatch, capsys):
    def fake_post(url, headers=None, timeout=None):
        return DummyResp(403, "forbidden")

    monkeypatch.setattr(automator, "requests", types.SimpleNamespace(post=fake_post))
    automator.trigger_refresh()
    captured = capsys.readouterr()
    assert "refresh-cache response: 403" in captured.out


def test_trigger_refresh_exception(monkeypatch, capsys):
    def fake_post(url, headers=None, timeout=None):
        raise RuntimeError("conn refused")

    monkeypatch.setattr(automator, "requests", types.SimpleNamespace(post=fake_post))
    automator.trigger_refresh()
    captured = capsys.readouterr()
    assert "refresh-cache request failed" in captured.out
