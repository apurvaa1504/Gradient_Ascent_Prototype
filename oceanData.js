/**
 * oceanData.js
 * ---------------------------------------------------------------------------
 * This is the ONLY file that talks to "the backend". Every function here is
 * a mock that returns realistic-shaped data with a fake network delay.
 *
 * When you're ready to wire up your real FastAPI service, replace the body
 * of each function with a `fetch(...)` call that returns the same shape.
 * Nothing in the components needs to change if you keep the return shapes.
 * ---------------------------------------------------------------------------
 */

export const STANDARD_DEPTHS = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000];

export const SURFACE_VARIABLES = [
  { id: "sst", label: "Sea Surface Temp (SST)", unit: "°C", source: "OSTIA · Daily" },
  { id: "sss", label: "Sea Surface Salinity (SSS)", unit: "PSU", source: "SMAP/SMOS · Daily" },
  { id: "ssh", label: "Sea Surface Height (SSH)", unit: "m", source: "DUACS · Daily" },
  { id: "currents", label: "Surface Currents", unit: "m/s", source: "OSCAR · Daily" },
  { id: "winds", label: "Surface Winds", unit: "m/s", source: "CCMP/ASCAT · Daily" },
  { id: "temp", label: "Reconstructed Subsurface Temp", unit: "°C", source: "Model Output" },
];

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

/**
 * TODO(replace): GET {API_BASE}/profile?lat=..&lon=..&date=..
 * Expected real response shape:
 * {
 *   lat, lon, date,
 *   depths: number[],       // meters, same order as STANDARD_DEPTHS
 *   temperature: number[],  // °C, same length as depths
 *   mld_m: number,          // mixed layer depth
 *   isotherm26_m: number | null
 * }
 */
export async function fetchTemperatureProfile(lat, lon, dayIndex = 0) {
  await delay(350);

  const sst = 29.5 - 0.09 * (lat - 5.0) + Math.sin(lon / 10) * 0.6;
  const mld = 35 + 10 * Math.cos(lat / 6);
  const thermoclineScale = 130 + 20 * Math.sin(lon / 8);
  const abyssal = 3.6;

  const temperature = STANDARD_DEPTHS.map((d) => {
    if (d <= mld) return +(sst - (d / mld) * 0.4).toFixed(2);
    return +(abyssal + (sst - abyssal) * Math.exp(-(d - mld) / thermoclineScale)).toFixed(2);
  });

  const isothermIdx = temperature.findIndex((t) => t <= 26);
  const isotherm26_m = isothermIdx > 0 ? STANDARD_DEPTHS[isothermIdx] : null;

  return {
    lat,
    lon,
    dayIndex,
    depths: STANDARD_DEPTHS,
    temperature,
    mld_m: +mld.toFixed(1),
    isotherm26_m,
  };
}

/**
 * TODO(replace): GET {API_BASE}/layer?variable=..&depth=..&date=..
 * Real response is likely a gridded raster (PNG tile, GeoTIFF, or base64 PNG)
 * for the map overlay, plus a min/max for the legend. Shape suggestion:
 * { variable, depth_m, date, imageUrl | base64Png, min, max, unit }
 */
export async function fetchLayerMeta(variableId, depthM) {
  await delay(150);
  const ranges = {
    sst: [24, 32],
    sss: [32, 36.5],
    ssh: [-0.2, 1.1],
    currents: [0, 1.4],
    winds: [2, 14],
    temp: [4, 30],
  };
  const [min, max] = ranges[variableId] ?? [0, 1];
  return { variable: variableId, depth_m: depthM, min, max };
}

/**
 * TODO(replace): GET {API_BASE}/argo/active
 * Real response: list of currently assimilated ARGO floats used for
 * validation, with observed vs. model surface temperature.
 */
export async function fetchArgoFloats() {
  await delay(250);
  return [
    { id: "ARGO-IN-2902741", lat: 14.5, lon: 68.2, tempObs: 28.6 },
    { id: "ARGO-IN-2902742", lat: 11.2, lon: 56.4, tempObs: 26.2 },
    { id: "ARGO-IN-2902743", lat: 16.0, lon: 88.5, tempObs: 29.4 },
    { id: "ARGO-IN-2902744", lat: 10.5, lon: 73.2, tempObs: 28.9 },
    { id: "ARGO-IN-2902745", lat: 18.2, lon: 65.8, tempObs: 28.1 },
  ];
}

/**
 * TODO(replace): GET {API_BASE}/scorecard?depth=..
 * Real response: validation skill metrics against independent ARGO/GLORYS.
 */
export async function fetchScorecard() {
  await delay(200);
  return [
    { depth_m: 0, correlation: 0.97, rmse: 0.31, bias: 0.04 },
    { depth_m: 50, correlation: 0.94, rmse: 0.52, bias: -0.08 },
    { depth_m: 100, correlation: 0.9, rmse: 0.71, bias: 0.11 },
    { depth_m: 200, correlation: 0.85, rmse: 0.88, bias: -0.15 },
    { depth_m: 500, correlation: 0.79, rmse: 1.02, bias: 0.06 },
  ];
}

/**
 * TODO(replace): health check GET {API_BASE}/health
 */
export async function checkBackendHealth() {
  await delay(100);
  return { online: false }; // flips the HUD status pill; wire this to your real health check
}
