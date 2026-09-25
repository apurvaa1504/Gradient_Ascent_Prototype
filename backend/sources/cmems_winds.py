"""
Channels 5 & 6 — Surface Wind U/V components from CMEMS L4 NRT blended wind.

Variables : eastward_wind -> U_wind (m/s), northward_wind -> V_wind (m/s)
Auth      : CMEMS_USERNAME / CMEMS_PASSWORD env vars, or a stored
            `copernicusmarine login` session if neither is set.

Note on product choice
-----------------------
A product page for this parameter is sometimes bookmarked as
WIND_GLO_PHY_L3_MY_012_005 — that is the *multi-year, Level-3* (along-track,
single-scatterometer, ungridded) wind record. It is unsuitable here for two
independent reasons: it's L3 (not the gridded L4 field this pipeline
expects), and it's "MY" (multi-year/delayed-time), which is far too latent
for a rolling 16-day window. This module always requests the gridded L4 NRT
product (WIND_GLO_PHY_L4_NRT_012_004) instead, whose `eastward_wind` /
`northward_wind` variables match what's already used downstream.

FIX — hard-coded dataset ID with no live-catalog fallback
------------------------------------------------------------
The previous version already tried an NRT id then an MY id, which was a
reasonable instinct, but MY is latency-wise useless for a 16-day window (see
above) and both IDs were guesses with no fallback if CMEMS had renamed them.
This now goes through `cmems_common.open_cmems_dataset`: NRT candidates
first, then MY only as a last-resort (logged loudly, since MY data returned
here will be stale for anything in the last several weeks), then a live
catalog search.

FIX — silent far-away time match
------------------------------------------------
Same fix as the other CMEMS modules: `select_nearest_with_tolerance`
replaces the unbounded `.sel(..., method="nearest")`.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import date

import numpy as np

from .cmems_common import get_cmems_credentials, open_cmems_dataset, select_nearest_with_tolerance
from .date_utils import get_default_dates_for
from regridder import LAT_MAX, LAT_MIN, LON_MAX, LON_MIN, regrid_to_master

logger = logging.getLogger(__name__)

CANDIDATE_DATASET_IDS = [
    "cmems_obs-wind_glo_phy_nrt_l4_0.125deg_PT1H",  # gridded L4 NRT (preferred)
    "cmems_obs-wind_glo_phy_l4_nrt_0.125deg_PT1H",  # alt token ordering, kept as a fallback
    "cmems_obs-wind_glo_phy_my_l4_0.125deg_PT1H",   # MY — last resort only, will be stale for recent days
]
CATALOG_SEARCH_TERMS = ["wind", "glo", "nrt", "l4"]

VAR_U = "eastward_wind"
VAR_V = "northward_wind"
TIME_TOLERANCE_HOURS = 36  # this product is hourly; be generous but still bounded
_PAD = 1.0


def _fetch_blocking(
    dates: list[date],
    username: str | None,
    password: str | None,
) -> tuple[np.ndarray, np.ndarray]:
    username, password = get_cmems_credentials(username, password)
    start, end = dates[0].isoformat(), dates[-1].isoformat()
    logger.info("Wind: fetching %s -> %s (%d days) from CMEMS", start, end, len(dates))

    ds, used_id = open_cmems_dataset(
        label="Wind",
        candidate_ids=CANDIDATE_DATASET_IDS,
        variables=[VAR_U, VAR_V],
        bbox=(LAT_MIN - _PAD, LAT_MAX + _PAD, LON_MIN - _PAD, LON_MAX + _PAD),
        start=f"{start}T00:00:00",
        end=f"{end}T23:59:59",
        username=username,
        password=password,
        search_terms_if_all_fail=CATALOG_SEARCH_TERMS,
    )
    if used_id.endswith("_my_l4_0.125deg_PT1H"):
        logger.warning(
            "Wind: only the multi-year (MY) dataset was reachable — recent "
            "days in this window may be missing or stale."
        )

    src_lats = ds.latitude.values.astype(np.float64)
    src_lons = ds.longitude.values.astype(np.float64)
    u_da, v_da = ds[VAR_U], ds[VAR_V]
    tol_days = TIME_TOLERANCE_HOURS / 24.0

    u_result = np.full((len(dates), 101, 241), np.nan, dtype=np.float32)
    v_result = np.full((len(dates), 101, 241), np.nan, dtype=np.float32)

    for i, d in enumerate(dates):
        u_slice = select_nearest_with_tolerance(u_da, d, tol_days)
        v_slice = select_nearest_with_tolerance(v_da, d, tol_days)
        if u_slice is None or v_slice is None:
            logger.warning(
                "Wind: no observation within %.1fh of %s (dataset=%s) — carrying forward",
                TIME_TOLERANCE_HOURS, d, used_id,
            )
            if i > 0:
                u_result[i] = u_result[i - 1]
                v_result[i] = v_result[i - 1]
            continue
        try:
            u_result[i] = regrid_to_master(u_slice.values.astype(np.float32), src_lats, src_lons)
            v_result[i] = regrid_to_master(v_slice.values.astype(np.float32), src_lats, src_lons)
        except Exception as exc:
            logger.warning("Wind: failed to process %s (%s) — carrying forward", d, exc)
            if i > 0:
                u_result[i] = u_result[i - 1]
                v_result[i] = v_result[i - 1]

    logger.info("Wind: fetch complete, shape=%s (dataset_id=%s)", u_result.shape, used_id)
    return u_result, v_result


async def fetch_winds(
    dates: list[date] | None = None,
    username: str | None = None,
    password: str | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Async wrapper.

    Parameters
    ----------
    dates : if omitted, defaults to the previous 16 days from today
        (shifted back 1 day for this product's typical publication latency).

    Returns
    -------
    (u_wind, v_wind) each (T, 101, 241) float32 in m/s.
    """
    dates = dates if dates is not None else get_default_dates_for("wind")
    return await asyncio.to_thread(_fetch_blocking, dates, username, password)


if __name__ == "__main__":
    import os

    logging.basicConfig(level=logging.INFO)
    u, v = asyncio.run(
        fetch_winds(username=os.environ.get("CMEMS_USERNAME"), password=os.environ.get("CMEMS_PASSWORD"))
    )
    print("Wind U shape:", u.shape, "| NaN fraction:", float(np.isnan(u).mean()))
