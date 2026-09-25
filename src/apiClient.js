/**
 * OceanEmbed API Service — Frontend connection to FastAPI backend.
 */

const API_BASE_URL = 'http://localhost:8000/api/v1';

// ─── Main inference endpoint ──────────────────────────────────────────────────
/**
 * Send a map-click to the backend and get real model predictions.
 *
 * @param {object} params
 * @param {number} params.latitude
 * @param {number} params.longitude
 * @param {string} params.datetime  ISO-8601 string (e.g. new Date().toISOString())
 * @returns {Promise<object|null>}  PredictResponse or null on failure
 */
export async function fetchInferencePrediction({ latitude, longitude, datetime }) {
  const response = await fetch(`${API_BASE_URL}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ latitude, longitude, datetime }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `API error ${response.status}`);
  }

  return await response.json();
}

// ─── Legacy forecast endpoint (kept for compatibility) ────────────────────────
export async function fetchForecastPrediction({ latitude, longitude, depth, forecastDays }) {
  try {
    const response = await fetch(`${API_BASE_URL}/forecast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude, longitude, depth, forecast_days: forecastDays }),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// ─── Health & data-status ─────────────────────────────────────────────────────
export async function fetchBackendHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function fetchBackendDataStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}/data-status`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
