"""
Sources package — one module per data provider.

FIX — no orchestration / no shared date window
------------------------------------------------
None of the original modules ever computed a date range themselves, and
there was nothing in this package that called all five of them together on
the *same* set of calendar dates. Each `fetch_*` function now defaults to a
sensible 16-day window on its own (see date_utils.py) when called alone,
and `fetch_all_channels` below is the single entry point that fetches all
five sources concurrently on one shared list of calendar dates, so the
returned channels line up along the time axis regardless of how latent any
individual product is.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import date

import numpy as np

from .cmems_sst import fetch_sst
from .cmems_ssh import fetch_ssh
from .cmems_winds import fetch_winds
from .oscar_currents import fetch_currents
from .smap_sss import fetch_sss
from .date_utils import DEFAULT_WINDOW_DAYS, get_default_dates_for, get_target_dates

logger = logging.getLogger(__name__)

__all__ = [
    "fetch_sst",
    "fetch_ssh",
    "fetch_winds",
    "fetch_currents",
    "fetch_sss",
    "fetch_all_channels",
    "get_target_dates",
    "get_default_dates_for",
    "DEFAULT_WINDOW_DAYS",
]

# Channel order the model expects.
CHANNEL_NAMES = ("sst", "sss", "ssh", "u_current", "v_current", "u_wind", "v_wind")


async def fetch_all_channels(
    dates: list[date] | None = None,
    cmems_username: str | None = None,
    cmems_password: str | None = None,
) -> np.ndarray:
    """
    Fetch every channel concurrently on ONE shared set of calendar dates.

    Parameters
    ----------
    dates : if omitted, defaults to the previous 16 calendar days from today
        (today itself excluded, since none of these products publish
        same-day). Every channel is fetched for these exact calendar dates —
        each source handles its own publication latency internally (nearest
        -available-within-tolerance + carry-forward for the CMEMS products,
        most-recent-granule-at-or-before-date for SMAP/OSCAR), so the
        channels stay aligned along the time axis no matter how latent any
        individual product is. Do NOT build per-source, latency-shifted
        date lists here — that would give each channel a different set of
        calendar dates and silently misalign the stack below.
    cmems_username, cmems_password : optional; fall back to the
        CMEMS_USERNAME / CMEMS_PASSWORD env vars if not given.

    Returns
    -------
    (T, 7, 101, 241) float32 array, channel order = CHANNEL_NAMES:
    SST, SSS, SSH, U-current, V-current, U-wind, V-wind.
    """
    dates = dates if dates is not None else get_target_dates(DEFAULT_WINDOW_DAYS)
    logger.info("fetch_all_channels: fetching %s -> %s for all sources", dates[0], dates[-1])

    sst, ssh, (u_wind, v_wind), (u_cur, v_cur), sss = await asyncio.gather(
        fetch_sst(dates, cmems_username, cmems_password),
        fetch_ssh(dates, cmems_username, cmems_password),
        fetch_winds(dates, cmems_username, cmems_password),
        fetch_currents(dates),
        fetch_sss(dates),
    )

    stacked = np.stack([sst, sss, ssh, u_cur, v_cur, u_wind, v_wind], axis=1)
    logger.info("fetch_all_channels: done, shape=%s", stacked.shape)
    return stacked


if __name__ == "__main__":
    import os

    logging.basicConfig(level=logging.INFO)
    data = asyncio.run(
        fetch_all_channels(
            cmems_username=os.environ.get("CMEMS_USERNAME"),
            cmems_password=os.environ.get("CMEMS_PASSWORD"),
        )
    )
    print("All channels shape:", data.shape)
    for i, name in enumerate(CHANNEL_NAMES):
        print(f"  {name:10s} NaN fraction: {float(np.isnan(data[:, i]).mean()):.3f}")
