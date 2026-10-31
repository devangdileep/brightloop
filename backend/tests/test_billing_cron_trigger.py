import json
import pytest
from app.tasks.trigger_billing import run_trigger


def test_trigger_billing_missing_backend_url(monkeypatch):
    monkeypatch.delenv("BACKEND_URL", raising=False)
    exit_code = run_trigger()
    assert exit_code == 1


def test_trigger_billing_success(monkeypatch):
    monkeypatch.setenv("BACKEND_URL", "brightloop-backend.onrender.com")
    monkeypatch.setenv("BILLING_CRON_SECRET", "super-secret-cron-token")

    captured_requests = []

    class MockResponse:
        status_code = 200
        text = '{"ok": true, "created": 3, "skipped": 1, "failed": 0}'

        def json(self):
            return {"ok": True, "created": 3, "skipped": 1, "failed": 0}

    class MockClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_val, exc_tb):
            pass

        def post(self, url, headers=None, **kwargs):
            captured_requests.append({"url": url, "headers": headers})
            return MockResponse()

    monkeypatch.setattr("httpx.Client", MockClient)

    exit_code = run_trigger()
    assert exit_code == 0
    assert len(captured_requests) == 1
    req = captured_requests[0]
    # Verify URL is automatically prefixed with https://
    assert req["url"] == "https://brightloop-backend.onrender.com/api/v1/billing/run"
    assert req["headers"]["Authorization"] == "Bearer super-secret-cron-token"


def test_trigger_billing_http_failure(monkeypatch):
    monkeypatch.setenv("BACKEND_URL", "https://api.brightloop.io")
    monkeypatch.setenv("BILLING_CRON_SECRET", "token")

    class MockErrorResponse:
        status_code = 500
        text = '{"detail": "Database connection error"}'

        def json(self):
            return {"detail": "Database connection error"}

    class MockClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_val, exc_tb):
            pass

        def post(self, url, headers=None, **kwargs):
            return MockErrorResponse()

    monkeypatch.setattr("httpx.Client", MockClient)

    exit_code = run_trigger()
    assert exit_code == 1


def test_trigger_billing_result_not_ok(monkeypatch):
    monkeypatch.setenv("BACKEND_URL", "https://api.brightloop.io")

    class MockResponse:
        status_code = 200
        text = '{"ok": false, "created": 0, "failed": 2, "errors": ["Subscription failed"]}'

        def json(self):
            return {"ok": False, "created": 0, "failed": 2, "errors": ["Subscription failed"]}

    class MockClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_val, exc_tb):
            pass

        def post(self, url, headers=None, **kwargs):
            return MockResponse()

    monkeypatch.setattr("httpx.Client", MockClient)

    exit_code = run_trigger()
    assert exit_code == 1
