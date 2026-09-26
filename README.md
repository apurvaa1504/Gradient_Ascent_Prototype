# Team Gradient Ascent Prototype

It is a full-stack ocean intelligence prototype for the North Indian Ocean. It combines a FastAPI-based inference backend, a React + Leaflet GIS frontend, and a physics-aware deep learning workflow to reconstruct subsurface ocean temperature structure from multi-satellite surface observations.

The application is designed to solve a practical operational problem: surface satellites can see only the skin of the ocean, while the subsurface thermocline and deep thermal structure are often missing. It maps a 16-day sequence of atmospheric and ocean-surface variables into a 15-layer temperature reconstruction spanning 0 m to 1000 m over the North Indian Ocean domain.

The product currently includes three visible application experiences:

1. Main Ocean Map Dashboard
2. TCHP Intelligence Dashboard
3. OTEC Intelligence Platform

Each page is styled as a dark monitoring dashboard with marine scientific UI patterns, layered map overlays, glowing telemetry elements, and color-coded decision support metrics.

---

## 1. Project Overview and Scope

### Domain and objective
- Geographic domain: 5°N to 30°N and 45°E to 105°E
- Grid resolution: 0.25° x 0.25°
- Temporal window used by the backend logic: 16-day rolling window
- Output depths: 0, 10, 20, 30, 50, 75, 100, 150, 200, 300, 400, 500, 700, 850, 1000 m
- Main aim: subsurface ocean temperature reconstruction, acoustic propagation awareness, thermal resource analysis, and decision support for marine energy and cyclone-risk interpretation

### Data inputs modeled by the app
- SST: Sea surface temperature
- SSS: Sea surface salinity
- SSH: Sea surface height anomaly
- U-current and V-current: surface currents
- U-wind and V-wind: surface wind vectors

### Functional goals
- Inspect any ocean point in the study region
- Observe reconstructed temperature profiles at multiple depths
- Evaluate thermal gradient, thermocline changes, TCHP, and marine heatwave context
- Show site viability for OTEC energy generation
- Show tactical ocean heat diagnostics using TCHP-style decision cards

---

## 2. System Architecture

### Frontend stack
- React 19
- Vite
- Leaflet + react-leaflet
- Tailwind CSS
- d3-geo and topojson-client for coastline processing
- HTML5 Canvas for thermal rendering and grid overlays
- Lucide React icons

### Backend stack
- FastAPI + Uvicorn
- Python 3.10+
- PyTorch
- NumPy and SciPy
- xarray and netCDF4
- copernicusmarine
- earthaccess

### ML architecture concept
The inference system implements a UNet-style 3D-to-2D spatiotemporal encoder-decoder pattern:

- Input tensor: 7 channels x 16 days x spatial grid
- Channels include SST, SSS, SSH, U/V currents, and U/V winds
- Spatial domain is the North Indian Ocean at 0.25° resolution
- Output is a 15-depth temperature field for the same geospatial grid
- Model logic uses 3D encoder blocks, temporal collapse, and 2D decoder reconstruction
- Attention logic uses a CBAM-style mechanism for channel and spatial focus

### Data and model pipeline
- Multi-source data ingestion from CMEMS and NASA Earthdata sources
- Regridding to a master 0.25° North Indian Ocean grid
- Normalization and denormalization using saved model statistics
- Inference through FastAPI endpoints
- Frontend query sends coordinates and returns subsurface temperature profile

### API endpoints
- GET /api/v1/health
- GET /api/v1/data-status
- POST /api/v1/predict
- POST /api/v1/inspect-sources

---

## 3. Main Application Page: Ocean Map Dashboard

This is the primary interactive page mapped at the root route: /.

### Purpose
This page acts like a Copernicus-style scientific ocean dashboard. It is a map-first environment where the user can click any ocean cell, inspect its reconstructed thermal profile, compare model output to climatological reference, and evaluate subsurface conditions.

### Layout and visible UI elements

#### Top header
At the top of the map, the dashboard shows:
- Logo and title
- scientific subtitle: "AI Subsurface Ocean 3D Reconstruction"
- domain label: "North Indian Ocean (5°N–30°N, 45°E–105°E)"
- depth indicator: "15 Depths (0–1000m)"
- event label: "SIH 2026 · PS-26066"
- OTEC Intelligence Platform button
- TCHP Intelligence button

#### Left panel: layer selector card
A floating card in the upper-left side displays:
- title: "Sea water potential temperature (thetao)"
- depth metadata such as "Surface (0m)" or "100m depth"
- year and daily grid text
- a gradient legend bar with magma/inferno colors from dark violet to golden yellow
- forecast lead mode buttons:
  - Now
  - +1d
  - +2d
  - +3d
  - +7d
  - +14d
- grid opacity slider with percentage value

#### Map background and overlays
The map contains these layers in order:
- Dark ArcGIS-style world basemap
- thermal ocean heatmap canvas at z-level 10
- land mask at z-level 12
- 0.25° grid overlay at z-level 15
- click probe marker at z-level 20
- floating UI overlays above the map

#### Right utility toolbar
A vertical floating toolbar on the right side includes:
- point probe tool
- show/hide 0.25° grid toggle
- download / data export option
- tooltips appear on hover for each action

#### Right depth selector
A vertical depth selector panel shows multiple ocean depths:
- 0 m (SST)
- 5 m
- 10 m
- 20 m
- 30 m
- 50 m
- 75 m
- 100 m
- 125 m
- 150 m
- 200 m
- 300 m
- 500 m
- 700 m
- 1000 m

This selector updates the currently visualized depth and changes the thermal canvas accordingly.

#### Coordinate and HUD panel
A bottom-left HUD displays:
- selected probe coordinates in lat/lon
- cell index for the 0.25° grid if inside domain
- hover cell coordinates if user moves cursor over water
- region label: Arabian Sea or Bay of Bengal
- current temperature reading in °C

### Map behavior
- Clicking anywhere in open water selects a probe point
- The app snaps coordinates to the grid if enabled
- Hovering over the map updates the hovered cell and cell-level metadata
- A glowing cyan marker shows the active selected point
- If the selected point falls on land, the app shows a "No data" state instead of ocean metrics

### Thermal map styling
The heatmap uses a Copernicus-like magma palette:

- #0f0a28 / dark violet
- #301258
- #5c166e
- #912664
- #c84146
- #f27332
- #fdb955
- #fefab4

This palette is rendered on a canvas to display cold deep water in dark blue/violet and warm surface water in amber/yellow tones.

### Probe card details
When a valid ocean cell is clicked, a floating inspection card appears next to the clicked coordinate. This probe card contains these sections:

#### Header
- coordinate string like "70.000°E, 15.000°N"
- region badge: Bay of Bengal or Arabian Sea
- close button

#### Top telemetry row
- Reconstructed Potential Temp in °C
- Marine Heatwave status badge
- optional +Nday lead label

#### Tabs
The card has three main tabs:

1. 15-Depth Profile
   - vertical temperature profile T(z)
   - GLORYS12 dashed reference curve
   - thermocline highlight band
   - depth axis and temperature axis
   - rapid ΔT annotation
   - average / minimum / maximum summary values
   - TCHP card below it

2. ARGO Benchmark
   - model RMSE in °C
   - R² value
   - float ID reference
   - latency advantage concept
   - grid density comparison

3. 5 Satellite Inputs
   - SST
   - SSS
   - SSH anomaly
   - current speed
   - wind speed and wind direction

### Additional standout values in the probe card
- Marine heatwave classification text
- TCHP value in kJ/cm²
- "High Cyclone Intensity Risk" or "Low / Moderate Risk" label
- thermal profile summary data

### Land behavior
If the user clicks a land coordinate:
- the probe card does not show a temperature profile
- it renders a land/no-data visual panel with "No data" placeholders
- the interface preserves the scientific dashboard feel without displaying false ocean values

---

## 4. TCHP Intelligence Page

This page is accessible from the main app via the "TCHP Intelligence" button and is also used for the /tchp route.

### Purpose
This page demonstrates Tropical Cyclone Heat Potential (TCHP) analysis across the North Indian Ocean. It presents a determination-support interface rather than a deterministic storm forecast.

### Header and layout
The page includes:
- brand lockup: "SUBSURFACE INTELLIGENCE"
- region breadcrumb: Ocean Heat / TCHP Intelligence
- region selector dropdown
- mode switch: Forecaster vs Expert
- back button to return to the ocean map

### Main controls and page states
The TCHP page includes:
- region selection: Arabian Sea, Bay of Bengal, or full North Indian Ocean
- layer tabs:
  - TCHP
  - D26 depth
  - SST anomaly
  - 100m anomaly
  - Confidence
  - Currents
  - Cyclone corridor
- selected location point with profile inspection
- notification toast for user actions

### Map visualization
The map panel is a stylized SVG-based ocean heat map with:
- magenta/cyan/amber ocean surface background
- interpolation grid pattern
- approximate coastline silhouettes
- ocean corridor path
- markers for buoy and sampled locations
- hover tooltip showing:
  - location
  - TCHP in kJ/cm²
  - D26 depth in meters
  - confidence percentage
  - risk category

### Profile chart
The profile card contains a 15-depth plot showing:
- temperature vs depth
- climatology dashed line
- anomaly and thermocline markers
- D26, D20, thermocline, and temperature-defined layer overlays
- metric strip with TCHP, D26, D20, and confidence summary

### Trend chart
A 14-day TCHP trend chart shows the progression of heat support over time, including:
- polyline trend
- last-value highlight
- baseline percentage message
- textual interpretation note

### Expert data panel
This includes:
- table of depth observations with temperature, uncertainty, climatology, and delta difference
- copy CSV button for exporting the profile as CSV
- confidence breakdown by SST, SSS, SSH, current, wind, historical support, regional support
- surface signals used by the platform

### Corridor analysis panel
This panel simulates a cyclone path and shows:
- corridor point list on the left with labels
- TCHP, D26, SST, and confidence values for each point
- route summary panel for the selected corridor segment
- prototype-only disclaimer
- "Generate corridor brief" button

### Methodology card
The page includes a collapsible section titled "Methodology and interpretation" with:
- what TCHP means
- why it matters for cyclone support
- what it does not mean
- a simple process flow

### Design style on the TCHP page
- dark marine background
- amber, cyan, and white accent palette
- prototype stamp and caution belt
- glassy cards, dashboards, and tinted panels
- alert-style integrated support metric bar

---

## 5. OTEC Intelligence Platform

This is the site-level energy and freshwater analysis page mapped at /otec.

### High-level purpose
The OTEC page evaluates whether a location is operationally viable for ocean thermal energy conversion, based on the temperature difference between warm surface water and cold deep water. It focuses on:
- thermal gradient ΔT
- gross power output
- freshwater production potential
- plant viability decision logic
- site comparison ranking

### Main navigation tabs
The page has three primary tabs:

1. Today's Operations
2. Site Explorer
3. Future Site Ranking

### Page 1: Today's Operations

#### Top control row
This section contains:
- site drop-down selector
- date display
- forecast horizon selector
- model confidence status badge
- Download Daily Advisory button

#### KPI cards
The dashboard shows four KPI cards:

1. Thermal Gradient (ΔT)
   - shows the temperature difference between surface and cold-water intake depth
   - status label: VIABLE, MARGINAL, or ALERT
   - threshold bar for 20°C viability cutoff
   - descriptive text about whether the thermal resource is strong enough

2. Estimated Gross Power Output
   - shows power in kW
   - expected range text
   - small sparkline chart of the next 7 days

3. Estimated Freshwater Output
   - shows lakh liters/day or equivalent figure
   - expected range and comparison against previous day
   - tank fill-style indicator

4. Site ΔT Ranking
   - ranking of the current site among candidate sites
   - horizontal ranking marker strip
   - button to jump to candidate ranking

#### Decision advisory banner
A large decision banner explains whether the site is:
- strong
- marginal
- weak
and states whether normal OTEC operation, blended backup, or backup generation is recommended.

#### Ocean Fuel Profile chart
This is a vertical chart showing temperature as depth increases.
- X-axis: temperature in °C
- Y-axis: depth in meters
- warm surface water at 0 m
- cold-water intake at selected deep intake depth
- threshold reference line at 20°C
- annotated warm intake and cold intake points
- rapid gradient highlight and the available ΔT value

#### 7-Day Ocean Energy Forecast panel
This chart uses a composed line/area chart showing:
- ΔT over the next 7 days on the left Y-axis
- gross power over the next 7 days on the right Y-axis
- uncertainty bands for min/max values
- reference line at the 20°C viability threshold
- forecast callouts for monsoon cooling and high-confidence windows
- compact daily table with date, ΔT, gross power, freshwater, and operating decision

#### Power & Water History chart
This chart shows historical 30-day trend data for:
- freshwater output (bars)
- power output (line)
- target demand reference line

#### Thermal Risk Events panel
This panel shows timeline markers for:
- cold eddy event
- monsoon wind mixing event
- textual explanation of operational risk windows

#### Model Confidence panel
This shows the current confidence confidence in the model forecast across:
- 0–30 m surface layer
- 500–1000 m deep layer
with quality bars and ±°C error ranges

---

### Page 2: Site Explorer

This tab is a geospatial OTEC site analysis screen with map and filter controls.

#### Controls in the header row
- region selector: All / Lakshadweep / Andaman
- site selector dropdown
- period selector: Last 1 Year / 5-Year Climatology / Full Record
- intake depth selector: 500 m / 700 m / 1000 m
- plant capacity selector: 1 MW / 5 MW / 10 MW / 50 MW
- toggles for:
  - show bathymetry
  - show protected areas
  - show infrastructure

#### Map layer controls
This panel allows switching between:
- thermal gradient ΔT continuous map
- OTEC viability categorical map
- reliability percentage map
- minimum viable depth map

#### Geospatial map features
- candidate site pins on a Leaflet map
- selected site highlight
- bathymetry contour lines
- protected area overlays
- shipping route or infrastructure overlays
- comparison state through selected site markers

#### Site ranking and analytics in the explorer tab
The page includes a dynamic ranking calculation using thermal resource, reliability, pipe feasibility, infrastructure, and environmental constraints.

It contains charts and panels such as:
- monthly delta T by month
- tradeoff chart by intake depth
- seabed bathymetry profile and pipe route proxy
- site fit and viability metrics

#### Main chart elements in the site explorer page
- monthly thermal behavior chart for the selected site across Jan–Dec
- depth vs delta T / power / cost tradeoff chart
- bathymetry profile along a conceptual route
- candidate site summary data used for operational interpretation

---

### Page 3: Future Site Ranking

This tab is a strategic ranking dashboard for selecting the most promising OTEC sites.

#### Filter panel
The ranking page provides filters for:
- region
- minimum thermal gradient threshold
- minimum reliability threshold
- maximum pipe route length
- planned capacity
- exclusion of environmentally constrained zones

#### Decision weight adjustment panel
The user can adjust the relative weighting of:
- thermal resource quality
- reliability / persistence
- pipe feasibility
- infrastructure / demand access
- environmental compatibility

The sliders auto-normalize to a total of 100%.

#### Summary metrics cards
The page shows:
- total candidate sites analyzed
- number of high-potential sites
- best overall candidate site
- best thermal resource site
- lowest pipe-cost proxy site

#### Ranking table
The table includes these columns:
- compare checkbox
- rank
- site name
- suitability score
- mean ΔT
- worst-month ΔT
- viable days %
- recommended intake depth
- estimated pipe length
- estimated gross power
- environmental flag

The table supports sorting by each column.

#### Comparison charts
The ranking page includes multiple visual graphs:

1. Thermal Resource vs Pipe Feasibility Scatter Plot
   - X-axis: pipe length (km)
   - Y-axis: mean ΔT (°C)
   - bubble size/proxy indicates reliability
   - color indicates score tier
   - useful for identifying high-potential low-pipe sites

2. Year-Round Reliability Chart
   - top five sites ranked on thermally viable range
   - reference line at 20°C threshold
   - range-style bars showing min/max or seasonal spread

3. Why This Site Ranks Here
   - bar chart showing weighted contribution of thermal, reliability, pipe, infrastructure, environment, and overall score

4. Multi-Site Radar Comparison Chart
   - appears when 2 or 3 sites are selected in the compare table
   - compares thermal, reliability, pipe, infrastructure, and environmental performance side-by-side

#### Export and briefing features
- CSV export button for the filtered ranking table
- site briefing modal for a selected site
- environment summary for the chosen location

---

## 6. Design Language and Color System

### Core visual identity
The UI uses a dark marine-control-room aesthetic with scientific emphasis and high contrast for operational clarity.

### Main palette
- background: #02040a
- dark panels: #0c1017, #0B1B2B, #122A3E
- accent cyan: #2FB8C9 and #38bdf8
- highlight fuchsia: #f472b6
- warning amber: #E0A82E and #fbbf24
- danger red: #E0524D and #f43f5e
- success green: #3FBF7F
- text primary: #F2F6F8
- text secondary: #9FB3C4

### Thermal color scale
The thermal heatmap uses a magma/inferno palette that transitions from cold to hot:

#0f0a28 -> #301258 -> #5c166e -> #912664 -> #c84146 -> #f27332 -> #fdb955 -> #fefab4

This is applied to the main sea-temperature map so:
- cooler water = dark violet / blue tones
- warmer water = orange / yellow tones

### OTEC color system
The OTEC dashboard uses a more operational-control palette:
- background: #0B1B2B
- panel workspace: #122A3E
- accent teal: #2FB8C9
- status green: #3FBF7F
- status amber: #E0A82E
- status red: #E0524D
- text primary: #F2F6F8
- text secondary: #9FB3C4

### Design characteristics
- glassmorphism for overlays and floating panels
- crisp monospaced numbers for metrics and coordinates
- strong line separators and dark surfaces for readability
- cyan for live intelligence / active anomalies
- amber for heat and operational warnings
- red for risk and critical alert states
- green for viable / good operating conditions

---

## 7. Repository Structure

```text
Gradient_Ascent_Prototype/
├── backend/
│   ├── .env
│   ├── requirements.txt
│   ├── main.py
│   ├── inference.py
│   ├── model_def.py
│   ├── model_loader.py
│   ├── regridder.py
│   ├── data_download.py
│   └── sources/
│       ├── __init__.py
│       ├── cmems_common.py
│       ├── cmems_sst.py
│       ├── smap_sss.py
│       ├── cmems_ssh.py
│       ├── oscar_currents.py
│       ├── cmems_winds.py
│       └── date_utils.py
├── model/
│   └── checkpoints/
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── App.jsx
│   ├── App.css
│   ├── apiClient.js
│   ├── geoData.js
│   ├── index.css
│   ├── main.jsx
│   ├── simulation.js
│   ├── TchpPage.jsx
│   ├── tchp.css
│   ├── tchpInteractions.css
│   ├── tchpMockData.js
│   ├── tchpPhysics.js
│   ├── landmask.js
│   └── features/
│       └── otec/
│           ├── OtecApp.jsx
│           ├── otec-theme.ts
│           └── components/
│               ├── SiteExplorerTab.jsx
│               ├── FutureSiteRankingTab.jsx
│               └── SharedComponents.jsx
├── index.html
├── package.json
├── vite.config.js
├── README.md
├── catchErrors.js
└── .gitignore
```

---

## 8. Frontend Page Summary

### Main ocean map page features
- dark ocean dashboard UI
- interactive geospatial map
- depth-aware thermal overlays
- target probe selector
- 0.25° grid overlay and hover labels
- real-time model inference integration to the backend
- no-data land state
- thermocline and TCHP interpretation panels
- ML-driven subsurface temperature profile display

### TCHP page features
- map-based TCHP overview and selected location overlay
- selected profile comparison plot
- 14-day TCHP trend chart
- confidence and data provenance cards
- synthetic corridor analysis and brief export
- expert and forecaster design variants

### OTEC page features
- operational OTEC viability recommendations
- deep-water ΔT diagnostics
- 7-day power and freshwater forecast
- site ranking and filtering
- geospatial candidate analysis
- weighted decision-scoring ranking engine
- CSV export and site briefing modal

---

## 9. Setup Instructions

### Frontend installation
```bash
npm install
npm run dev
```

Frontend usually runs on:
http://localhost:5173

### Backend installation
```bash
cd backend
python -m venv venv
# Windows PowerShell:
# .\venv\Scripts\Activate.ps1
# Linux / macOS:
# source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Required environment variables
Create a `.env` file inside the `backend/` directory:

```env
CMEMS_USERNAME=your_username
CMEMS_PASSWORD=your_password
EARTHDATA_USERNAME=your_username
EARTHDATA_PASSWORD=your_password
CORS_ORIGINS=["http://localhost:5173","http://localhost:3000"]
LOG_LEVEL=INFO
```

---

## 10. Current Status and Caveats

This is a prototype and decision-support system rather than a production operational deployment.

The app is designed to be extensible and realistic:
- the main app is intended for real model-based inference from surface satellite inputs
- the TCHP and OTEC pages include specially designed mock or demo analytics for interaction and decision support
- live backend code is structured to accept real CMEMS and Earthdata inputs
- all the visual interfaces are built to simulate the scientific decision workflow of a real ocean monitoring platform

---

