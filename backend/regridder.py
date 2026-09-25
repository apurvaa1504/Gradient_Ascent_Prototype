"""
Spatial regridding utility.

All source data (CMEMS, SMAP, OSCAR, …) arrives on its own native grid.
This module reprojects every field onto the single 0.25° master grid the
model was trained on:

  Latitude  : 5.00 N → 30.00 N   step 0.25°   (101 points)
  Longitude : 45.00 E → 105.00 E  step 0.25°   (241 points)
"""

from __future__ import annotations

import numpy as np
from scipy.interpolate import RegularGridInterpolator

# ---------------------------------------------------------------------------
# Master grid definition
# ---------------------------------------------------------------------------
LAT_MIN, LAT_MAX, GRID_STEP = 5.0, 30.0, 0.25
LON_MIN, LON_MAX = 45.0, 105.0

MASTER_LATS = np.round(
    np.arange(LAT_MIN, LAT_MAX + GRID_STEP / 2, GRID_STEP), 6
).astype(np.float64)  # (101,)

MASTER_LONS = np.round(
    np.arange(LON_MIN, LON_MAX + GRID_STEP / 2, GRID_STEP), 6
).astype(np.float64)  # (241,)

assert len(MASTER_LATS) == 101, f"Expected 101 lat points, got {len(MASTER_LATS)}"
assert len(MASTER_LONS) == 241, f"Expected 241 lon points, got {len(MASTER_LONS)}"

# Meshgrid for query points (row=lat, col=lon)
_LON_GRID, _LAT_GRID = np.meshgrid(MASTER_LONS, MASTER_LATS)  # both (101, 241)
_QUERY_PTS = np.column_stack([_LAT_GRID.ravel(), _LON_GRID.ravel()])  # (101*241, 2)


def regrid_to_master(
    data: np.ndarray,
    src_lats: np.ndarray,
    src_lons: np.ndarray,
    method: str = "linear",
) -> np.ndarray:
    """
    Bilinearly interpolate a 2-D field onto the master 0.25° grid.

    Parameters
    ----------
    data      : (H_src, W_src) float32/64 — may contain NaN over land.
    src_lats  : (H_src,) ascending latitudes of the source grid.
    src_lons  : (W_src,) ascending longitudes of the source grid.
    method    : 'linear' (default) or 'nearest'.

    Returns
    -------
    (101, 241) float32 array.  Points outside the source domain are filled
    with NaN first, then repaired with nearest-neighbour from valid neighbours.
    """
    data = np.asarray(data, dtype=np.float64)

    # Ensure ascending coordinate order
    if src_lats[0] > src_lats[-1]:
        src_lats = src_lats[::-1]
        data = data[::-1, :]
    if src_lons[0] > src_lons[-1]:
        src_lons = src_lons[::-1]
        data = data[:, ::-1]

    # Guard: if everything is NaN, return NaN grid
    if np.all(np.isnan(data)):
        return np.full((101, 241), np.nan, dtype=np.float32)

    # Replace NaN with column-mean for the interpolator (NaNs break it),
    # but we'll restore NaN in the output for cells that were originally NaN.
    nan_mask = np.isnan(data)
    if nan_mask.any():
        col_means = np.nanmean(data, axis=0, keepdims=True)
        col_means = np.where(np.isnan(col_means), 0.0, col_means)
        data_filled = np.where(nan_mask, col_means, data)
    else:
        data_filled = data

    interp = RegularGridInterpolator(
        (src_lats, src_lons),
        data_filled,
        method=method,
        bounds_error=False,
        fill_value=np.nan,
    )
    result = interp(_QUERY_PTS).reshape(101, 241)

    # Fill any boundary NaNs with nearest-neighbour
    if np.any(np.isnan(result)):
        nn = RegularGridInterpolator(
            (src_lats, src_lons),
            data_filled,
            method="nearest",
            bounds_error=False,
            fill_value=np.nan,
        )
        result_nn = nn(_QUERY_PTS).reshape(101, 241)
        result = np.where(np.isnan(result), result_nn, result)

    return result.astype(np.float32)


def lat_lon_to_pixel(lat: float, lon: float) -> tuple[int, int]:
    """
    Return (row, col) indices of the master-grid pixel nearest to (lat, lon).
    """
    row = int(np.argmin(np.abs(MASTER_LATS - lat)))
    col = int(np.argmin(np.abs(MASTER_LONS - lon)))
    return row, col
