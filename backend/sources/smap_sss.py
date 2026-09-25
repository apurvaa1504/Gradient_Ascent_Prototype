"""
Channel 1 — Sea Surface Salinity (SSS) from NASA RSS SMAP L3 8-day running
mean, via NASA Earthdata / PO.DAAC.

Short name : SMAP_RSS_L3_SSS_SMI_8DAY-RUNNINGMEAN_V6
Variable   : sss_smap — PSU
Latency    : ~7 days (per the PO.DAAC/RSS release notes). Each file is
             "dated" the last day of its trailing 8-day average, and isn't
             published until about a week after that day. A request for
             "the last 16 days" needs to look further back than 16 days to
             find any files at all for the most recent part of the window —
             see SEARCH_BACK_DAYS below.
Auth       : NASA Earthdata Login, via `earthaccess`. Set
             EARTHDATA_USERNAME / EARTHDATA_PASSWORD in the environment, or
             run `earthaccess.login()` once interactively (it caches a
             token), or place credentials in ~/.netrc.

FIX — brittle hand-built download URLs
------------------------------------------------
The previous version reconstructed RSS's own file path and name by hand
(`RSS_smap_SSS_L3_8day_running_{year}_{doy}_{FNL|NRT}_v06.0.nc` under a
guessed `{year}/{year}_{doy}/` directory) and walked backwards day-by-day
hoping to hit a real file. That's fragile — it breaks silently if RSS
changes its directory layout, file naming, or version suffix, and it
doesn't use the same access path as the PO.DAAC dataset actually linked
here. This version uses `earthaccess`, NASA's own client, to search PO.DAAC's
catalog by short_name + time range and open whatever it actually finds.

FIX — longitude convention
------------------------------------------------
RSS SMAP files use 0-360 longitude. The previous code noted this only
"happens" to be a no-op for this project's specific domain (45-105 E) and
didn't actually convert it — a real bug waiting to break the moment the
domain changes. This version always converts to -180..180 and re-sorts the
grid, so it's correct regardless of domain.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import date, timedelta

import numpy as np

from .date_utils import get_default_dates_for
from regridder import LAT_MAX, LAT_MIN, LON_MAX, LON_MIN, regrid_to_master

logger = logging.getLogger(__name__)

SHORT_NAME = "SMAP_RSS_L3_SSS_SMI_8DAY-RUNNINGMEAN_V6"
VARIABLE = "sss_smap"
FILL_THRESHOLD = -900.0  # RSS files use -999 for fill/land/ice
SEARCH_BACK_DAYS = 20    # how far before the window's first day we'll look for a usable file


def _to_minus180(lon: np.ndarray) -> np.ndarray:
    """RSS SMAP files use 0-360 longitude; normalise to -180..180."""
    return ((lon + 180.0) % 360.0) - 180.0


def _open_granule(granule):
    import earthaccess
    import xarray as xr

    files = earthaccess.open([granule])
    try:
        return xr.open_dataset(files[0])
    except Exception:
        return xr.open_dataset(files[0], engine="h5netcdf")


def _process_granule(ds) -> np.ndarray:
    raw = ds[VARIABLE].values
    if raw.ndim == 3:
        raw = raw[0]
    raw = raw.astype(np.float32)
    raw[raw <= FILL_THRESHOLD] = np.nan

    lats = ds["lat"].values.astype(np.float64)
    lons = _to_minus180(ds["lon"].values.astype(np.float64))

    # Longitudes are no longer guaranteed ascending after the 0-360 -> -180
    # shift; re-sort both the axis and the data together.
    order = np.argsort(lons)
    lons = lons[order]
    raw = raw[:, order]

    lat_mask = (lats >= LAT_MIN - 2) & (lats <= LAT_MAX + 2)
    lon_mask = (lons >= LON_MIN - 2) & (lons <= LON_MAX + 2)
    sub_lats = lats[lat_mask]
    sub_lons = lons[lon_mask]
    sub_raw = raw[np.ix_(lat_mask, lon_mask)]

    return regrid_to_master(sub_raw, sub_lats, sub_lons)


def _granule_end_date(granule) -> date | None:
    """SMAP granule 'date' = the last day of its trailing 8-day average."""
    try:
        end_str = granule["umm"]["TemporalExtent"]["RangeDateTime"]["EndingDateTime"]
        return date.fromisoformat(end_str[:10])
    except Exception:
        return None


def _fetch_blocking(dates: list[date]) -> np.ndarray:
    import earthaccess

    earthaccess.login(persist=True)  # tries netrc, then env vars, then interactive prompt

    result = np.full((len(dates), 101, 241), np.nan, dtype=np.float32)

    search_start = (dates[0] - timedelta(days=SEARCH_BACK_DAYS)).isoformat()
    search_end = dates[-1].isoformat()
    logger.info("SSS: searching %s (%s -> %s)", SHORT_NAME, search_start, search_end)

    try:
        granules = earthaccess.search_data(short_name=SHORT_NAME, temporal=(search_start, search_end))
    except Exception as exc:
        logger.warning("SSS: earthaccess search failed (%s) — returning all-NaN", exc)
        return result

    if not granules:
        logger.warning("SSS: no granules found for %s -> %s — returning all-NaN", search_start, search_end)
        return result

    dated_granules = sorted(
        ((g_date, g) for g in granules if (g_date := _granule_end_date(g)) is not None),
        key=lambda pair: pair[0],
    )

    ds_cache: dict[date, np.ndarray | None] = {}

    for i, d in enumerate(dates):
        eligible = [g for g_date, g in dated_granules if g_date <= d]
        if not eligible:
            logger.warning("SSS: no granule available on or before %s", d)
            if i > 0:
                result[i] = result[i - 1]
            continue

        chosen_date = next(g_date for g_date, g in dated_granules if g is eligible[-1])
        if chosen_date in ds_cache:
            arr = ds_cache[chosen_date]
        else:
            try:
                ds = _open_granule(eligible[-1])
                try:
                    arr = _process_granule(ds)
                finally:
                    ds.close()
            except Exception as exc:
                logger.warning("SSS: failed to process granule for %s (dated %s): %s", d, chosen_date, exc)
                arr = None
            ds_cache[chosen_date] = arr

        if arr is not None:
            result[i] = arr
            if chosen_date != d:
                logger.info("SSS: %s used granule dated %s (lag=%dd)", d, chosen_date, (d - chosen_date).days)
        elif i > 0:
            result[i] = result[i - 1]

    return result


async def fetch_sss(dates: list[date] | None = None) -> np.ndarray:
    """
    Async wrapper.

    Parameters
    ----------
    dates : if omitted, defaults to the previous 16 days from today (shifted
        back ~7 days to allow for this product's publication latency).

    Returns
    -------
    (T, 101, 241) float32 in PSU. NaN over land / where nothing usable was
    found and there was nothing to carry forward.
    """
    dates = dates if dates is not None else get_default_dates_for("sss")
    logger.info("SSS: fetching %d days of SMAP data", len(dates))
    return await asyncio.to_thread(_fetch_blocking, dates)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    arr = asyncio.run(fetch_sss())
    print("SSS shape:", arr.shape, "| NaN fraction:", float(np.isnan(arr).mean()))
