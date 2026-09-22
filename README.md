# Subsurface Ocean Twin — Frontend

A React rebuild of the "OceanEmbed-X" dashboard you shared, kept in the same
visual language (dark glass panels, cyan accents, floating HUD) but restructured
for your actual problem statement: reconstructing depth-wise subsurface
temperature (0–1000 m) from surface satellite observations over the
North Indian Ocean.

## Run it

```bash
cd frontend
npm install
npm run dev
```

## What changed from the reference file, and why

| Reference (`app.js`/`style.css`) | This scaffold | Why |
|---|---|---|
| Vanilla JS + global functions + Leaflet | React components + hooks | You said React is fine; also makes it maintainable/testable |
| Hardcoded Gaussian "basin" math faking SST/currents/TCHP | `src/api/oceanData.js` — isolated mock functions | One file to replace with real `fetch()` calls; nothing else changes |
| "OceanEmbed-X" / SIH branding, cyclone tracker, float deployment modal, PFZ/OOSA tab | Removed | Not part of your PS; added complexity with no payoff |
| Fake ARGO float list, fake cyclone tracks | Kept as one small mock (`fetchArgoFloats`) for the validation-float markers your PS actually calls for | Your PS explicitly uses gridded ARGO for validation |
| Canvas raster rendering for map overlays | Left as a TODO (`fetchLayerMeta` returns only min/max for the legend) | Real raster rendering depends entirely on what your API returns (PNG tile? GeoTIFF? raw grid?) — see below |
| 15 depth levels, daily timeline | Kept | Matches your PS's standard depths and daily resolution exactly |

## Where to plug in your real backend

Everything lives in **`src/api/oceanData.js`**. Each function has a `TODO(replace)`
comment showing the expected request/response shape. Example:

```js
export async function fetchTemperatureProfile(lat, lon, dayIndex = 0) {
  const res = await fetch(
    `${API_BASE}/profile?lat=${lat}&lon=${lon}&day=${dayIndex}`
  );
  return res.json(); // must match: { depths, temperature, mld_m, isotherm26_m }
}
```

No component file needs to change as long as the return shape stays the same.

## The one piece that needs a real design decision: map rasters

The reference file draws colored ocean fields with hand-rolled Canvas code fed
by fake math. That approach doesn't transfer to real gridded model output.
Once your API is ready, tell me which of these it returns and I'll wire the
actual raster layer in `MapView.jsx`:

1. **Pre-rendered PNG/tile per variable+depth+day** → drop straight into a
   Leaflet `ImageOverlay` or `TileLayer`.
2. **Raw grid (2D array of lat/lon/value)** → render client-side onto an
   HTML5 canvas overlay (I can port the reference's canvas logic, replacing
   the fake math with your real grid).
3. **GeoTIFF** → use `georaster` + `georaster-layer-for-leaflet`.

## File structure

```
frontend/
  src/
    api/oceanData.js       ← replace mocks with real fetch calls (only file)
    components/
      TopHud.jsx
      LeftDrawer.jsx        ← variable + depth selection
      RightDrawer.jsx        ← profile chart + validation scorecard
      ProfileChart.jsx        ← depth vs. temperature line chart
      MapView.jsx              ← Leaflet map, click-to-query, ARGO markers
      MapLegend.jsx
      TimelineBar.jsx
    App.jsx
    main.jsx
    styles.css
```
