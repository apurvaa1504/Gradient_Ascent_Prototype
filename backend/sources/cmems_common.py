"""
Shared helpers for CMEMS (Copernicus Marine) data sources.

Every CMEMS module in this package (SST, SSH, wind) used to hard-code a
*single* dataset ID and just let `copernicusmarine.open_dataset` raise if it
was wrong or had been renamed. That is the single biggest recurring source
of "the code stopped working" bugs here: CMEMS renames dataset IDs
periodically (resolution suffixes change, processing chains get renamed —
e.g. the global NRT sea-level dataset moved from
`..._allsat-l4-duacs-0.25deg_P1D` to
`..._demo-allsat-swos-l4-duacs-0.125deg_P1D-i` when DUACS moved to its
SWOT-era processing chain), and a hard-coded ID silently goes stale.

`open_cmems_dataset` fixes this by:

  1. Trying each ID in a caller-supplied, best-guess `candidate_ids` list,
     in order (fast path — no extra network calls if the first guess still
     works).
  2. Falling back to `copernicusmarine.describe(contains=[...])` to search
     the *live* catalog for a dataset whose ID contains every one of
     `search_terms_if_all_fail`, and trying whatever turns up.
  3. Raising one clear `RuntimeError` listing every attempt, instead of an
     opaque exception several call-frames down with no context.

It also centralises two other bugs that were duplicated (or missing) across
every module:

* Credentials silently defaulting to `None, None` when not passed, instead
  of falling back to `CMEMS_USERNAME` / `CMEMS_PASSWORD` env vars (or a
  stored `copernicusmarine login` session).
* `.sel(time=..., method="nearest")` matching a value *arbitrarily far* from
  the requested date when there's a gap in the record, and the caller
  treating that stale match as if it were fresh data. This is a real bug in
  the original code: `sst.sel(time=str(d), method="nearest")` will happily
  return data from a week away with no warning if the requested day has a
  hole. `select_nearest_with_tolerance` refuses to match beyond a caller
  -specified tolerance and returns `None` instead, so the caller's existing
  "missing -> carry forward" logic actually triggers when it should.
"""

from __future__ import annotations

import logging
import os
import time
from datetime import date
from typing import Sequence

import numpy as np

logger = logging.getLogger(__name__)

_MAX_RETRIES = 3
_RETRY_BACKOFF_S = 5


def get_cmems_credentials(
    username: str | None,
    password: str | None,
) -> tuple[str | None, str | None]:
    """
    Fill in CMEMS_USERNAME / CMEMS_PASSWORD from the environment when not
    passed explicitly. Returns (None, None) if neither is available
    anywhere — `copernicusmarine` will then fall back to a locally stored
    `copernicusmarine login` session if one exists, which is a valid setup
    too, so this is not treated as an error here.
    """
    username = username or os.environ.get("CMEMS_USERNAME") or None
    password = password or os.environ.get("CMEMS_PASSWORD") or None
    return username, password


def _try_open(
    dataset_id: str,
    variables: Sequence[str],
    bbox: tuple[float, float, float, float],
    start: str,
    end: str,
    username: str | None,
    password: str | None,
):
    import copernicusmarine

    lat_min, lat_max, lon_min, lon_max = bbox
    return copernicusmarine.open_dataset(
        dataset_id=dataset_id,
        variables=list(variables),
        minimum_latitude=lat_min,
        maximum_latitude=lat_max,
        minimum_longitude=lon_min,
        maximum_longitude=lon_max,
        start_datetime=start,
        end_datetime=end,
        username=username,
        password=password,
    )


def _discover_candidate_ids(search_terms: Sequence[str]) -> list[str]:
    """Ask the live CMEMS catalog for dataset IDs matching all `search_terms`."""
    import copernicusmarine

    try:
        catalog = copernicusmarine.describe(contains=list(search_terms))
    except Exception as exc:
        logger.warning("CMEMS catalog search failed for %s: %s", search_terms, exc)
        return []

    found: list[str] = []
    try:
        # copernicusmarine >= 1.x returns objects with .products / .datasets
        for product in catalog.products:
            for ds in product.datasets:
                found.append(ds.dataset_id)
    except AttributeError:
        # Older toolbox versions return a plain dict — handle both shapes.
        for product in catalog.get("products", []):
            for ds in product.get("datasets", []):
                if ds.get("dataset_id"):
                    found.append(ds["dataset_id"])
    return found


def open_cmems_dataset(
    *,
    label: str,
    candidate_ids: Sequence[str],
    variables: Sequence[str],
    bbox: tuple[float, float, float, float],
    start: str,
    end: str,
    username: str | None,
    password: str | None,
    search_terms_if_all_fail: Sequence[str] | None = None,
):
    """
    Try each dataset ID in `candidate_ids` (with retries), then fall back to
    a live catalog search if every candidate fails.

    Parameters
    ----------
    bbox : (lat_min, lat_max, lon_min, lon_max)

    Returns
    -------
    (xarray.Dataset, dataset_id_used)

    Raises
    ------
    RuntimeError with the full attempt log if nothing works.
    """
    username, password = get_cmems_credentials(username, password)
    attempts: list[str] = []
    all_ids = list(dict.fromkeys(candidate_ids))  # de-dup, preserve order
    tried_discovery = False

    idx = 0
    while idx < len(all_ids):
        dataset_id = all_ids[idx]
        idx += 1

        for attempt in range(1, _MAX_RETRIES + 1):
            try:
                logger.info(
                    "%s: trying dataset_id=%s (attempt %d/%d)",
                    label, dataset_id, attempt, _MAX_RETRIES,
                )
                ds = _try_open(dataset_id, variables, bbox, start, end, username, password)
                logger.info("%s: succeeded with dataset_id=%s", label, dataset_id)
                return ds, dataset_id
            except Exception as exc:
                attempts.append(f"{dataset_id} (attempt {attempt}/{_MAX_RETRIES}): {exc}")
                if attempt < _MAX_RETRIES:
                    time.sleep(_RETRY_BACKOFF_S)

        if idx == len(all_ids) and not tried_discovery and search_terms_if_all_fail:
            tried_discovery = True
            discovered = _discover_candidate_ids(search_terms_if_all_fail)
            new_ids = [d for d in discovered if d not in all_ids]
            if new_ids:
                logger.info(
                    "%s: all known candidates failed — catalog search found %d more to try",
                    label, len(new_ids),
                )
                all_ids.extend(new_ids)

    raise RuntimeError(
        f"{label}: every CMEMS dataset_id candidate failed:\n" + "\n".join(attempts)
    )


def select_nearest_with_tolerance(data_array, target_date: date, tolerance_days: int = 1):
    """
    Select the time step nearest to `target_date` in `data_array`, but only
    if it's within `tolerance_days`; otherwise return None.

    Why this matters: `.sel(time=..., method="nearest")` on a time axis with
    a gap covering `target_date` will silently return the nearest value on
    *either* side of the gap, however far away — e.g. matching data from a
    week later with no indication anything was wrong. Callers in this
    package rely on "missing -> carry forward the previous day", so a
    silent far-away match breaks that logic entirely. This function makes
    "too far away" and "actually missing" the same case for the caller.
    """
    times = data_array["time"].values
    if len(times) == 0:
        return None
    target64 = np.datetime64(target_date.isoformat())
    diffs = np.abs(times - target64)
    idx = int(np.argmin(diffs))
    diff_days = diffs[idx] / np.timedelta64(1, "D")
    if diff_days > tolerance_days:
        return None
    return data_array.isel(time=idx)
