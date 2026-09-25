"""
Channel 2 — Sea Surface Height / Sea Level Anomaly (SSH/SLA) from CMEMS
DUACS altimetry L4, NRT.

Variable : sla — metres.
Auth     : CMEMS_USERNAME / CMEMS_PASSWORD env vars, or a stored
           `copernicusmarine login` session if neither is set.

Note: the training data used GLORYS `zos` (absolute SSH). DUACS `sla` is an
anomaly relative to a ~20-year mean; it carries the same mesoscale eddy
signal and normalises to a similar range under the checkpoint stats.

FIX — wrong product family for "last 16 days"
------------------------------------------------
The product page usually bookmarked for this
(SEALEVEL_GLO_PHY_L4_MY_008_047) is the *multi-year* (delayed-time) DUACS
record, which is only finalised weeks to months after the fact — a query
for the last 16 days will return nothing useful. This module always
requests the NRT product (SEALEVEL_GLO_PHY_L4_NRT_008_046) instead.

FIX — hard-coded, possibly-stale dataset ID
------------------------------------------------
DUACS renamed its NRT processing chain in its move to SWOT-era altimetry
(e.g. `..._allsat-l4-duacs-0.25deg_P1D` -> `..._demo-allsat-swos-l4-duacs-
0.125deg_P1D-i`), which would silently break a hard-coded ID. This now goes
through `cmems_common.open_cmems_dataset`, which tries a short candidate
list and falls back to a live catalog search if every candidate fails.

FIX — silent far-away time match
------------------------------------------------
Same fix as cmems_sst.py: selection now goes through
`select_nearest_with_tolerance` instead of an unbounded
`.sel(..., method="nearest")`, so a gap in the altimetry record triggers
carry-forward instead of silently reusing distant data.
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
    "cmems_obs-sl_glo_phy-ssh_nrt_demo-allsat-swos-l4-duacs-0.125deg_P1D-i",  # current (SWOT-era) naming
    "cmems_obs-sl_glo_phy-ssh_nrt_allsat-l4-duacs-0.25deg_P1D",               # legacy naming, kept as fallback
]
CATALOG_SEARCH_TERMS = ["sea", "level", "glo", "nrt", "l4", "duacs"]

VARIABLE = "sla"
TIME_TOLERANCE_DAYS = 2  # altimetry gridding sometimes skips a day; be slightly more lenient than SST
_PAD = 1.0


def _fetch_blocking(
    dates: list[date],
    username: str | None,
    password: str | None,
) -> np.ndarray:
    username, password = get_cmems_credentials(username, password)
    start, end = dates[0].isoformat(), dates[-1].isoformat()
    logger.info("SSH: fetching %s -> %s (%d days) from CMEMS", start, end, len(dates))

    ds, used_id = open_cmems_dataset(
        label="SSH",
        candidate_ids=CANDIDATE_DATASET_IDS,
        variables=[VARIABLE],
        bbox=(LAT_MIN - _PAD, LAT_MAX + _PAD, LON_MIN - _PAD, LON_MAX + _PAD),
        start=f"{start}T00:00:00",
        end=f"{end}T23:59:59",
        username=username,
        password=password,
        search_terms_if_all_fail=CATALOG_SEARCH_TERMS,
    )

    src_lats = ds.latitude.values.astype(np.float64)
    src_lons = ds.longitude.values.astype(np.float64)
    da = ds[VARIABLE]

    result = np.full((len(dates), 101, 241), np.nan, dtype=np.float32)

    for i, d in enumerate(dates):
        slice_da = select_nearest_with_tolerance(da, d, TIME_TOLERANCE_DAYS)
        if slice_da is None:
            logger.warning(
                "SSH: no observation within %dd of %s (dataset=%s) — carrying forward",
                TIME_TOLERANCE_DAYS, d, used_id,
            )
            if i > 0:
                result[i] = result[i - 1]
            continue
        try:
            raw = slice_da.values.astype(np.float32)
            result[i] = regrid_to_master(raw, src_lats, src_lons)
        except Exception as exc:
            logger.warning("SSH: failed to process %s (%s) — carrying forward", d, exc)
            if i > 0:
                result[i] = result[i - 1]

    logger.info("SSH: fetch complete, shape=%s (dataset_id=%s)", result.shape, used_id)
    return result


async def fetch_ssh(
    dates: list[date] | None = None,
    username: str | None = None,
    password: str | None = None,
) -> np.ndarray:
    """
    Async wrapper.

    Parameters
    ----------
    dates : if omitted, defaults to the previous 16 days from today
        (shifted back 2 days for DUACS NRT's typical publication latency).

    Returns
    -------
    (T, 101, 241) float32 in metres. NaN over land or where nothing was
    found within tolerance and there was nothing to carry forward.
    """
    dates = dates if dates is not None else get_default_dates_for("ssh")
    return await asyncio.to_thread(_fetch_blocking, dates, username, password)


if __name__ == "__main__":
    import os

    logging.basicConfig(level=logging.INFO)
    arr = asyncio.run(
        fetch_ssh(username=os.environ.get("CMEMS_USERNAME"), password=os.environ.get("CMEMS_PASSWORD"))
    )
    print("SSH shape:", arr.shape, "| NaN fraction:", float(np.isnan(arr).mean()))
