/**
 * OceanEmbed API Service — Frontend Connection to FastAPI Backend
 */

const API_BASE_URL = 'http://localhost:8000/api/v1';

/**
 * Fetch forecast prediction from backend POST /api/v1/forecast
 */
export async function fetchForecastPrediction({ latitude, longitude, depth, forecastDays }) {
  try {
    const response = await fetch(`${API_BASE_URL}/forecast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        latitude,
        longitude,
        depth,
        forecast_days: forecastDays,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.warn('Failed to fetch forecast from backend, falling back:', error);
    return null;
  }
}

/**
 * Fetch backend service health status
 */
export async function fetchBackendHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  }
}

/**
 * Fetch dataset availability status
 */
export async function fetchBackendDataStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}/data-status`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  }
}
