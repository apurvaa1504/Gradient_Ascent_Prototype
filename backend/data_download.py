"""
Ocean data downloader — NIO (North Indian Ocean) domain
========================================================
Fetches the 16 days immediately before 2024-12-25 (i.e. 2024-12-09
through 2024-12-24 inclusive) for each variable, regrids everything
to the 0.25° target grid, and saves the results into a folder named
"data".

  sst_nio_20241209_20241224_0_25deg.nc   → analysed_sst  (time, latitude, longitude)  [K]
  sss_nio_20241209_20241224_0_25deg.nc   → sos            (time, depth, latitude, longitude)
  ssh_nio_20241209_20241224_0_25deg.nc   → sla            (time, latitude, longitude)  [m]
  oscar_currents_nio_20241209_20241224.nc → u, v, ug, vg  (time, longitude, latitude)  [m/s]
  wind_ccmp_20241209_20241224_0_25deg.nc → uwnd, vwnd, ws (time, latitude, longitude)  [m/s]

Sources
-------
  SST   → Copernicus  METOFFICE-GLO-SST-L4-REP-OBS-SST_202003
  SSS   → Copernicus  cmems_obs-mob_glo_phy-sal_my_0.25deg_P1D-m_202309   (L4 reprocessed)
  SSH   → Copernicus  cmems_obs-sl_glo_phy-ssh_my_allsat-l4-duacs-0.125deg_P1D_202411
  Currents → NASA PO.DAAC  OSCAR_L4_OC_FINAL_V2.0
  Winds    → NASA PO.DAAC  CCMP_WINDS_10M6HR_L4_V3.1
"""

from pathlib import Path
import os
import time as _time

import numpy as np
import pandas as pd
import xarray as xr

import copernicusmarine
import earthaccess
from dotenv import load_dotenv

load_dotenv()

# ─────────────────────────────────────────────
# USER CONFIG  ← change these as needed
# ─────────────────────────────────────────────
# 16 days before 2024-12-25 → 2024-12-09 through 2024-12-24 (inclusive)
START_DATE = "2024-12-09"
END_DATE = "2024-12-24"
DATE_TAG = f"{START_DATE.replace('-', '')}_{END_DATE.replace('-', '')}"

OUT_DIR = Path("data")
RAW_DIR = OUT_DIR / "raw"

# NIO bounding box and target grid (matches reference files)
WEST, SOUTH, EAST, NORTH = 45.0, 5.0, 105.0, 30.0
RESOLUTION = 0.25

# Copernicus dataset IDs
SST_DATASET = "METOFFICE-GLO-SST-L4-REP-OBS-SST_202003"
SSS_DATASET = "cmems_obs-mob_glo_phy-sal_my_0.25deg_P1D-m_202309"
SSH_DATASET = "cmems_obs-sl_glo_phy-ssh_my_allsat-l4-duacs-0.125deg_P1D_202411"

# NASA PO.DAAC collection short names
OSCAR_COLLECTION = "OSCAR_L4_OC_FINAL_V2.0"
CCMP_COLLECTION = "CCMP_WINDS_10M6HR_L4_V3.1"

# ─────────────────────────────────────────────
# FIXED GRID (matches reference files)
# ─────────────────────────────────────────────
TARGET_LAT = np.round(np.arange(SOUTH, NORTH + RESOLUTION / 2, RESOLUTION), 6)  # (101,)
TARGET_LON = np.round(np.arange(WEST, EAST + RESOLUTION / 2, RESOLUTION), 6)  # (241,)

OUT_DIR.mkdir(parents=True, exist_ok=True)
RAW_DIR.mkdir(parents=True, exist_ok=True)


# ════════════════════════════════════════════
# HELPERS
# ════════════════════════════════════════════


def _target_times():
    return pd.date_range(START_DATE, END_DATE, freq="D")


def _standardize_coords(ds):
    """Rename latitude/longitude/time variants → lat/lon/time; fix 0–360 lon."""
    rename = {}
    for old, new, candidates in [
        ("lat", "lat", ["lat", "latitude", "nav_lat"]),
        ("lon", "lon", ["lon", "longitude", "nav_lon"]),
        ("time", "time", ["time", "TIME", "valid_time"]),
    ]:
        for c in candidates:
            if c in ds.coords or c in ds.variables:
                if c != new:
                    rename[c] = new
                break

    if rename:
        ds = ds.rename(rename)

    if "lon" in ds.coords and float(ds.lon.max()) > 180:
        ds = ds.assign_coords(lon=((ds.lon + 180) % 360) - 180).sortby("lon")

    return ds


def _select_bbox(ds):
    ds = _standardize_coords(ds)
    lat_vals = ds.lat.values
    lat_slice = (
        slice(SOUTH, NORTH) if lat_vals[0] < lat_vals[-1] else slice(NORTH, SOUTH)
    )
    return ds.sel(lat=lat_slice, lon=slice(WEST, EAST))


def _regrid(da, target_lat=TARGET_LAT, target_lon=TARGET_LON):
    """Linear interpolation onto the 0.25° target grid."""
    da = da.squeeze(drop=True)
    if "lat" not in da.dims or "lon" not in da.dims:
        raise ValueError(f"Expected lat/lon dims, got {da.dims}")
    if da.lat.values[0] > da.lat.values[-1]:
        da = da.sortby("lat")
    if da.lon.values[0] > da.lon.values[-1]:
        da = da.sortby("lon")
    return da.interp(
        lat=xr.DataArray(target_lat, dims="lat"),
        lon=xr.DataArray(target_lon, dims="lon"),
        method="linear",
    )


def _report(da, label):
    v = da.values
    frac = float(np.isfinite(v).mean()) if v.size else 0.0
    print(f"  [{label}] shape={v.shape}  finite={frac:.3%}")


# ════════════════════════════════════════════
# COPERNICUS DOWNLOAD
# ════════════════════════════════════════════


def _cmems_subset(dataset_id, variables, out_path, depth_min=None, depth_max=None):
    kwargs = dict(
        dataset_id=dataset_id,
        variables=variables,
        minimum_longitude=WEST,
        maximum_longitude=EAST,
        minimum_latitude=SOUTH,
        maximum_latitude=NORTH,
        start_datetime=f"{START_DATE}T00:00:00",
        end_datetime=f"{END_DATE}T23:59:59",
        output_filename=str(out_path),
        username=os.getenv("COPERNICUSMARINE_SERVICE_USERNAME"),
        password=os.getenv("COPERNICUSMARINE_SERVICE_PASSWORD"),
        overwrite=True,
    )
    if depth_min is not None:
        kwargs["minimum_depth"] = depth_min
        kwargs["maximum_depth"] = depth_max
    copernicusmarine.subset(**kwargs)
    return out_path


# ── SST ─────────────────────────────────────
def download_sst():
    """
    Source : METOFFICE-GLO-SST-L4-REP-OBS-SST_202003
    Output : sst_nio_{DATE_TAG}_0_25deg.nc
             Dims   → (time:16, latitude:101, longitude:241)
             Var    → analysed_sst  [K]
    """
    print(f"\n[SST] {START_DATE} → {END_DATE}")
    raw = RAW_DIR / f"sst_raw_{DATE_TAG}.nc"
    _cmems_subset(SST_DATASET, ["analysed_sst"], raw)

    ds_raw = xr.open_dataset(raw)
    ds_bbox = _select_bbox(ds_raw)
    da = ds_bbox["analysed_sst"]
    da = da.squeeze(drop=True)
    da = _regrid(da)
    da = da.reindex(time=_target_times())

    # Rename coords to match reference (latitude / longitude)
    da = da.rename({"lat": "latitude", "lon": "longitude"})
    da.name = "analysed_sst"
    da.attrs.update(
        {
            "units": "kelvin",
            "long_name": "analysed sea surface temperature",
            "standard_name": "sea_surface_foundation_temperature",
        }
    )

    _report(da, "SST")
    out = OUT_DIR / f"sst_nio_{DATE_TAG}_0_25deg.nc"
    da.to_dataset().to_netcdf(out)
    print(f"  → {out}")
    ds_raw.close()


# ── SSS ─────────────────────────────────────
def download_sss():
    """
    Source : cmems_obs-mob_glo_phy-sal_my_0.25deg_P1D-m_202309
    Output : sss_nio_{DATE_TAG}_0_25deg.nc
             Dims   → (time:16, depth:1, latitude:101, longitude:241)
             Var    → sos  [.001  = PSU]
    """
    print(f"\n[SSS] {START_DATE} → {END_DATE}")
    raw = RAW_DIR / f"sss_raw_{DATE_TAG}.nc"
    _cmems_subset(SSS_DATASET, ["sos"], raw, depth_min=0.0, depth_max=0.5)

    ds_raw = xr.open_dataset(raw)
    ds_bbox = _select_bbox(ds_raw)
    da = ds_bbox["sos"]

    # Drop all singleton non-spatial dims except depth
    for dim in list(da.dims):
        if dim not in ("time", "lat", "lon", "depth") and da.sizes[dim] == 1:
            da = da.isel({dim: 0}, drop=True)

    # Regrid lat/lon at depth=0
    if "depth" in da.dims:
        da_sfc = da.isel(depth=0, drop=False)
    else:
        da_sfc = da

    da_reg = _regrid(da_sfc)  # (time, lat, lon)
    da_reg = da_reg.expand_dims(dim={"depth": [0.0]}, axis=1)  # (time,depth,lat,lon)
    da_reg = da_reg.reindex(time=_target_times())
    da_reg = da_reg.rename({"lat": "latitude", "lon": "longitude"})
    da_reg.name = "sos"
    da_reg.attrs.update(
        {
            "units": ".001",
            "long_name": "sea surface salinity",
            "standard_name": "sea_surface_salinity",
        }
    )

    _report(da_reg, "SSS")
    out = OUT_DIR / f"sss_nio_{DATE_TAG}_0_25deg.nc"
    da_reg.to_dataset().to_netcdf(out)
    print(f"  → {out}")
    ds_raw.close()


# ── SSH ─────────────────────────────────────
def download_ssh():
    """
    Source : cmems_obs-sl_glo_phy-ssh_my_allsat-l4-duacs-0.125deg_P1D_202411
    Output : ssh_nio_{DATE_TAG}_0_25deg.nc
             Dims   → (time:16, latitude:101, longitude:241)
             Var    → sla  [m]
    """
    print(f"\n[SSH] {START_DATE} → {END_DATE}")
    raw = RAW_DIR / f"ssh_raw_{DATE_TAG}.nc"
    _cmems_subset(SSH_DATASET, ["sla"], raw)

    ds_raw = xr.open_dataset(raw)
    ds_bbox = _select_bbox(ds_raw)
    da = ds_bbox["sla"].squeeze(drop=True)
    da = _regrid(da)
    da = da.reindex(time=_target_times())
    da = da.rename({"lat": "latitude", "lon": "longitude"})
    da.name = "sla"
    da.attrs.update(
        {
            "units": "m",
            "long_name": "Sea level anomaly",
            "standard_name": "sea_surface_height_above_sea_level",
        }
    )

    _report(da, "SSH")
    out = OUT_DIR / f"ssh_nio_{DATE_TAG}_0_25deg.nc"
    da.to_dataset().to_netcdf(out)
    print(f"  → {out}")
    ds_raw.close()


# ════════════════════════════════════════════
# PO.DAAC HELPERS
# ════════════════════════════════════════════


def _earthaccess_login(max_retries=5, backoff=3):
    username = os.getenv("EARTHDATA_USERNAME")
    password = os.getenv("EARTHDATA_PASSWORD")
    if not username or not password:
        raise RuntimeError("Missing EARTHDATA_USERNAME or EARTHDATA_PASSWORD in .env")
    for attempt in range(1, max_retries + 1):
        try:
            print(f"  Earthdata login attempt {attempt}/{max_retries}...")
            earthaccess.login(strategy="environment", persist=False)
            print("  Login OK.")
            return
        except Exception as exc:
            print(f"  Failed: {exc}")
            if attempt < max_retries:
                _time.sleep(backoff * attempt)
            else:
                raise RuntimeError("Earthdata login failed.") from exc


def _podaac_download(collection, tag):
    results = earthaccess.search_data(
        short_name=collection,
        temporal=(START_DATE, END_DATE),
        bounding_box=(WEST, SOUTH, EAST, NORTH),
    )
    print(f"  Found {len(results)} granules for {collection}")
    if not results:
        raise RuntimeError(f"No granules for {collection} in {START_DATE}–{END_DATE}")
    dest = RAW_DIR / f"{tag}_{DATE_TAG}"
    dest.mkdir(parents=True, exist_ok=True)
    files = earthaccess.download(results, str(dest))
    return [Path(f) for f in files]


def _open_many(files):
    dsets = []
    for p in files:
        try:
            dsets.append(xr.open_dataset(p))
        except Exception:
            dsets.append(xr.open_dataset(p, engine="h5netcdf"))
    if len(dsets) == 1:
        return dsets[0]
    return xr.combine_by_coords(dsets, combine_attrs="drop_conflicts")


# ── OSCAR currents ───────────────────────────
def download_currents():
    """
    Source : OSCAR_L4_OC_FINAL_V2.0
    Output : oscar_currents_nio_{DATE_TAG}.nc
             Dims   → (time:16, longitude:241, latitude:101)   ← lon before lat (matches reference)
             Vars   → u, v, ug, vg  [m/s]
    """
    print(f"\n[OSCAR] {START_DATE} → {END_DATE}")
    files = _podaac_download(OSCAR_COLLECTION, "oscar")
    ds_raw = _open_many(files)
    ds_raw = _standardize_coords(ds_raw)
    ds_raw = _select_bbox(ds_raw)

    out_vars = {}
    for var, attrs in [
        (
            "u",
            {
                "units": "m s-1",
                "long_name": "zonal total surface current",
                "standard_name": "eastward_sea_water_velocity",
            },
        ),
        (
            "v",
            {
                "units": "m s-1",
                "long_name": "meridional total surface current",
                "standard_name": "northward_sea_water_velocity",
            },
        ),
        (
            "ug",
            {
                "units": "m s-1",
                "long_name": "zonal geostrophic surface current",
                "standard_name": "geostrophic_eastward_sea_water_velocity",
            },
        ),
        (
            "vg",
            {
                "units": "m s-1",
                "long_name": "meridional geostrophic surface current",
                "standard_name": "geostrophic_northward_sea_water_velocity",
            },
        ),
    ]:
        if var not in ds_raw:
            print(f"  WARNING: {var} not found in OSCAR, skipping")
            continue
        da = ds_raw[var].squeeze(drop=True)
        da = _regrid(da)  # → (time, lat, lon)
        da = da.reindex(time=_target_times())
        # Reference file has dims (time, longitude, latitude) — transpose to match
        da = da.transpose("time", "lon", "lat")
        da.attrs.update(attrs)
        out_vars[var] = da
        _report(da, f"OSCAR/{var}")

    ds_out = xr.Dataset(out_vars)
    # Add lat/lon as non-dim coordinate variables (as in reference)
    ds_out["lat"] = xr.DataArray(TARGET_LAT, dims="lat")
    ds_out["lon"] = xr.DataArray(TARGET_LON, dims="lon")

    out = OUT_DIR / f"oscar_currents_nio_{DATE_TAG}.nc"
    ds_out.to_netcdf(out)
    print(f"  → {out}")
    ds_raw.close()


# ── CCMP winds ───────────────────────────────
def download_winds():
    """
    Source : CCMP_WINDS_10M6HR_L4_V3.1  (6-hourly)
    Output : wind_ccmp_{DATE_TAG}_0_25deg.nc
             Dims   → (time:16, latitude:101, longitude:241)
             Vars   → uwnd, vwnd, ws  [m/s]
             ws = sqrt(uwnd² + vwnd²)  — wind speed derived from daily-mean components
    """
    print(f"\n[CCMP] {START_DATE} → {END_DATE}")
    files = _podaac_download(CCMP_COLLECTION, "ccmp")
    ds_raw = _open_many(files)
    ds_raw = _standardize_coords(ds_raw)
    ds_raw = _select_bbox(ds_raw)

    out_vars = {}
    for raw_name, out_name in [("uwnd", "uwnd"), ("vwnd", "vwnd")]:
        if raw_name not in ds_raw:
            raise KeyError(
                f"{raw_name!r} not in CCMP dataset. "
                f"Available: {list(ds_raw.data_vars)}"
            )
        da = ds_raw[raw_name].squeeze(drop=True)
        # 6-hourly → daily mean
        da = da.sortby("time").resample(time="1D").mean()
        da = _regrid(da)
        da = da.reindex(time=_target_times())
        da = da.rename({"lat": "latitude", "lon": "longitude"})
        out_vars[out_name] = da
        _report(da, f"CCMP/{out_name}")

    # Derive wind speed
    ws = np.sqrt(out_vars["uwnd"] ** 2 + out_vars["vwnd"] ** 2)
    ws.name = "ws"
    out_vars["ws"] = ws

    ds_out = xr.Dataset(out_vars)
    out = OUT_DIR / f"wind_ccmp_{DATE_TAG}_0_25deg.nc"
    ds_out.to_netcdf(out)
    print(f"  → {out}")
    ds_raw.close()


# ════════════════════════════════════════════
# MAIN
# ════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 60)
    print(f"Downloading NIO ocean data for: {START_DATE} → {END_DATE}")
    print(f"Domain : {WEST}°E – {EAST}°E, {SOUTH}°N – {NORTH}°N")
    print(f"Grid   : {RESOLUTION}° × {RESOLUTION}°")
    print("=" * 60)

    # ── Copernicus (no special login needed; uses env vars) ──
    download_sst()
    download_sss()
    download_ssh()

    # ── NASA Earthdata ────────────────────────────────────────
    _earthaccess_login()
    download_currents()
    download_winds()

    print("\n✓ All downloads complete.")
    print(f"  Output dir: {OUT_DIR.resolve()}")
