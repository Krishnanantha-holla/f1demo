from backend.services import live_stream as ls


def test_compute_delay_base():
    # For retry_count=0, delay should be roughly around base_interval (8s) multiplied by jitter
    d = ls._compute_delay(retry_count=0, base_interval=8.0, max_interval=30.0)
    assert 8.0 * 0.7 <= d <= 8.0 * 1.3


def test_compute_delay_backoff_increases():
    d0 = ls._compute_delay(retry_count=0, base_interval=2.0, max_interval=30.0)
    d1 = ls._compute_delay(retry_count=1, base_interval=2.0, max_interval=30.0)
    d2 = ls._compute_delay(retry_count=4, base_interval=2.0, max_interval=30.0)
    assert d1 >= d0 * 0.6  # allow jitter influence
    assert d2 >= d1
