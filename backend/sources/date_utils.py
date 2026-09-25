"""
Shared date-window helpers.

The original package had NO code anywhere that actually computed "the
previous 16 days from today" — each `fetch_*` function just accepted a
`dates: list[date]` argument and trusted the caller to build it correctly.
That's the root bug behind "fetch the previous 16 days": there is no single
place that does it, so it's easy for a caller to pass `date.today()` as the
window's last day and get back mostly NaN / stale carried-forward values,
because almost none of these satellite L4 products are actually published
same-day.

This module fixes that by giving every source module (and any orchestrator
that calls them) one correct, reusable way to build the window.
"""

from __future__ import annotations

from datetime import date, timedelta

DEFAULT_WINDOW_DAYS = 16

# Typical end-to-end publication latency of each product, in days, i.e. how
# far behind "today" the most recent file for that product usually is. This
# is only used to pick a sensible *default* window when a source module is
# called on its own with no explicit `dates` — see the "IMPORTANT" note
# below. It is NOT applied inside fetch_all_channels, which always requests
# the same 16 calendar dates for every channel and lets each module's own
# nearest-available / carry-forward logic handle its own latency
# internally, so all 7 channels stay aligned on the same calendar days.
LATENCY_DAYS = {
    "sst": 1,       # OSTIA NRT L4 — published daily, ~1 day behind
    "ssh": 2,       # DUACS NRT L4 altimetry
    "wind": 1,      # CMEMS L4 NRT blended wind
    "currents": 2,  # OSCAR v2.0 NRT (Interim ~1mo, Final ~1yr — unusable here)
    "sss": 7,       # RSS SMAP L3 8-day running mean (~7 day latency)
}


def get_target_dates(
    days: int = DEFAULT_WINDOW_DAYS,
    *,
    latency_days: int = 1,
    end_date: date | None = None,
) -> list[date]:
    """
    Return `days` consecutive calendar dates, oldest first, ending
    `latency_days` before `end_date` (default: today).

    Example: `get_target_dates(16)` called on 2026-09-21 returns
    2026-09-05 .. 2026-09-20 (today itself is excluded by default, since
    "today" almost never has data yet for any of these products).
    """
    if days < 1:
        raise ValueError("days must be >= 1")
    anchor = (end_date or date.today()) - timedelta(days=latency_days)
    return [anchor - timedelta(days=offset) for offset in range(days - 1, -1, -1)]


def get_default_dates_for(
    source: str,
    days: int = DEFAULT_WINDOW_DAYS,
    end_date: date | None = None,
) -> list[date]:
    """
    Convenience wrapper for calling one source module standalone (e.g.
    `fetch_sst()` with no arguments): builds the previous `days` days,
    shifted back by that source's typical publication latency so the
    request doesn't waste a query on days that can't exist yet.

    IMPORTANT: do not use this to build the `dates` list passed to more than
    one source at once — different latencies mean different callers would
    get different calendar dates, and the resulting channels would no
    longer line up along the time axis. `fetch_all_channels` in
    sources/__init__.py builds one shared, unshifted `get_target_dates()`
    list and passes it to every source instead.
    """
    return get_target_dates(days, latency_days=LATENCY_DAYS.get(source, 0), end_date=end_date)
