/**
 * PFZ Data Service — Thermocline-Enhanced Potential Fishing Zone
 * Team Gradient Ascent — SIH 2026 (PS-26066)
 *
 * ─── MOCK DATA LAYER ───
 * This file isolates all PFZ data so it can be replaced
 * with a real API call (e.g., INCOIS PFZ service) without
 * touching any UI component.
 *
 * Each PFZ zone entry:
 *   id              — unique zone identifier e.g. "PFZ-01"
 *   label           — human-readable name for tooltip
 *   region          — named sea area
 *   potential       — "high" | "moderate" | "low"
 *   thermoclineDepth— detected thermocline top depth (m)
 *   chlorophyll     — surface chlorophyll-a (mg/m³)
 *   sst             — sea surface temperature (°C)
 *   centroid        — [lat, lon] geographic center of zone
 *   polygon         — array of [lat, lon] vertices (counter-clockwise)
 *   depthProfile    — representative T(z) for the card chart
 *
 * COORDINATE CONVENTIONS match the existing project:
 *   Lat: 5–30°N, Lon: 45–105°E (North Indian Ocean domain)
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build an ellipse-like polygon around a centroid */
function makeEllipse(lat, lon, dlat, dlon, nPoints = 18) {
  const pts = [];
  for (let i = 0; i <= nPoints; i++) {
    const theta = (i / nPoints) * 2 * Math.PI;
    pts.push([lat + dlat * Math.cos(theta), lon + dlon * Math.sin(theta)]);
  }
  return pts;
}

/** Build an irregular polygon from offsets relative to a centroid */
function makeIrregular(lat, lon, offsets) {
  return offsets.map(([dlat, dlon]) => [lat + dlat, lon + dlon]);
}

// ─── Mock PFZ Zones (Arabian Sea / North Indian Ocean) ───────────────────────

export const PFZ_ZONES = [
  // ── HIGH POTENTIAL ──────────────────────────────────────────────────────────

  {
    id: 'PFZ-01',
    label: 'Lakshadweep Upwelling Cell',
    region: 'Arabian Sea',
    potential: 'high',
    thermoclineDepth: 38,
    chlorophyll: 1.94,
    sst: 27.6,
    centroid: [11.5, 72.0],
    polygon: makeIrregular(11.5, 72.0, [
      [1.2, -1.0], [1.4, 0.0], [1.1, 1.2], [0.4, 1.8],
      [-0.5, 1.6], [-1.3, 0.8], [-1.5, -0.3], [-1.0, -1.2],
      [-0.1, -1.9], [0.8, -1.7], [1.2, -1.0]
    ]),
    depthProfile: [
      { depth: 0,   temp: 27.6 },
      { depth: 25,  temp: 27.1 },
      { depth: 38,  temp: 24.2 }, // thermocline
      { depth: 50,  temp: 21.8 },
      { depth: 75,  temp: 18.5 },
      { depth: 100, temp: 15.9 },
    ],
  },

  {
    id: 'PFZ-02',
    label: 'Somali Current Divergence',
    region: 'Arabian Sea',
    potential: 'high',
    thermoclineDepth: 42,
    chlorophyll: 2.11,
    sst: 26.9,
    centroid: [10.8, 53.5],
    polygon: makeIrregular(10.8, 53.5, [
      [1.0, -0.8], [1.3, 0.2], [0.9, 1.4], [0.0, 1.9],
      [-0.8, 1.5], [-1.4, 0.5], [-1.3, -0.8], [-0.5, -1.6],
      [0.5, -1.7], [1.0, -0.8]
    ]),
    depthProfile: [
      { depth: 0,   temp: 26.9 },
      { depth: 20,  temp: 26.3 },
      { depth: 42,  temp: 22.7 }, // thermocline
      { depth: 60,  temp: 19.8 },
      { depth: 100, temp: 15.2 },
      { depth: 150, temp: 11.4 },
    ],
  },

  {
    id: 'PFZ-03',
    label: 'Gulf of Oman Upwelling',
    region: 'Arabian Sea',
    potential: 'high',
    thermoclineDepth: 35,
    chlorophyll: 1.78,
    sst: 27.2,
    centroid: [23.5, 58.5],
    polygon: makeEllipse(23.5, 58.5, 1.0, 1.6),
    depthProfile: [
      { depth: 0,   temp: 27.2 },
      { depth: 25,  temp: 26.6 },
      { depth: 35,  temp: 23.5 }, // thermocline
      { depth: 50,  temp: 20.9 },
      { depth: 75,  temp: 17.3 },
      { depth: 100, temp: 14.8 },
    ],
  },

  // ── MODERATE POTENTIAL ───────────────────────────────────────────────────────

  {
    id: 'PFZ-04',
    label: 'West India Coastal Bloom',
    region: 'Arabian Sea',
    potential: 'moderate',
    thermoclineDepth: 52,
    chlorophyll: 1.22,
    sst: 28.4,
    centroid: [15.8, 73.5],
    polygon: makeEllipse(15.8, 73.5, 1.1, 0.9),
    depthProfile: [
      { depth: 0,   temp: 28.4 },
      { depth: 30,  temp: 28.0 },
      { depth: 52,  temp: 24.8 }, // thermocline
      { depth: 75,  temp: 22.1 },
      { depth: 100, temp: 18.7 },
      { depth: 150, temp: 14.2 },
    ],
  },

  {
    id: 'PFZ-05',
    label: 'Bay of Bengal NE Cyclonic Eddy',
    region: 'Bay of Bengal',
    potential: 'moderate',
    thermoclineDepth: 45,
    chlorophyll: 1.05,
    sst: 28.9,
    centroid: [14.2, 86.5],
    polygon: makeEllipse(14.2, 86.5, 1.3, 1.7),
    depthProfile: [
      { depth: 0,   temp: 28.9 },
      { depth: 25,  temp: 28.5 },
      { depth: 45,  temp: 25.6 }, // thermocline
      { depth: 75,  temp: 22.8 },
      { depth: 100, temp: 19.4 },
      { depth: 150, temp: 14.9 },
    ],
  },

  {
    id: 'PFZ-06',
    label: 'Sri Lanka Dome',
    region: 'Bay of Bengal',
    potential: 'moderate',
    thermoclineDepth: 48,
    chlorophyll: 1.18,
    sst: 29.1,
    centroid: [8.5, 84.0],
    polygon: makeIrregular(8.5, 84.0, [
      [0.8, -1.4], [1.1, 0.0], [0.7, 1.3], [-0.1, 1.7],
      [-1.0, 1.1], [-1.3, -0.2], [-0.8, -1.4], [0.8, -1.4]
    ]),
    depthProfile: [
      { depth: 0,   temp: 29.1 },
      { depth: 30,  temp: 28.7 },
      { depth: 48,  temp: 25.9 }, // thermocline
      { depth: 75,  temp: 22.5 },
      { depth: 100, temp: 19.1 },
      { depth: 150, temp: 14.6 },
    ],
  },

  // ── LOW / UNCERTAIN POTENTIAL ────────────────────────────────────────────────

  {
    id: 'PFZ-07',
    label: 'Central Arabian Sea (Uncertain)',
    region: 'Arabian Sea',
    potential: 'low',
    thermoclineDepth: 68,
    chlorophyll: 0.41,
    sst: 29.8,
    centroid: [17.0, 63.0],
    polygon: makeEllipse(17.0, 63.0, 1.5, 2.0),
    depthProfile: [
      { depth: 0,   temp: 29.8 },
      { depth: 40,  temp: 29.2 },
      { depth: 68,  temp: 26.1 }, // thermocline
      { depth: 100, temp: 22.3 },
      { depth: 150, temp: 17.1 },
    ],
  },

  {
    id: 'PFZ-08',
    label: 'Mid-Bay Diffuse Zone',
    region: 'Bay of Bengal',
    potential: 'low',
    thermoclineDepth: 58,
    chlorophyll: 0.52,
    sst: 29.5,
    centroid: [12.5, 90.0],
    polygon: makeEllipse(12.5, 90.0, 1.2, 1.8),
    depthProfile: [
      { depth: 0,   temp: 29.5 },
      { depth: 35,  temp: 29.1 },
      { depth: 58,  temp: 26.4 }, // thermocline
      { depth: 80,  temp: 23.7 },
      { depth: 120, temp: 18.9 },
    ],
  },
];

// ─── Potential config for colors / display ────────────────────────────────────

export const PFZ_POTENTIAL_CONFIG = {
  high: {
    label: 'High Potential Zone',
    fillColor: 'rgba(255, 184, 0, 0.35)',
    strokeColor: '#FFC107',
    glowColor: 'rgba(255, 193, 7, 0.75)',
    strokeWidth: 2.8,
    textColor: '#FFD54F',
    dotColor: '#FFC107',
    dotFilled: true,
  },
  moderate: {
    label: 'Moderate Potential Zone',
    fillColor: 'rgba(236, 72, 153, 0.30)',
    strokeColor: '#F472B6',
    glowColor: 'rgba(244, 114, 182, 0.65)',
    strokeWidth: 2.2,
    textColor: '#F472B6',
    dotColor: '#F472B6',
    dotFilled: true,
  },
  low: {
    label: 'Low / Uncertain Zone',
    fillColor: 'rgba(255, 255, 255, 0.12)',
    strokeColor: '#F1F5F9',
    glowColor: 'rgba(255, 255, 255, 0.35)',
    strokeWidth: 1.8,
    textColor: '#CBD5E1',
    dotColor: '#CBD5E1',
    dotFilled: false,
  },
};

// ─── API Stub (replace this with real API call later) ─────────────────────────

/**
 * getPFZZones(forecastDays)
 *
 * Returns PFZ zones for the given forecast lead.
 * Currently returns the same mock dataset for all leads.
 * Replace the body of this function with a real fetch() call:
 *
 *   const res = await fetch(`/api/pfz?lead=${forecastDays}`);
 *   return res.json();
 */
export function getPFZZones(forecastDays = 0) {
  // Mock: all forecast leads use the same zone geometries.
  // A real implementation would offset/update thermocline depths
  // and chlorophyll values per forecast lead time.
  void forecastDays; // acknowledged — future use
  return Promise.resolve(PFZ_ZONES);
}
