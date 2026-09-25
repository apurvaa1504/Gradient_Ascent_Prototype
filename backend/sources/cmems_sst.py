"""
Channel 0 — Sea Surface Temperature (SST)
Source: CMEMS MetOffice OSTIA L4 Near Real-Time (NRT)

Variable: analysed_sst
Source units: Kelvin
Output units: Celsius
Output shape: (T, 101, 241)

This module uses the OSTIA NRT product, not the reprocessed (REP)
product. It does not search the unrestricted CMEMS catalogue for
unrelated fallback datasets.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import date

import numpy as np

from .cmems_common import (
    get_cmems_credentials,
    open_cmems_dataset,
    select_nearest_with_tolerance,
)
from .date_utils import get_default_dates_for
from regridder import (
    LAT_MAX,
    LAT_MIN,
    LON_MAX,
    LON_MIN,
    regrid_to_master,
)

logger = logging.getLogger(__name__)

# Official OSTIA NRT dataset name documented by Copernicus Marine.
# Do not substitute the REP product or SST anomaly product here.
CANDIDATE_DATASET_IDS = [
    "METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2",
]

VARIABLE = "analysed_sst"
KELVIN_OFFSET = -273.15
TIME_TOLERANCE_DAYS = 1
_PAD = 1.0

MASTER_SHAPE = (101, 241)


def _get_coordinate(ds, possible_names: tuple[str, ...]) -> np.ndarray:
    """Return a coordinate using one of the recognized names."""
    for name in possible_names:
        if name in ds.coords:
            return ds[name].values.astype(np.float64)

        if name in ds.variables:
            return ds[name].values.astype(np.float64)

    raise ValueError(
        f"Could not find coordinate. Tried: {possible_names}. "
        f"Available coordinates: {list(ds.coords)}"
    )


def _fetch_blocking(
    dates: list[date],
    username: str | None,
    password: str | None,
) -> np.ndarray:
    """Blocking implementation; called through asyncio.to_thread."""

    if not dates:
        raise ValueError("SST dates must contain at least one date.")

    # Ensure dates are chronological for carry-forward handling.
    dates = sorted(dates)

    username, password = get_cmems_credentials(username, password)

    start = dates[0].isoformat()
    end = dates[-1].isoformat()

    logger.info(
        "SST: fetching %s -> %s (%d days) from OSTIA NRT",
        start,
        end,
        len(dates),
    )

    # Important: no unrestricted catalogue search. If this product
    # cannot be opened, report the error rather than using an unrelated
    # dataset as SST.
    ds, used_id = open_cmems_dataset(
        label="SST",
        candidate_ids=CANDIDATE_DATASET_IDS,
        variables=[VARIABLE],
        bbox=(
            LAT_MIN - _PAD,
            LAT_MAX + _PAD,
            LON_MIN - _PAD,
            LON_MAX + _PAD,
        ),
        start=f"{start}T00:00:00",
        end=f"{end}T23:59:59",
        username=username,
        password=password,
        search_terms_if_all_fail=[],
    )

    try:
        if VARIABLE not in ds:
            raise ValueError(
                f"Dataset {used_id!r} does not contain {VARIABLE!r}. "
                f"Available data variables: {list(ds.data_vars)}"
            )

        src_lats = _get_coordinate(ds, ("latitude", "lat"))
        src_lons = _get_coordinate(ds, ("longitude", "lon"))

        da = ds[VARIABLE]

        if "time" not in da.dims:
            raise ValueError(
                f"{VARIABLE!r} has no time dimension. " f"Dimensions: {da.dims}"
            )

        result = np.full(
            (len(dates), *MASTER_SHAPE),
            np.nan,
            dtype=np.float32,
        )

        for i, current_date in enumerate(dates):
            try:
                slice_da = select_nearest_with_tolerance(
                    da,
                    current_date,
                    TIME_TOLERANCE_DAYS,
                )

                if slice_da is None:
                    logger.warning(
                        "SST: no observation within %d day(s) of %s " "(dataset=%s)",
                        TIME_TOLERANCE_DAYS,
                        current_date,
                        used_id,
                    )

                    # Carry forward only if the preceding output has
                    # at least one valid value.
                    if i > 0 and np.isfinite(result[i - 1]).any():
                        result[i] = result[i - 1]

                    continue

                raw = np.asarray(
                    slice_da.values,
                    dtype=np.float32,
                )

                # Remove singleton dimensions if present.
                raw = np.squeeze(raw)

                if raw.ndim != 2:
                    raise ValueError(
                        f"Expected a 2D SST field after time selection; "
                        f"got shape {raw.shape}"
                    )

                # Convert Kelvin to Celsius.
                raw_celsius = raw + KELVIN_OFFSET

                regridded = regrid_to_master(
                    raw_celsius,
                    src_lats,
                    src_lons,
                )

                if regridded.shape != MASTER_SHAPE:
                    raise ValueError(
                        f"Regridded SST has shape {regridded.shape}; "
                        f"expected {MASTER_SHAPE}"
                    )

                result[i] = regridded.astype(np.float32)

                logger.info(
                    "SST: processed %s; valid fraction=%.3f",
                    current_date,
                    float(np.isfinite(result[i]).mean()),
                )

            except Exception:
                logger.exception(
                    "SST: failed to process %s — attempting carry-forward",
                    current_date,
                )

                if i > 0 and np.isfinite(result[i - 1]).any():
                    result[i] = result[i - 1]

        logger.info(
            "SST: fetch complete, shape=%s, dataset_id=%s, "
            "overall valid fraction=%.3f",
            result.shape,
            used_id,
            float(np.isfinite(result).mean()),
        )

        return result

    finally:
        # Close the dataset even if processing fails.
        ds.close()


async def fetch_sst(
    dates: list[date] | None = None,
    username: str | None = None,
    password: str | None = None,
) -> np.ndarray:
    """
    Fetch OSTIA NRT SST and return a float32 array in Celsius.

    Parameters
    ----------
    dates:
        Dates to fetch. If omitted, use get_default_dates_for("sst").

    username, password:
        Optional CMEMS credentials. If omitted, credentials are obtained
        through get_cmems_credentials().

    Returns
    -------
    np.ndarray
        Shape (T, 101, 241), in degrees Celsius.
        NaNs may remain over land or where no valid observation exists.
    """
    dates = dates if dates is not None else get_default_dates_for("sst")

    if not dates:
        raise ValueError("No SST dates were provided or generated.")

    return await asyncio.to_thread(
        _fetch_blocking,
        dates,
        username,
        password,
    )


if __name__ == "__main__":
    import os

    logging.basicConfig(level=logging.INFO)

    array = asyncio.run(
        fetch_sst(
            username=os.environ.get("CMEMS_USERNAME"),
            password=os.environ.get("CMEMS_PASSWORD"),
        )
    )

    print("SST shape:", array.shape)
    print("SST NaN fraction:", float(np.isnan(array).mean()))
    print("SST valid fraction:", float(np.isfinite(array).mean()))
