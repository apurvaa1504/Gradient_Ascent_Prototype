import { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
  Plus, Search, Share2, Info, Download, Layers, Settings,
  MousePointer, Activity, Square, Upload, Play, Pause,
  ChevronLeft, ChevronRight, SkipBack, SkipForward,
  Thermometer, X, Eye, Sparkles, Shield, Droplets, Waves,
  Wind, Navigation, ArrowUpRight, BarChart3, TrendingUp, AlertTriangle
} from 'lucide-react';
import {
  getMockTemperature,
  getFullOceanProfile,
  getAnnualTimeseries,
  getSatelliteInputs,
  DEPTHS
} from './simulation';
import { worldLandGeoJSON } from './geoData';

// ─── Copernicus Magma/Inferno Continuous Palette ─────────────────────────────
const MAGMA_STOPS = [
  { p: 0.00, r: 15,  g: 10,  b: 40  },
  { p: 0.15, r: 48,  g: 18,  b: 88  },
  { p: 0.30, r: 92,  g: 22,  b: 110 },
  { p: 0.45, r: 145, g: 38,  b: 100 },
  { p: 0.60, r: 200, g: 65,  b: 70  },
  { p: 0.75, r: 242, g: 115, b: 50  },
  { p: 0.88, r: 253, g: 185, b: 85  },
  { p: 1.00, r: 254, g: 250, b: 180 },
];

function getMagmaRGB(norm) {
  const t = Math.max(0, Math.min(1, norm));
  let lo = MAGMA_STOPS[0], hi = MAGMA_STOPS[MAGMA_STOPS.length - 1];
  for (let i = 0; i < MAGMA_STOPS.length - 1; i++) {
    if (t >= MAGMA_STOPS[i].p && t <= MAGMA_STOPS[i + 1].p) {
      lo = MAGMA_STOPS[i];
      hi = MAGMA_STOPS[i + 1];
      break;
    }
  }
  const span = hi.p - lo.p;
  const f = span === 0 ? 0 : (t - lo.p) / span;
  return [
    Math.round(lo.r + (hi.r - lo.r) * f),
    Math.round(lo.g + (hi.g - lo.g) * f),
    Math.round(lo.b + (hi.b - lo.b) * f),
  ];
}

// ─── High-Definition Thermal Field Canvas ─────────────────────────────────────
const BBOX = [[5, 45], [30, 105]]; // North Indian Ocean (Lat 5-30, Lon 45-105)
const CANVAS_W = 600;
const CANVAS_H = 250;

function OceanThermalHeatmap({ depth, year, dayOfYear, forecastDays, opacity }) {
  const map = useMap();
  const overlayRef = useRef(null);

  const dataUrl = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext('2d');

    const depthRanges = {
      0: [22, 32],
      50: [20, 30],
      100: [16, 28],
      200: [10, 26],
      500: [5, 18],
      1000: [2, 10]
    };
    const [tMin, tMax] = depthRanges[depth] ?? [4, 32];

    const imgData = ctx.createImageData(CANVAS_W, CANVAS_H);
    const buf = imgData.data;

    for (let y = 0; y < CANVAS_H; y++) {
      const lat = 30 - (y / CANVAS_H) * 25;
      for (let x = 0; x < CANVAS_W; x++) {
        const lon = 45 + (x / CANVAS_W) * 60;
        const idx = (y * CANVAS_W + x) * 4;

        const t = getMockTemperature(lat, lon, depth, year, dayOfYear, forecastDays);
        const norm = (t - tMin) / (tMax - tMin);
        const [r, g, b] = getMagmaRGB(norm);

        buf[idx] = r;
        buf[idx + 1] = g;
        buf[idx + 2] = b;
        buf[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL();
  }, [depth, year, dayOfYear, forecastDays]);

  useEffect(() => {
    if (!map) return;
    if (overlayRef.current) {
      overlayRef.current.setUrl(dataUrl);
      overlayRef.current.setOpacity(opacity);
    } else {
      overlayRef.current = L.imageOverlay(dataUrl, BBOX, {
        opacity,
        interactive: false,
        zIndex: 10,
      }).addTo(map);
    }
  }, [dataUrl, opacity, map]);

  useEffect(() => {
    return () => {
      overlayRef.current?.remove();
      overlayRef.current = null;
    };
  }, []);

  return null;
}

// ─── Crisp Land Vector Mask ───────────────────────────────────────────────────
function LandVectorMask() {
  const landStyle = {
    fillColor: '#171c24',
    fillOpacity: 1.0,
    color: '#283345',
    weight: 0.9,
    opacity: 0.9,
  };

  return (
    <GeoJSON
      data={worldLandGeoJSON}
      style={landStyle}
      interactive={false}
      pane="overlayPane"
    />
  );
}

// ─── Interactive Click Probe Marker ───────────────────────────────────────────
function ProbeMarker({ lat, lon }) {
  const map = useMap();
  const ref = useRef(null);
  useEffect(() => {
    if (!map) return;
    if (!ref.current) {
      ref.current = L.circleMarker([lat, lon], {
        radius: 6,
        color: '#38bdf8',
        weight: 2.5,
        fillColor: '#ffffff',
        fillOpacity: 1,
      }).addTo(map);
    } else {
      ref.current.setLatLng([lat, lon]);
    }
  }, [lat, lon, map]);
  useEffect(() => () => ref.current?.remove(), []);
  return null;
}

// ─── Map Click Coordinate Handler ─────────────────────────────────────────────
function MapClickHandler({ onCoordClick }) {
  const map = useMap();
  useMapEvents({
    click(e) {
      const lat = Math.round(e.latlng.lat * 1000) / 1000;
      const lon = Math.round(e.latlng.lng * 1000) / 1000;
      const point = map.latLngToContainerPoint(e.latlng);
      onCoordClick(lat, lon, point);
    },
  });
  return null;
}

// ─── Keep Pin in Sync with Map Pan/Zoom ────────────────────────────────────────
function MapPositionTracker({ probe, setScreenPos }) {
  const map = useMap();
  useEffect(() => {
    const updatePos = () => {
      const pt = map.latLngToContainerPoint([probe.lat, probe.lon]);
      setScreenPos({ x: pt.x, y: pt.y });
    };
    updatePos();
    map.on('move', updatePos);
    map.on('zoom', updatePos);
    return () => {
      map.off('move', updatePos);
      map.off('zoom', updatePos);
    };
  }, [map, probe]);
  return null;
}

// ─── Full SIH OceanEmbed Probe Card ───────────────────────────────────────────
function OceanEmbedProbeCard({ probe, screenPos, depth, year, dayOfYear, forecastDays, onClose }) {
  const [activeTab, setActiveTab] = useState('physics'); // 'physics' | 'validation' | 'defense' | 'inputs'

  const profileData = useMemo(() =>
    getFullOceanProfile(probe.lat, probe.lon, year, dayOfYear, forecastDays),
    [probe, year, dayOfYear, forecastDays]
  );

  const satelliteInputs = useMemo(() =>
    getSatelliteInputs(probe.lat, probe.lon, year, dayOfYear),
    [probe, year, dayOfYear]
  );

  const annualData = useMemo(() =>
    getAnnualTimeseries(probe.lat, probe.lon, depth, year),
    [probe, depth, year]
  );

  const currentTemp = useMemo(() =>
    getMockTemperature(probe.lat, probe.lon, depth, year, dayOfYear, forecastDays),
    [probe, depth, year, dayOfYear, forecastDays]
  );

  const formattedCoord = useMemo(() => {
    const latStr = `${Math.abs(probe.lat).toFixed(3)}°${probe.lat >= 0 ? 'N' : 'S'}`;
    const lonStr = `${Math.abs(probe.lon).toFixed(3)}°${probe.lon >= 0 ? 'E' : 'W'}`;
    return `${lonStr}, ${latStr}`;
  }, [probe]);

  // Position card intelligently right next to the clicked pin point on the viewport
  const cardStyle = useMemo(() => {
    if (!screenPos) return { top: '80px', left: '38%' };
    const cardW = 340;
    const cardH = 460;
    const pad = 16;
    
    let left = screenPos.x + 14;
    let top = screenPos.y - 20;

    // Boundary checks
    if (left + cardW > window.innerWidth - pad) {
      left = screenPos.x - cardW - 14;
    }
    if (top + cardH > window.innerHeight - 60) {
      top = window.innerHeight - cardH - 60;
    }
    if (top < 50) top = 50;

    return {
      top: `${top}px`,
      left: `${left}px`
    };
  }, [screenPos]);

  const CW = 290, CH = 90;

  return (
    <div
      style={cardStyle}
      className="absolute z-[1150] w-[340px] bg-[#0c1017]/95 backdrop-blur-xl text-white rounded-xl shadow-2xl border border-white/15 overflow-hidden font-sans select-none animate-in fade-in zoom-in-95 duration-150"
    >
      {/* ── CARD HEADER: Coordinates & Close ── */}
      <div className="px-3 py-2 bg-gradient-to-r from-white/[0.06] to-transparent border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-[12px] font-mono font-bold text-gray-100 tracking-wider">
            {formattedCoord}
          </span>
          <span className="text-[9px] font-semibold text-cyan-400 bg-cyan-950/80 border border-cyan-800/60 px-1.5 py-0.2 rounded">
            {probe.lon > 80 ? 'Bay of Bengal' : 'Arabian Sea'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
        >
          <X size={14} />
        </button>
      </div>

      {/* ── LIVE PRIMARY TELEMETRY BAR ── */}
      <div className="px-3 pt-2.5 pb-2 bg-white/[0.02] flex items-center justify-between border-b border-white/[0.06]">
        <div>
          <div className="text-[10px] text-gray-400 font-medium">Reconstructed Potential Temp</div>
          <div className="text-[17px] font-mono font-black text-cyan-300 flex items-baseline gap-1.5">
            {currentTemp.toFixed(2)} °C
            {forecastDays > 0 && (
              <span className="text-[9px] font-sans font-bold text-fuchsia-400 bg-fuchsia-950/60 px-1.5 py-0.5 rounded border border-fuchsia-800/50">
                +{forecastDays}d Lead
              </span>
            )}
          </div>
        </div>

        {/* MHW Status Pill */}
        <div className="text-right">
          <div className="text-[9px] text-gray-400">Marine Heatwave</div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 ${
            profileData.mhwStatus.includes('Strong')
              ? 'bg-rose-950/80 text-rose-300 border border-rose-700/60'
              : 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
          }`}>
            {profileData.mhwStatus}
          </span>
        </div>
      </div>

      {/* ── SUB-TABS FOR DEEP SIH FEATURES ── */}
      <div className="flex border-b border-white/10 bg-[#080b11] text-[10px] font-medium">
        <button
          onClick={() => setActiveTab('physics')}
          className={`flex-1 py-1.5 text-center transition-all ${
            activeTab === 'physics'
              ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/10 font-bold'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          15-Depth Profile
        </button>
        <button
          onClick={() => setActiveTab('defense')}
          className={`flex-1 py-1.5 text-center transition-all ${
            activeTab === 'defense'
              ? 'text-fuchsia-400 border-b-2 border-fuchsia-400 bg-fuchsia-500/10 font-bold'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Sonic / SLD
        </button>
        <button
          onClick={() => setActiveTab('validation')}
          className={`flex-1 py-1.5 text-center transition-all ${
            activeTab === 'validation'
              ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/10 font-bold'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          ARGO Benchmark
        </button>
        <button
          onClick={() => setActiveTab('inputs')}
          className={`flex-1 py-1.5 text-center transition-all ${
            activeTab === 'inputs'
              ? 'text-amber-400 border-b-2 border-amber-400 bg-amber-500/10 font-bold'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          5 Satellite Inputs
        </button>
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="p-3 space-y-2.5 max-h-[310px] overflow-y-auto">
        
        {/* ── TAB 1: 15-DEPTH VERTICAL TEMPERATURE & SALINITY ── */}
        {activeTab === 'physics' && (
          <>
            {/* Chart: Vertical T(z) Profile */}
            <div className="bg-[#090c12] p-2 rounded-lg border border-white/[0.08]">
              <div className="flex justify-between items-center text-[10px] font-mono text-gray-400 mb-1">
                <span className="text-gray-200 font-semibold">T(z) Depth Profile</span>
                <div className="flex gap-4 text-[9px]">
                  <span className="flex items-center gap-1 text-cyan-400">
                    <span className="w-2 h-0.5 bg-cyan-400 inline-block" /> OceanEmbed
                  </span>
                  <span className="flex items-center gap-1 text-gray-400">
                    <span className="w-2 h-0.5 border-t border-dashed border-gray-400 inline-block" /> GLORYS12
                  </span>
                </div>
              </div>

              <svg width={CW} height={CH} className="overflow-visible">
                {/* Horizontal Depth grid */}
                {[0, 200, 500, 1000].map(d => {
                  const y = (d / 1000) * CH;
                  return (
                    <g key={d}>
                      <line x1={0} y1={y} x2={CW - 32} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
                      <text x={CW - 4} y={y + 3} fill="#6b7280" fontSize={8} textAnchor="end" fontFamily="monospace">
                        {d === 0 ? '0m' : `-${d}m`}
                      </text>
                    </g>
                  );
                })}

                {/* GLORYS Reference Line */}
                {(() => {
                  const pts = profileData.depths.map((d, i) => {
                    const temp = profileData.tempGlorys[i];
                    const x = ((temp - 2) / 30) * (CW - 32);
                    const y = (d / 1000) * CH;
                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ');
                  return <path d={pts} fill="none" stroke="#64748b" strokeWidth={1.4} strokeDasharray="3 2" />;
                })()}

                {/* OceanEmbed Reconstructed Line */}
                {(() => {
                  const pts = profileData.depths.map((d, i) => {
                    const temp = profileData.tempEmbed[i];
                    const x = ((temp - 2) / 30) * (CW - 32);
                    const y = (d / 1000) * CH;
                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ');
                  return <path d={pts} fill="none" stroke="#38bdf8" strokeWidth={2.2} />;
                })()}

                {/* Active Selected Depth Marker */}
                {(() => {
                  const depthY = (depth / 1000) * CH;
                  return <line x1={0} y1={depthY} x2={CW - 32} y2={depthY} stroke="#f43f5e" strokeWidth={1.5} strokeDasharray="2 2" />;
                })()}
              </svg>

              <div className="flex justify-between text-[9px] font-mono text-gray-400 mt-1 pt-1 border-t border-cyan-500/40">
                <span>Avg: {profileData.avgTemp}°C</span>
                <span>Min: {profileData.minTemp}°C</span>
                <span>Max: {profileData.maxTemp}°C</span>
              </div>
            </div>

            {/* Monthly Climatology mini-curve */}
            <div className="bg-[#090c12] p-2 rounded-lg border border-white/[0.08]">
              <div className="flex justify-between items-center text-[10px] font-mono text-gray-400 mb-1">
                <span className="text-gray-200 font-semibold">Annual Climatology (Monthly thetao)</span>
                <span className="text-gray-500 text-[9px]">t (Jan-Dec)</span>
              </div>
              <svg width={CW} height={45} className="overflow-visible">
                {(() => {
                  const pts = annualData.points.map((p, i) => {
                    const x = (i / 11) * (CW - 32);
                    const y = 45 - ((p.temp - 22) / 10) * 45;
                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ');
                  return <path d={pts} fill="none" stroke="#f59e0b" strokeWidth={1.6} />;
                })()}
              </svg>
            </div>
          </>
        )}

        {/* ── TAB 2: DEFENSE INSIGHTS & SONIC LAYER DEPTH (SLD) ── */}
        {activeTab === 'defense' && (
          <div className="space-y-2">
            <div className="p-2.5 rounded-lg bg-gradient-to-r from-fuchsia-950/60 to-purple-950/60 border border-fuchsia-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-fuchsia-300 font-bold text-[11px]">
                  <Shield size={13} /> Sonic Layer Depth (SLD)
                </div>
                <span className="text-[13px] font-mono font-extrabold text-white bg-fuchsia-900/60 px-2 py-0.5 rounded border border-fuchsia-600/40">
                  {profileData.sldDepth} meters
                </span>
              </div>
              <div className="text-[9px] text-gray-300 mt-1 leading-relaxed">
                Max sound speed duct is at <strong>{profileData.sldDepth}m</strong> ({profileData.maxSoundSpeed} m/s). Essential for Navy sonar propagation & shadow-zone submarine detection.
              </div>
            </div>

            {/* Sound Velocity Profile C(z) */}
            <div className="bg-[#090c12] p-2 rounded-lg border border-white/[0.08]">
              <div className="flex justify-between items-center text-[10px] font-mono text-gray-400 mb-1">
                <span className="text-fuchsia-300 font-semibold">Sound Speed Profile C(z)</span>
                <span className="text-[9px] text-gray-500">Mackenzie (1981)</span>
              </div>
              <svg width={CW} height={CH} className="overflow-visible">
                {[0, 200, 500, 1000].map(d => {
                  const y = (d / 1000) * CH;
                  return (
                    <g key={d}>
                      <line x1={0} y1={y} x2={CW - 32} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
                      <text x={CW - 4} y={y + 3} fill="#6b7280" fontSize={8} textAnchor="end" fontFamily="monospace">
                        {d}m
                      </text>
                    </g>
                  );
                })}
                {(() => {
                  const pts = profileData.depths.map((d, i) => {
                    const speed = profileData.soundSpeed[i];
                    const x = ((speed - 1490) / 50) * (CW - 32);
                    const y = (d / 1000) * CH;
                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ');
                  return <path d={pts} fill="none" stroke="#d946ef" strokeWidth={2} />;
                })()}
              </svg>
            </div>
          </div>
        )}

        {/* ── TAB 3: BOA-ARGO IN-SITU VALIDATION ── */}
        {activeTab === 'validation' && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30">
                <div className="text-[9px] text-gray-400 uppercase font-semibold">Model RMSE</div>
                <div className="text-[14px] font-mono font-bold text-emerald-300">
                  {profileData.rmse} °C
                </div>
                <div className="text-[8px] text-emerald-400/80">Target &lt; 0.5°C ✓</div>
              </div>
              <div className="p-2 rounded-lg bg-cyan-950/40 border border-cyan-500/30">
                <div className="text-[9px] text-gray-400 uppercase font-semibold">Determination R²</div>
                <div className="text-[14px] font-mono font-bold text-cyan-300">
                  {profileData.r2}
                </div>
                <div className="text-[8px] text-cyan-400/80">vs BOA-ARGO Float</div>
              </div>
            </div>

            <div className="p-2 rounded-lg bg-[#090c12] border border-white/[0.08] text-[9px] text-gray-300 space-y-1">
              <div className="flex justify-between font-mono">
                <span className="text-gray-400">Benchmark Float ID:</span>
                <span className="text-cyan-300">ARGO_INCOIS_2901428</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-gray-400">Latency Advantage:</span>
                <span className="text-emerald-400 font-bold">120ms (vs 7 days GLORYS)</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-gray-400">Grid Density:</span>
                <span className="text-amber-300">0.25° (12x denser than ARGO)</span>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 4: 5 SATELLITE INPUT EMBEDDINGS ── */}
        {activeTab === 'inputs' && (
          <div className="space-y-1.5">
            <div className="text-[9px] text-gray-400 font-medium mb-1">
              Live Satellite Embedding Inputs (Surface → Subsurface Mapping):
            </div>
            
            <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
              <div className="p-2 rounded bg-white/[0.03] border border-white/[0.06]">
                <div className="text-[8px] text-gray-400 flex items-center gap-1">
                  <Thermometer size={10} className="text-rose-400" /> SST (Temperature)
                </div>
                <div className="text-[12px] font-bold text-white mt-0.5">{satelliteInputs.sst} °C</div>
              </div>

              <div className="p-2 rounded bg-white/[0.03] border border-white/[0.06]">
                <div className="text-[8px] text-gray-400 flex items-center gap-1">
                  <Droplets size={10} className="text-sky-400" /> SSS (Salinity)
                </div>
                <div className="text-[12px] font-bold text-white mt-0.5">{satelliteInputs.sss} PSU</div>
              </div>

              <div className="p-2 rounded bg-white/[0.03] border border-white/[0.06]">
                <div className="text-[8px] text-gray-400 flex items-center gap-1">
                  <Waves size={10} className="text-emerald-400" /> SSH Anomaly
                </div>
                <div className="text-[12px] font-bold text-white mt-0.5">{satelliteInputs.ssh} m</div>
              </div>

              <div className="p-2 rounded bg-white/[0.03] border border-white/[0.06]">
                <div className="text-[8px] text-gray-400 flex items-center gap-1">
                  <Navigation size={10} className="text-cyan-400" /> Ocean Current
                </div>
                <div className="text-[12px] font-bold text-white mt-0.5">{satelliteInputs.currentSpeed} m/s</div>
              </div>
            </div>

            <div className="p-2 rounded bg-white/[0.03] border border-white/[0.06] flex items-center justify-between text-[10px] font-mono">
              <div className="text-[8px] text-gray-400 flex items-center gap-1">
                <Wind size={10} className="text-amber-400" /> Surface Winds
              </div>
              <div className="font-bold text-amber-300">
                {satelliteInputs.windSpeed} m/s ({satelliteInputs.windDir})
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── CARD FOOTER: Cyclone Heat Potential Indicator ── */}
      <div className="px-3 py-2 bg-[#080b10] border-t border-white/10 flex items-center justify-between text-[9px] font-mono">
        <span className="text-gray-400 flex items-center gap-1">
          <AlertTriangle size={11} className="text-amber-400" /> Cyclone Heat (TCHP):
        </span>
        <span className="font-bold text-amber-300">
          {profileData.tchp} kJ/cm²
        </span>
      </div>

    </div>
  );
}

// ─── Main Application Component ───────────────────────────────────────────────
export default function App() {
  const [probe, setProbe] = useState({ lat: 14.5, lon: 70.0 });
  const [screenPos, setScreenPos] = useState({ x: 450, y: 220 });
  const [depth, setDepth] = useState(0);
  const [year, setYear] = useState(2024);
  const [dayOfYear, setDayOfYear] = useState(150);
  const [forecastDays, setForecastDays] = useState(0); // 0 (Nowcast), +3d, +7d, +14d Lead
  const [isPlaying, setIsPlaying] = useState(false);
  const [opacity, setOpacity] = useState(0.92);
  const [activeTool, setActiveTool] = useState('point');
  const [showProbeCard, setShowProbeCard] = useState(true);

  // 15 Depth levels from PPT
  const visibleDepths = [0, 50, 100, 200, 500, 1000];

  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => setYear(y => y >= 2026 ? 2005 : y + 1), 1000);
    return () => clearInterval(id);
  }, [isPlaying]);

  const probeSST = useMemo(() =>
    getMockTemperature(probe.lat, probe.lon, depth, year, dayOfYear, forecastDays),
    [probe, depth, year, dayOfYear, forecastDays]
  );

  const TOOLS = [
    { id: 'point', icon: MousePointer, label: 'Point probe' },
    { id: 'line',  icon: Activity,     label: 'Transect line' },
    { id: 'area',  icon: Square,        label: 'Bounding area' },
    { id: 'import',icon: Upload,        label: 'Import NetCDF/Zarr' },
    { id: 'settings', icon: Settings,  label: 'Settings' },
  ];

  return (
    <div className="w-screen h-screen relative overflow-hidden bg-[#0a0d14] select-none font-sans">

      {/* ── FULLSCREEN MAP CANVAS ── */}
      <MapContainer
        center={[17.0, 75.0]}
        zoom={5}
        minZoom={3}
        maxZoom={10}
        zoomControl={false}
        attributionControl={false}
        className="absolute inset-0 w-full h-full z-0 cursor-pointer"
        style={{ background: '#0a0d14' }}
      >
        {/* Layer 1: Dark Basemap */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          maxZoom={16}
        />

        {/* Layer 2: 3D Ocean Thermal Heatmap */}
        <OceanThermalHeatmap
          depth={depth}
          year={year}
          dayOfYear={dayOfYear}
          forecastDays={forecastDays}
          opacity={opacity}
        />

        {/* Vector Land GeoJSON Mask */}
        <LandVectorMask />

        {/* Active Marker */}
        <ProbeMarker lat={probe.lat} lon={probe.lon} />

        {/* Track Pin Position across map pan/zoom so info card stays anchored */}
        <MapPositionTracker probe={probe} setScreenPos={setScreenPos} />

        {/* Click anywhere on the map */}
        <MapClickHandler onCoordClick={(lat, lon, point) => {
          setProbe({ lat, lon });
          setScreenPos(point);
          setShowProbeCard(true);
        }} />
      </MapContainer>

      {/* ══════════════════════════════════════════
          COPERNICUS MYOCEAN PRO FLOATING UI
      ══════════════════════════════════════════ */}

      {/* ── TOP HEADER BAR ── */}
      <div className="absolute top-0 left-0 right-0 z-[1100] h-10 bg-[#0c1017]/90 backdrop-blur-md border-b border-white/[0.08] flex items-center px-4 gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-cyan-500 to-fuchsia-500 flex items-center justify-center shadow">
            <Thermometer size={12} className="text-white" />
          </div>
          <span className="text-[12px] font-bold tracking-wider text-white uppercase">OceanEmbed</span>
          <span className="text-[10px] text-gray-400 font-mono hidden sm:inline">| AI Subsurface Ocean 3D Reconstruction</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3 text-[10px] text-gray-300 font-mono">
          <span className="hidden md:inline">North Indian Ocean (5°N–30°N, 45°E–105°E)</span>
          <span className="text-white/20 hidden md:inline">|</span>
          <span className="text-cyan-400 font-medium">15 Depths (0–1000m)</span>
          <span className="text-white/20">|</span>
          <span className="text-amber-300/90 font-medium">SIH 2026 · PS-26066</span>
        </div>
      </div>

      {/* ── TOP-LEFT LAYER CARD (Exact Copernicus Style) ── */}
      <div className="absolute top-14 left-4 z-[1100] w-72 bg-white/95 backdrop-blur-sm text-gray-800 rounded-xl shadow-2xl overflow-hidden border border-gray-100">
        <div className="flex items-center border-b border-gray-200/80">
          <button className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-cyan-700 border-b-2 border-cyan-600 bg-cyan-50/70">
            <Plus size={12} /> Add layer…
          </button>
          <div className="flex-1" />
          <button className="p-2 text-gray-400 hover:text-gray-700 transition-colors"><Search size={13} /></button>
          <button className="p-2 text-gray-400 hover:text-gray-700 transition-colors"><Share2 size={13} /></button>
          <button className="p-2 text-gray-400 hover:text-gray-700 transition-colors"><Info size={13} /></button>
        </div>

        <div className="px-3.5 pt-2.5 pb-1">
          <div className="flex items-center justify-between">
            <div className="text-[12px] font-bold text-gray-900 leading-tight">
              Sea water potential temperature (thetao)
            </div>
            <Eye size={14} className="text-cyan-600 shrink-0" />
          </div>
          <div className="text-[10px] text-gray-500 font-medium mt-0.5">
            {depth === 0 ? 'Surface (0m)' : `${depth}m depth`} · {year} · Daily 0.25° Grid
          </div>
        </div>

        {/* Magma Gradient Bar */}
        <div className="px-3.5 pb-2 pt-1.5">
          <div
            className="w-full h-3.5 rounded-sm shadow-inner"
            style={{
              background: 'linear-gradient(to right, #0f0a28, #301258, #5c166e, #912664, #c84146, #f27332, #fdb955, #fefab4)'
            }}
          />
          <div className="flex justify-between mt-1 text-[9px] text-gray-500 font-mono font-medium">
            <span>0°C</span>
            <span>5°C</span>
            <span>10°C</span>
            <span>15°C</span>
            <span>20°C</span>
            <span>30°C+</span>
          </div>
        </div>

        {/* Forecast Lead Selection Pill Buttons */}
        <div className="px-3.5 py-1.5 bg-gray-50 flex items-center justify-between text-[9px] font-mono border-t border-b border-gray-100">
          <span className="text-gray-500 font-semibold">Forecast Mode:</span>
          <div className="flex gap-1">
            {[0, 3, 7, 14].map(fDays => (
              <button
                key={fDays}
                onClick={() => setForecastDays(fDays)}
                className={`px-1.5 py-0.5 rounded transition-all ${
                  forecastDays === fDays
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                {fDays === 0 ? 'Now' : `+${fDays}d`}
              </button>
            ))}
          </div>
        </div>

        {/* Opacity Slider */}
        <div className="px-3.5 py-2 flex items-center gap-2">
          <span className="text-[9px] text-gray-500 font-medium shrink-0">Opacity</span>
          <input
            type="range"
            min="0.2"
            max="1"
            step="0.05"
            value={opacity}
            onChange={e => setOpacity(parseFloat(e.target.value))}
            className="flex-1 h-1.5 accent-cyan-600 cursor-pointer"
          />
          <span className="text-[9px] font-mono font-semibold text-gray-600 w-7 text-right">
            {Math.round(opacity * 100)}%
          </span>
        </div>

        {/* Card Footer Toolbar */}
        <div className="border-t border-gray-100 px-3.5 py-1.5 flex items-center justify-between bg-gray-50/50">
          <div className="flex gap-1.5">
            {[Download, Info, Layers, Settings].map((Icon, i) => (
              <button key={i} className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 transition-colors">
                <Icon size={13} />
              </button>
            ))}
          </div>
          {probeSST !== null && (
            <span className="text-[10px] font-mono font-bold text-cyan-800 bg-cyan-100/70 border border-cyan-300/80 px-2 py-0.5 rounded shadow-sm">
              {probeSST.toFixed(2)}°C @ probe
            </span>
          )}
        </div>
      </div>

      {/* ── COPERNICUS INSPECTION CARD (POSITIONED RIGHT WHERE CLICKED) ── */}
      {showProbeCard && (
        <OceanEmbedProbeCard
          probe={probe}
          screenPos={screenPos}
          depth={depth}
          year={year}
          dayOfYear={dayOfYear}
          forecastDays={forecastDays}
          onClose={() => setShowProbeCard(false)}
        />
      )}

      {/* ── NORTH & SOUTH POLE BADGES ── */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 z-[1100] pointer-events-none">
        <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-full px-3 py-0.5 text-[9px] font-bold tracking-widest text-white/70 uppercase shadow">
          North Pole
        </div>
      </div>
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[1100] pointer-events-none">
        <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-full px-3 py-0.5 text-[9px] font-bold tracking-widest text-white/70 uppercase shadow">
          South Pole
        </div>
      </div>

      {/* ── RIGHT UTILITY TOOLBAR ── */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-[1100] flex flex-col gap-1">
        <div className="flex flex-col bg-[#0a0e1a]/90 backdrop-blur-md border border-white/10 rounded-xl shadow-xl overflow-hidden">
          {TOOLS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTool(id)}
              title={label}
              className={`w-10 h-10 flex items-center justify-center transition-all border-b border-white/[0.05] last:border-b-0
                ${activeTool === id
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
                }`}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
      </div>

      {/* ── RIGHT DEPTH SELECTOR GAUGE (15 Depths Support) ── */}
      <div className="absolute right-16 top-1/2 -translate-y-1/2 z-[1100]">
        <div className="flex flex-col bg-[#0a0e1a]/90 backdrop-blur-md border border-white/10 rounded-xl shadow-xl overflow-hidden w-20">
          <div className="px-2 py-1.5 text-[8px] font-bold text-center text-gray-400 uppercase tracking-widest border-b border-white/[0.05] bg-white/[0.02]">
            Depth
          </div>
          {visibleDepths.map((d) => (
            <button
              key={d}
              onClick={() => setDepth(d)}
              className={`w-full px-2 py-1 text-[10px] font-mono text-center border-b border-white/[0.04] last:border-b-0 transition-all
                ${depth === d
                  ? 'bg-fuchsia-600/30 text-fuchsia-300 font-bold shadow-inner'
                  : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'
                }`}
            >
              {d === 0 ? '0 m (SST)' : `-${d} m`}
            </button>
          ))}
          <div className="p-2 flex justify-center">
            <div className="relative w-1.5 h-20 rounded-full overflow-hidden bg-gradient-to-b from-cyan-400 via-fuchsia-500 to-indigo-950">
              <div
                className="absolute w-2.5 h-2.5 rounded-full bg-white border border-fuchsia-500 -left-0.5 shadow transition-all duration-200"
                style={{ top: `${(visibleDepths.indexOf(depth) / (visibleDepths.length - 1)) * (80 - 10)}px` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM TIMELINE BAR ── */}
      <div className="absolute bottom-0 left-0 right-0 z-[1100] h-14 bg-[#0a0e1a]/90 backdrop-blur-md border-t border-white/[0.08] flex items-center px-4 gap-4">
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setYear(y => Math.max(2005, y - 1))}
            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            <SkipBack size={13} />
          </button>
          <button
            onClick={() => setYear(y => Math.max(2005, y - 1))}
            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeft size={13} />
          </button>
          <button
            onClick={() => setIsPlaying(p => !p)}
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-all shadow-md
              ${isPlaying ? 'bg-cyan-500 text-white ring-2 ring-cyan-400/40' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            {isPlaying ? <Pause size={13} fill="white" /> : <Play size={13} fill="currentColor" />}
          </button>
          <button
            onClick={() => setYear(y => Math.min(2026, y + 1))}
            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            <ChevronRight size={13} />
          </button>
          <button
            onClick={() => setYear(y => Math.min(2026, y + 1))}
            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            <SkipForward size={13} />
          </button>
        </div>

        <div className="shrink-0 bg-cyan-950/70 border border-cyan-500/40 rounded px-2.5 py-1 font-mono text-[11px] text-cyan-300 font-bold shadow-sm">
          {year}
        </div>

        <div className="flex-1 flex flex-col justify-center gap-1">
          <input
            type="range"
            min="2005"
            max="2026"
            step="1"
            value={year}
            onChange={e => { setIsPlaying(false); setYear(parseInt(e.target.value)); }}
            className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-gray-700 rounded-lg"
          />
          <div className="flex justify-between text-[8px] font-mono text-gray-400 px-0.5">
            {Array.from({ length: 22 }, (_, i) => 2005 + i).map(y => (
              <span
                key={y}
                className={`cursor-pointer transition-colors hover:text-white ${y === year ? 'text-cyan-400 font-bold scale-110' : ''}`}
                onClick={() => setYear(y)}
              >
                {y % 5 === 0 ? y : '·'}
              </span>
            ))}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2 pl-3 border-l border-white/[0.08]">
          <div className="flex flex-col items-center">
            <span className="text-[8px] text-gray-400 font-mono uppercase">Season</span>
            <input
              type="range"
              min="1"
              max="365"
              step="1"
              value={dayOfYear}
              onChange={e => setDayOfYear(parseInt(e.target.value))}
              className="w-16 accent-fuchsia-400 cursor-pointer h-1.5"
            />
            <span className="text-[9px] font-mono font-semibold text-fuchsia-300">
              {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Math.floor((dayOfYear - 1) / 30.5)]}
            </span>
          </div>
        </div>
      </div>

      {/* ── COORDINATE HUD ── */}
      <div className="absolute bottom-16 left-4 z-[1100] bg-[#0a0e1a]/85 border border-white/10 backdrop-blur-md rounded-md px-2.5 py-1 font-mono text-[10px] text-gray-300 flex items-center gap-3 shadow-lg">
        <span className="flex items-center gap-1 font-medium">
          🎯 {Math.abs(probe.lon).toFixed(3)}°{probe.lon >= 0 ? 'E' : 'W'}, {Math.abs(probe.lat).toFixed(3)}°{probe.lat >= 0 ? 'N' : 'S'}
        </span>
        <span className="border-l border-white/15 pl-2.5 text-cyan-400">
          {probe.lon > 80 ? 'Bay of Bengal' : 'Arabian Sea'}
        </span>
        {probeSST !== null && (
          <span className="border-l border-white/15 pl-2.5 text-fuchsia-400 font-semibold">
            {probeSST.toFixed(2)}°C
          </span>
        )}
      </div>

    </div>
  );
}
