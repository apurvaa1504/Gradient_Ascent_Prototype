"""
Channels 3 & 4 — Surface Current U/V components from NASA OSCAR v2.0, via
NASA Earthdata / PO.DAAC.

Variables : u, v — total surface current (m/s), daily, 0.25 deg grid.
Auth      : NASA Earthdata Login via `earthaccess` (see smap_sss.py for the
            credential options — same mechanism, same account).

FIX — wrong OSCAR product/version for "last 16 days"
------------------------------------------------------
The product page usually linked for this (OSCAR_L4_OC_FINAL_V2.0) is the
"Final" quality level. Per PO.DAAC/ESR's own documentation, OSCAR v2.0's
three quality levels have very different latencies:

    Final    ~1 YEAR behind real time
    Interim  ~1 month behind real time
    NRT      ~2 days behind real time

"Final" cannot supply any part of a 16-day window at all, and "Interim"
still can't reach most of it. This module always requests
OSCAR_L4_OC_NRT_V2.0, falling back to OSCAR_L4_OC_INTERIM_V2.0 per-day only
in case NRT hasn't backfilled a particular day yet (harmless — Interim data
for a day NRT is missing is still better than nothing).

FIX — using a deprecated, coarser, 5-day-composite product
------------------------------------------------------------
The previous version pulled OSCAR v1 (1/3 deg, 5-day composites, discontinued
in favour of v2.0) from a legacy NOAA CoastWatch ERDDAP mirror
(`jplOscar.nc`), then hand-interpolated the 5-day composites to daily values.
OSCAR v2.0 is natively daily, so all of that interpolation machinery is
unnecessary — each target date maps directly to one file — and fetching it
from PO.DAAC (as the given product link does) rather than a third-party
ERDDAP mirror is both more current and more reliable.

FIX — silently returning zero-current instead of missing on failure
------------------------------------------------------------------------
The previous version returned all-zero arrays (a physically meaningful
"no current" value) whenever the whole ERDDAP request failed, which is
indistinguishable from real data downstream. This version returns NaN
instead, consistent with how every other channel represents "missing".
"""

from __future__ import annotations

import asyncio
import logging
from datetime import date

import numpy as np

from .date_utils import get_default_dates_for
from regridder import LAT_MAX, LAT_MIN, LON_MAX, LON_MIN, regrid_to_master

logger = logging.getLogger(__name__)

# Tried in order for each day: NRT first (the only quality level that can
# actually reach "the last 16 days"), Interim only as a same-day backfill
# fallback.
SHORT_NAMES = ["OSCAR_L4_OC_NRT_V2.0", "OSCAR_L4_OC_INTERIM_V2.0"]


def _open_granule(granule):
    import earthaccess
    import xarray as xr

    files = earthaccess.open([granule])
    try:
        return xr.open_dataset(files[0])
    except Exception:
        return xr.open_dataset(files[0], engine="h5netcdf")


def _fetch_one_day(d: date) -> tuple[np.ndarray, np.ndarray] | None:
    import earthaccess

    for short_name in SHORT_NAMES:
        try:
            granules = earthaccess.search_data(short_name=short_name, temporal=(d.isoformat(), d.isoformat()))
        except Exception as exc:
            logger.debug("OSCAR: search failed for %s on %s: %s", short_name, d, exc)
            continue
        if not granules:
            continue

        try:
            ds = _open_granule(granules[0])
        except Exception as exc:
            logger.debug("OSCAR: failed to open %s granule for %s: %s", short_name, d, exc)
            continue

        try:
            u = np.asarray(ds["u"]).squeeze().astype(np.float32)
            v = np.asarray(ds["v"]).squeeze().astype(np.float32)
            lat_name = "lat" if "lat" in ds.coords else "latitude"
            lon_name = "lon" if "lon" in ds.coords else "longitude"
            lats = ds[lat_name].values.astype(np.float64)
            lons = ds[lon_name].values.astype(np.float64)

            u_r = regrid_to_master(u, lats, lons)
            v_r = regrid_to_master(v, lats, lons)
            if short_name != SHORT_NAMES[0]:
                logger.info("OSCAR: used fallback %s for %s (NRT not yet available)", short_name, d)
            return u_r, v_r
        except Exception as exc:
            logger.warning("OSCAR: failed to process %s granule for %s: %s", short_name, d, exc)
        finally:
            ds.close()

    return None


def _fetch_blocking(dates: list[date]) -> tuple[np.ndarray, np.ndarray]:
    import earthaccess

    earthaccess.login(persist=True)

    u_daily = np.full((len(dates), 101, 241), np.nan, dtype=np.float32)
    v_daily = np.full((len(dates), 101, 241), np.nan, dtype=np.float32)

    for i, d in enumerate(dates):
        pair = _fetch_one_day(d)
        if pair is not None:
            u_daily[i], v_daily[i] = pair
        elif i > 0:
            logger.warning("OSCAR: no data for %s — carrying forward", d)
            u_daily[i] = u_daily[i - 1]
            v_daily[i] = v_daily[i - 1]
        else:
            logger.warning("OSCAR: no data for %s and nothing to carry forward — leaving NaN", d)

    logger.info("OSCAR: fetch complete, shape=%s", u_daily.shape)
    return u_daily, v_daily


async def fetch_currents(dates: list[date] | None = None) -> tuple[np.ndarray, np.ndarray]:
    """
    Async wrapper.

    Parameters
    ----------
    dates : if omitted, defaults to the previous 16 days from today (shifted
        back 2 days for OSCAR NRT's typical publication latency).

    Returns
    -------
    (u, v) each (T, 101, 241) float32 in m/s. NaN where no data was found
    and there was nothing to carry forward — never a silent zero-fill.
    """
    dates = dates if dates is not None else get_default_dates_for("currents")
    return await asyncio.to_thread(_fetch_blocking, dates)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    u, v = asyncio.run(fetch_currents())
    print("OSCAR u shape:", u.shape, "| NaN fraction:", float(np.isnan(u).mean()))
