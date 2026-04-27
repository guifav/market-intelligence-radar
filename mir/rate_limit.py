"""Thread-safe rate limiting helpers."""

from __future__ import annotations

import threading
import time
from typing import Callable


class ThreadSafeIntervalLimiter:
    """Reserve request slots under a lock, then sleep outside it.

    This prevents concurrent callers from waking up at the same instant and
    violating the minimum interval when multiple threads are active.
    """

    def __init__(
        self,
        min_interval: float,
        clock: Callable[[], float] | None = None,
        sleeper: Callable[[float], None] | None = None,
    ) -> None:
        self.min_interval = float(min_interval)
        self._clock = clock or time.monotonic
        self._sleep = sleeper or time.sleep
        self._lock = threading.Lock()
        self._next_allowed_at = 0.0

    def wait(self) -> None:
        with self._lock:
            now = self._clock()
            scheduled_at = max(now, self._next_allowed_at)
            self._next_allowed_at = scheduled_at + self.min_interval
            wait_for = scheduled_at - now

        if wait_for > 0:
            self._sleep(wait_for)
