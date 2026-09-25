"""
FastAPI application — OceanEmbed backend inference server.

Start with:
    cd backend
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

from __future__ import annotations

import json
import logging
import os
import time
from contextlib import asynccontextmanager

import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator

# Load .env before importing anything that reads env vars
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

from inference import DEPTHS_M, fetch_raw_source_data, run_inference
from model_loader import MODEL, load_model
from regridder import MASTER_LATS, MASTER_LONS

# Suppress noisy 3rd party loggers for clean terminal output
for quiet_name in ("copernicusmarine", "urllib3", "requests", "fsspec", "asyncio", "netCDF4", "xarray"):
    logging.getLogger(quiet_name).setLevel(logging.WARNING)

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s | %(levelname)-7s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("OceanEmbed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=== OceanEmbed backend starting ===")
    load_model()
    logger.info("Model loaded on device: %s", MODEL.device)
    yield
    logger.info("=== OceanEmbed backend shutting down ===")


app = FastAPI(
    title="OceanEmbed Inference API",
    description=(
        "Real-time subsurface ocean temperature reconstruction "
        "using multi-source satellite data and UNetOcean3D."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
_raw_origins = os.getenv("CORS_ORIGINS", '["http://localhost:5173","http://localhost:3000"]')
try:
    _origins = json.loads(_raw_origins)
except json.JSONDecodeError:
    _origins = ["http://localhost:5173", "http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response schemas ────────────────────────────────────────────────
class PredictRequest(BaseModel):
    latitude: float
    longitude: float
    datetime: str   # ISO-8601 string sent from the frontend

    @field_validator("latitude")
    @classmethod
    def validate_lat(cls, v: float) -> float:
        if not (5.0 <= v <= 30.0):
            raise ValueError(
                f"latitude {v} is outside the North Indian Ocean model domain "
                "(5°N – 30°N)."
            )
        return round(v, 4)

    @field_validator("longitude")
    @classmethod
    def validate_lon(cls, v: float) -> float:
        if not (45.0 <= v <= 105.0):
            raise ValueError(
                f"longitude {v} is outside the North Indian Ocean model domain "
                "(45°E – 105°E)."
            )
        return round(v, 4)


class PredictResponse(BaseModel):
    latitude: float
    longitude: float
    lat_grid: float          # snapped to nearest 0.25° master-grid point
    lon_grid: float
    datetime: str
    depths_m: list[float]
    temperatures_degC: list[float]
    data_sources: dict
    inference_time_ms: float


# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.get("/api/v1/health", tags=["meta"])
async def health():
    """Liveness check — also reports model and credential status."""
    cmems_ok = bool(
        os.environ.get("CMEMS_USERNAME") and os.environ.get("CMEMS_PASSWORD")
    )
    return {
        "status": "ok",
        "model_loaded": MODEL.model is not None,
        "device": str(MODEL.device) if MODEL.device else None,
        "n_days_window": MODEL.n_days,
        "cmems_credentials": "configured" if cmems_ok else "MISSING — set CMEMS_USERNAME / CMEMS_PASSWORD in .env",
    }


@app.get("/api/v1/data-status", tags=["meta"])
async def data_status():
    """Reports which data sources are configured."""
    cmems_ok = bool(
        os.environ.get("CMEMS_USERNAME") and os.environ.get("CMEMS_PASSWORD")
    )
    return {
        "cmems_sst":     {"configured": cmems_ok, "requires_auth": True},
        "smap_sss":      {"configured": True, "requires_auth": True,  "note": "NASA Earthdata/earthaccess (EARTHDATA_USERNAME/PASSWORD or ~/.netrc)"},
        "cmems_ssh":     {"configured": cmems_ok, "requires_auth": True},
        "oscar_currents":{"configured": True, "requires_auth": True,  "note": "NASA Earthdata/earthaccess — OSCAR v2.0 NRT via PO.DAAC"},
        "cmems_winds":   {"configured": cmems_ok, "requires_auth": True},
    }


@app.post("/api/v1/predict", response_model=PredictResponse, tags=["inference"])
async def predict(req: PredictRequest):
    """
    Main inference endpoint.

    The frontend sends latitude, longitude and the current datetime.
    The backend fetches 16 days of real ocean surface observations from
    five independent sources, assembles the input tensor, runs the
    UNetOcean3D model, and returns the 15-depth temperature profile.
    """
    if MODEL.model is None:
        raise HTTPException(503, "Model is not loaded yet. Try again in a moment.")

    t0 = time.perf_counter()

    try:
        result = await run_inference(
            lat=req.latitude,
            lon=req.longitude,
            target_datetime_str=req.datetime,
        )
    except RuntimeError as exc:
        logger.error("Inference error: %s", exc)
        raise HTTPException(503, str(exc))
    except Exception as exc:
        logger.exception("Unexpected inference failure")
        raise HTTPException(500, f"Inference failed unexpectedly: {exc}")

    elapsed_ms = (time.perf_counter() - t0) * 1000

    # Snap input coordinates to the nearest master-grid point
    lat_idx = int(np.argmin(np.abs(MASTER_LATS - req.latitude)))
    lon_idx = int(np.argmin(np.abs(MASTER_LONS - req.longitude)))

    return PredictResponse(
        latitude=req.latitude,
        longitude=req.longitude,
        lat_grid=float(MASTER_LATS[lat_idx]),
        lon_grid=float(MASTER_LONS[lon_idx]),
        datetime=req.datetime,
        depths_m=DEPTHS_M,
        temperatures_degC=[round(float(t), 3) for t in result["temperatures"]],
        data_sources=result["data_sources"],
        inference_time_ms=round(elapsed_ms, 1),
    )


@app.post("/api/v1/inspect-sources", tags=["debug"])
async def inspect_sources(req: PredictRequest):
    """
    Debug endpoint — fetches raw values from all 5 sources (SST, SSS, SSH, currents, winds)
    for the 16-day window without passing through the model.
    """
    try:
        return await fetch_raw_source_data(
            lat=req.latitude,
            lon=req.longitude,
            target_datetime_str=req.datetime,
        )
    except RuntimeError as exc:
        raise HTTPException(503, str(exc))
    except Exception as exc:
        logger.exception("Failed to inspect sources")
        raise HTTPException(500, f"Source retrieval failed: {exc}")


@app.get("/api/v1/inspect-sources", tags=["debug"])
async def inspect_sources_get(
    latitude: float = 15.0,
    longitude: float = 70.0,
    datetime: str = "2024-01-16T00:00:00Z",
):
    """
    GET version of debug endpoint for easy testing via browser or curl.
    """
    req = PredictRequest(latitude=latitude, longitude=longitude, datetime=datetime)
    return await inspect_sources(req)

