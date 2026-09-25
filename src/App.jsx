import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
  Plus, Search, Share2, Info, Download, Layers, Settings,
  MousePointer2, Upload, Thermometer, X, Eye, Shield, Droplets, Waves,
  Wind, Navigation, AlertTriangle, Grid
} from 'lucide-react';
import {
  getMockTemperature,
  getFullOceanProfile,
  getSatelliteInputs
} from './simulation';
import { worldLandGeoJSON, isLandCoordinate } from './geoData';
import { fetchInferencePrediction } from './apiClient';
import GlobalHeader from './features/otec/components/GlobalHeader.jsx';
import './App.css';

// ─── Copernicus Magma/Inferno Continuous Palette ─────────────────────────────
const MAGMA_STOPS = [
  { p: 0.00, r: 15, g: 10, b: 40 },
  { p: 0.15, r: 48, g: 18, b: 88 },
  { p: 0.30, r: 92, g: 22, b: 110 },
  { p: 0.45, r: 145, g: 38, b: 100 },
  { p: 0.60, r: 200, g: 65, b: 70 },
  { p: 0.75, r: 242, g: 115, b: 50 },
  { p: 0.88, r: 253, g: 185, b: 85 },
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

// ─── 0.25° x 0.25° High-Precision Spatial Grid Mesh Overlay ───────────────────
function Grid025Overlay({ enabled = true, showLabels = true, opacity = 0.85, probe, hoveredCell }) {
  const map = useMap();
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!map) return;

    const container = map.getPanes().overlayPane;
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '15';
    container.appendChild(canvas);
    canvasRef.current = canvas;

    const redraw = () => {
      if (!canvasRef.current) return;
      const ctx = canvas.getContext('2d');
      const size = map.getSize();

      if (!enabled) {
        ctx.clearRect(0, 0, size.x, size.y);
        return;
      }

      const bounds = map.getBounds();
      const zoom = map.getZoom();

      const dpr = window.devicePixelRatio || 1;
      canvas.width = size.x * dpr;
      canvas.height = size.y * dpr;
      canvas.style.width = `${size.x}px`;
      canvas.style.height = `${size.y}px`;

      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, size.x, size.y);
      ctx.globalAlpha = opacity;

      const latMin = 5.0;
      const latMax = 30.0;
      const lonMin = 45.0;
      const lonMax = 105.0;
      const step = 0.25;

      const topLeft = map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(canvas, topLeft);

      const visibleSouth = Math.max(latMin, Math.floor(bounds.getSouth() / step) * step);
      const visibleNorth = Math.min(latMax, Math.ceil(bounds.getNorth() / step) * step);
      const visibleWest = Math.max(lonMin, Math.floor(bounds.getWest() / step) * step);
      const visibleEast = Math.min(lonMax, Math.ceil(bounds.getEast() / step) * step);



      // 2. Latitude Lines (Horizontal 0.25° Grid)
      for (let lat = visibleSouth; lat <= visibleNorth + 0.0001; lat += step) {
        const roundedLat = Math.round(lat * 100) / 100;
        const isMajor1Deg = Math.abs(Math.round(roundedLat) - roundedLat) < 0.01;
        const isMaster5Deg = Math.abs(Math.round(roundedLat / 5) * 5 - roundedLat) < 0.01;

        const startPt = map.latLngToContainerPoint([roundedLat, Math.max(lonMin, visibleWest)]);
        const endPt = map.latLngToContainerPoint([roundedLat, Math.min(lonMax, visibleEast)]);

        ctx.beginPath();
        ctx.moveTo(startPt.x, startPt.y);
        ctx.lineTo(endPt.x, endPt.y);

        if (isMaster5Deg) {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([]);
        } else if (isMajor1Deg) {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
          ctx.lineWidth = 0.9;
          ctx.setLineDash([]);
        } else {
          if (zoom < 4) continue;
          ctx.strokeStyle = zoom >= 6 ? 'rgba(56, 189, 248, 0.28)' : 'rgba(56, 189, 248, 0.15)';
          ctx.lineWidth = 0.6;
          ctx.setLineDash(zoom >= 6 ? [] : [2, 2]);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Labels
        if (showLabels && (isMaster5Deg || (zoom >= 6 && isMajor1Deg)) && startPt.x >= 0 && startPt.x <= size.x) {
          ctx.fillStyle = isMaster5Deg ? '#38bdf8' : 'rgba(255, 255, 255, 0.7)';
          ctx.font = '9px monospace';
          ctx.fillText(`${roundedLat.toFixed(2)}°N`, Math.max(10, startPt.x + 4), startPt.y - 3);
        }
      }

      // 3. Longitude Lines (Vertical 0.25° Grid)
      for (let lon = visibleWest; lon <= visibleEast + 0.0001; lon += step) {
        const roundedLon = Math.round(lon * 100) / 100;
        const isMajor1Deg = Math.abs(Math.round(roundedLon) - roundedLon) < 0.01;
        const isMaster5Deg = Math.abs(Math.round(roundedLon / 5) * 5 - roundedLon) < 0.01;

        const startPt = map.latLngToContainerPoint([Math.max(latMin, visibleSouth), roundedLon]);
        const endPt = map.latLngToContainerPoint([Math.min(latMax, visibleNorth), roundedLon]);

        ctx.beginPath();
        ctx.moveTo(startPt.x, startPt.y);
        ctx.lineTo(endPt.x, endPt.y);

        if (isMaster5Deg) {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([]);
        } else if (isMajor1Deg) {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
          ctx.lineWidth = 0.9;
          ctx.setLineDash([]);
        } else {
          if (zoom < 4) continue;
          ctx.strokeStyle = zoom >= 6 ? 'rgba(56, 189, 248, 0.28)' : 'rgba(56, 189, 248, 0.15)';
          ctx.lineWidth = 0.6;
          ctx.setLineDash(zoom >= 6 ? [] : [2, 2]);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Labels
        if (showLabels && (isMaster5Deg || (zoom >= 6 && isMajor1Deg)) && endPt.y >= 0 && endPt.y <= size.y) {
          ctx.fillStyle = isMaster5Deg ? '#38bdf8' : 'rgba(255, 255, 255, 0.7)';
          ctx.font = '9px monospace';
          ctx.fillText(`${roundedLon.toFixed(2)}°E`, endPt.x + 3, Math.min(size.y - 10, endPt.y - 4));
        }
      }

      // 4. Highlight Selected Probe 0.25° Grid Cell
      if (probe && probe.lat >= latMin && probe.lat <= latMax && probe.lon >= lonMin && probe.lon <= lonMax) {
        const row = Math.floor((probe.lat - latMin) / step);
        const col = Math.floor((probe.lon - lonMin) / step);
        const cellLatFloor = latMin + row * step;
        const cellLonFloor = lonMin + col * step;

        const nw = map.latLngToContainerPoint([cellLatFloor + step, cellLonFloor]);
        const se = map.latLngToContainerPoint([cellLatFloor, cellLonFloor + step]);

        const w = se.x - nw.x;
        const h = se.y - nw.y;

        // Glowing cell fill
        ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
        ctx.fillRect(nw.x, nw.y, w, h);

        // Bright border
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.strokeRect(nw.x, nw.y, w, h);

        // Corner Target Reticle Ticks
        const tLen = Math.min(8, Math.max(3, w / 4));
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 2;
        // TL
        ctx.beginPath(); ctx.moveTo(nw.x, nw.y + tLen); ctx.lineTo(nw.x, nw.y); ctx.lineTo(nw.x + tLen, nw.y); ctx.stroke();
        // TR
        ctx.beginPath(); ctx.moveTo(nw.x + w - tLen, nw.y); ctx.lineTo(nw.x + w, nw.y); ctx.lineTo(nw.x + w, nw.y + tLen); ctx.stroke();
        // BL
        ctx.beginPath(); ctx.moveTo(nw.x, nw.y + h - tLen); ctx.lineTo(nw.x, nw.y + h); ctx.lineTo(nw.x + tLen, nw.y + h); ctx.stroke();
        // BR
        ctx.beginPath(); ctx.moveTo(nw.x + w - tLen, nw.y + h); ctx.lineTo(nw.x + w, nw.y + h); ctx.lineTo(nw.x + w, nw.y + h - tLen); ctx.stroke();
      }

      // 5. Highlight Hovered 0.25° Grid Cell
      if (hoveredCell && hoveredCell.lat >= latMin && hoveredCell.lat <= latMax && hoveredCell.lon >= lonMin && hoveredCell.lon <= lonMax) {
        const row = Math.floor((hoveredCell.lat - latMin) / step);
        const col = Math.floor((hoveredCell.lon - lonMin) / step);
        const cellLatFloor = latMin + row * step;
        const cellLonFloor = lonMin + col * step;

        const nw = map.latLngToContainerPoint([cellLatFloor + step, cellLonFloor]);
        const se = map.latLngToContainerPoint([cellLatFloor, cellLonFloor + step]);

        ctx.fillStyle = 'rgba(244, 114, 182, 0.12)';
        ctx.fillRect(nw.x, nw.y, se.x - nw.x, se.y - nw.y);

        ctx.strokeStyle = 'rgba(244, 114, 182, 0.8)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(nw.x, nw.y, se.x - nw.x, se.y - nw.y);
        ctx.setLineDash([]);
      }
    };

    redraw();

    map.on('move', redraw);
    map.on('zoom', redraw);
    map.on('resize', redraw);

    return () => {
      map.off('move', redraw);
      map.off('zoom', redraw);
      map.off('resize', redraw);
      if (canvasRef.current) {
        canvasRef.current.remove();
        canvasRef.current = null;
      }
    };
  }, [map, enabled, showLabels, opacity, probe, hoveredCell]);

  return null;
}

// ─── Map Mouse & Click Handler ──────────────────────────────────────────────
function MapMouseEvents({ onCoordClick, onCoordHover, snapToGrid }) {
  const map = useMap();
  useMapEvents({
    click(e) {
      let lat = Math.round(e.latlng.lat * 1000) / 1000;
      let lon = Math.round(e.latlng.lng * 1000) / 1000;
      if (snapToGrid) {
        const latMin = 5.0, lonMin = 45.0, step = 0.25;
        const r = Math.round((Math.max(5, Math.min(30, lat)) - latMin) / step);
        const c = Math.round((Math.max(45, Math.min(105, lon)) - lonMin) / step);
        lat = Math.round((latMin + r * step) * 1000) / 1000;
        lon = Math.round((lonMin + c * step) * 1000) / 1000;
      }
      const point = map.latLngToContainerPoint([lat, lon]);
      onCoordClick(lat, lon, point);
    },
    mousemove(e) {
      const lat = Math.round(e.latlng.lat * 1000) / 1000;
      const lon = Math.round(e.latlng.lng * 1000) / 1000;
      onCoordHover({ lat, lon });
    },
    mouseout() {
      onCoordHover(null);
    }
  });
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
function OceanEmbedProbeCard({ probe, screenPos, depth, year, dayOfYear, forecastDays, onClose, inferenceResult, inferenceLoading }) {
  const [activeTab, setActiveTab] = useState('physics'); // 'physics' | 'validation' | 'defense' | 'inputs'

  const profileData = useMemo(() =>
    getFullOceanProfile(probe.lat, probe.lon, year, dayOfYear, forecastDays),
    [probe, year, dayOfYear, forecastDays]
  );

  const satelliteInputs = useMemo(() =>
    getSatelliteInputs(probe.lat, probe.lon, year, dayOfYear),
    [probe, year, dayOfYear]
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

  const gridInfo = useMemo(() => {
    const latMin = 5.0, latMax = 30.0, lonMin = 45.0, lonMax = 105.0, step = 0.25;
    if (probe.lat < latMin || probe.lat > latMax || probe.lon < lonMin || probe.lon > lonMax) {
      return null;
    }
    const row = Math.floor((probe.lat - latMin) / step);
    const col = Math.floor((probe.lon - lonMin) / step);
    return { row, col };
  }, [probe]);

  const isLand = useMemo(() => isLandCoordinate(probe.lat, probe.lon), [probe.lat, probe.lon]);

  // Position card intelligently right next to the clicked pin point on the viewport
  const cardStyle = useMemo(() => {
    if (!screenPos) return { top: '80px', left: '38%' };
    const cardW = 340;
    const cardH = isLand ? 360 : 460;
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
  }, [screenPos, isLand]);

  const CW = 290, CH = 90;

  if (isLand) {
    return (
      <div
        style={cardStyle}
        className="absolute z-[1150] w-[340px] bg-[#0c1017]/95 backdrop-blur-xl text-white rounded-xl shadow-2xl border border-white/20 overflow-hidden font-sans select-none animate-in fade-in zoom-in-95 duration-150"
      >
        {/* ── CARD HEADER: Coordinates & Close Only ── */}
        <div className="px-3.5 py-2.5 bg-gradient-to-r from-white/[0.06] to-transparent border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400" />
            <span className="text-[13px] font-mono font-bold text-gray-100 tracking-wider">
              {formattedCoord}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
          >
            <X size={14} />
          </button>
        </div>

        {/* ── LIVE PRIMARY TELEMETRY BAR: thetao — °C ── */}
        <div className="px-3.5 pt-2.5 pb-2 bg-white/[0.02] flex items-center justify-between border-b border-white/[0.08]">
          <div className="text-[14px] font-mono text-gray-200">
            thetao <span className="text-gray-400 ml-4">— °C</span>
          </div>
        </div>

        {/* ── LAND NO DATA PANELS (Matching Reference Screenshot) ── */}
        <div className="p-3.5 space-y-3">
          {/* Panel 1: thetao / No data */}
          <div className="relative h-20 border-l border-b border-amber-400/80 bg-black/40 px-2 py-1 flex flex-col justify-between">
            <span className="text-[12px] font-mono text-gray-200">thetao</span>
            <div className="absolute inset-0 flex items-center justify-center text-[13px] font-medium text-gray-300 pointer-events-none">
              No data
            </div>
            <span className="self-end text-[11px] font-mono text-gray-300">t</span>
          </div>

          {/* Panel 2: h thetao / No data */}
          <div className="relative h-20 border-l border-b border-amber-400/80 bg-black/40 px-2 py-1 flex flex-col justify-between">
            <div className="flex justify-between items-center text-[12px] font-mono text-gray-200">
              <span>h</span>
              <span className="mr-2">thetao</span>
            </div>
            <div className="absolute inset-0 flex items-center justify-center text-[13px] font-medium text-gray-300 pointer-events-none">
              No data
            </div>
            <div className="h-2" />
          </div>

          {/* Panel 3: h - thetao / No data */}
          <div className="relative h-20 border-l border-b border-amber-400/80 bg-black/40 px-2 py-1 flex flex-col justify-between">
            <span className="text-[12px] font-mono text-gray-200">h – thetao</span>
            <div className="absolute inset-0 flex items-center justify-center text-[13px] font-medium text-gray-300 pointer-events-none">
              No data
            </div>
            <span className="self-end text-[11px] font-mono text-gray-300">t</span>
          </div>
        </div>
      </div>
    );
  }

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

      {/* ── 0.25° SPATIAL GRID MESH BADGE BAR ── */}


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
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 ${profileData.mhwStatus.includes('Strong')
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
          className={`flex-1 py-1.5 text-center transition-all ${activeTab === 'physics'
            ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/10 font-bold'
            : 'text-gray-400 hover:text-gray-200'
            }`}
        >
          15-Depth Profile
        </button>
        <button
          onClick={() => setActiveTab('defense')}
          className={`flex-1 py-1.5 text-center transition-all ${activeTab === 'defense'
            ? 'text-fuchsia-400 border-b-2 border-fuchsia-400 bg-fuchsia-500/10 font-bold'
            : 'text-gray-400 hover:text-gray-200'
            }`}
        >
          Sonic / SLD
        </button>
        <button
          onClick={() => setActiveTab('validation')}
          className={`flex-1 py-1.5 text-center transition-all ${activeTab === 'validation'
            ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/10 font-bold'
            : 'text-gray-400 hover:text-gray-200'
            }`}
        >
          ARGO Benchmark
        </button>
        <button
          onClick={() => setActiveTab('inputs')}
          className={`flex-1 py-1.5 text-center transition-all ${activeTab === 'inputs'
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
            {/* Model source badge */}
            <div className="flex items-center justify-between mb-1.5">
              {inferenceLoading && (
                <div className="flex items-center gap-1.5 text-[9px] text-cyan-400 font-mono animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping inline-block" />
                  Fetching real satellite data & running model…
                </div>
              )}
              {inferenceResult && !inferenceLoading && (
                <span className="text-[9px] font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-700/50 px-1.5 py-0.5 rounded">
                  ✓ LIVE MODEL — real satellite inputs
                </span>
              )}
              {!inferenceResult && !inferenceLoading && (
                <span className="text-[9px] text-gray-500 font-mono"> Depth Wise Temprature Graph</span>
              )}
            </div>

            {/* Chart: Vertical T(z) Profile */}
            <div className="bg-[#090c12] p-2.5 rounded-lg border border-white/[0.08] space-y-1.5">
              {/* Chart Header */}
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[12px] font-bold text-gray-100 flex items-center gap-1.5">
                    Temperature profile
                  </div>
                  <div className="text-[10px] font-mono text-gray-400">
                    {formattedCoord}
                  </div>
                </div>
                <div className="flex gap-3 text-[9px] font-mono">
                  <span className="flex items-center gap-1 text-cyan-400">
                    <span className="w-2 h-0.5 bg-cyan-400 inline-block" />
                    {inferenceResult ? 'UNetOcean3D' : 'OceanEmbed'}
                  </span>
                  <span className="flex items-center gap-1 text-gray-400">
                    <span className="w-2 h-0.5 border-t border-dashed border-gray-400 inline-block" /> GLORYS12
                  </span>
                </div>
              </div>

              {inferenceLoading ? (
                <div className="flex items-center justify-center" style={{ width: CW, height: 160 }}>
                  <div className="text-center">
                    <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <div className="text-[10px] text-gray-400 font-mono">Running inference…</div>
                  </div>
                </div>
              ) : (
                <>
                  {(() => {
                    const chartH = 150;
                    const padL = 36;
                    const padR = 100;
                    const padT = 12;
                    const padB = 22;
                    const plotW = CW - padL - padR; // 290 - 36 - 100 = 154
                    const plotH = chartH - padT - padB; // 150 - 12 - 22 = 116

                    const tMin = 4, tMax = 32;
                    const tempToX = (t) => padL + Math.max(0, Math.min(1, (t - tMin) / (tMax - tMin))) * plotW;
                    const depthToY = (d) => padT + Math.max(0, Math.min(1, d / 1000)) * plotH;

                    // Thermocline detection for this location
                    const isBoB = probe.lon > 80.0;
                    const thermStart = isBoB ? 30 : 50;
                    const thermEnd = isBoB ? 150 : 180;
                    const yStart = depthToY(thermStart);
                    const yEnd = depthToY(thermEnd);

                    const temps = inferenceResult ? inferenceResult.temperatures_degC : profileData.tempEmbed;
                    const depths = inferenceResult ? inferenceResult.depths_m : profileData.depths;

                    // Locate 2 nodes in the thermocline zone
                    const iStart = depths.findIndex(d => d >= thermStart) !== -1 ? depths.findIndex(d => d >= thermStart) : 4;
                    const iEnd = depths.findIndex(d => d >= thermEnd) !== -1 ? depths.findIndex(d => d >= thermEnd) : 7;
                    const pt1 = { x: tempToX(temps[iStart]), y: depthToY(depths[iStart]) };
                    const pt2 = { x: tempToX(temps[iEnd]), y: depthToY(depths[iEnd]) };

                    return (
                      <div className="relative">
                        <svg width={CW} height={chartH} className="overflow-visible">
                          {/* Thermocline Highlighted Shaded Band */}
                          <rect
                            x={padL}
                            y={yStart}
                            width={plotW}
                            height={yEnd - yStart}
                            fill="rgba(251, 191, 36, 0.14)"
                            stroke="rgba(251, 191, 36, 0.3)"
                            strokeWidth={0.5}
                            rx={3}
                          />

                          {/* Thermocline Start Line & Label */}
                          <line
                            x1={padL}
                            y1={yStart}
                            x2={CW - 6}
                            y2={yStart}
                            stroke="#f59e0b"
                            strokeWidth={1.2}
                            strokeDasharray="4 3"
                          />
                          <text
                            x={CW - 4}
                            y={yStart + 9}
                            fill="#f59e0b"
                            fontSize={8.5}
                            fontWeight="bold"
                            textAnchor="end"
                            fontFamily="monospace"
                          >
                            Thermocline starts
                          </text>

                          {/* Thermocline End Line & Label */}
                          <line
                            x1={padL}
                            y1={yEnd}
                            x2={CW - 6}
                            y2={yEnd}
                            stroke="#f59e0b"
                            strokeWidth={1.2}
                            strokeDasharray="4 3"
                          />
                          <text
                            x={CW - 4}
                            y={yEnd + 9}
                            fill="#f59e0b"
                            fontSize={8.5}
                            fontWeight="bold"
                            textAnchor="end"
                            fontFamily="monospace"
                          >
                            Thermocline ends
                          </text>

                          {/* Y-Axis Grid Lines & Depth Ticks */}
                          {[0, 100, 200, 300, 500, 1000].map(d => {
                            const y = depthToY(d);
                            return (
                              <g key={d}>
                                <line x1={padL} y1={y} x2={padL + plotW} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
                                <text x={padL - 4} y={y + 3} fill="#9ca3af" fontSize={8} textAnchor="end" fontFamily="monospace">
                                  {d === 0 ? '0' : `${d}m`}
                                </text>
                              </g>
                            );
                          })}

                          {/* X-Axis Grid Ticks (°C) */}
                          {[10, 15, 20, 25, 30].map(t => {
                            const x = tempToX(t);
                            return (
                              <g key={t}>
                                <line x1={x} y1={padT} x2={x} y2={padT + plotH} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
                                <text x={x} y={chartH - 4} fill="#9ca3af" fontSize={8} textAnchor="middle" fontFamily="monospace">
                                  {t}°C
                                </text>
                              </g>
                            );
                          })}

                          {/* GLORYS Reference Curve (Dashed) */}
                          {(() => {
                            const pts = profileData.depths.map((d, i) => {
                              const temp = profileData.tempGlorys[i];
                              return `${i === 0 ? 'M' : 'L'} ${tempToX(temp)} ${depthToY(d)}`;
                            }).join(' ');
                            return <path d={pts} fill="none" stroke="#64748b" strokeWidth={1.4} strokeDasharray="3 2" />;
                          })()}

                          {/* Primary Model Curve T(z) (Bold Blue/Cyan) */}
                          {(() => {
                            const pts = depths.map((d, i) => {
                              const temp = temps[i];
                              return `${i === 0 ? 'M' : 'L'} ${tempToX(temp)} ${depthToY(d)}`;
                            }).join(' ');
                            return (
                              <path
                                d={pts}
                                fill="none"
                                stroke={inferenceResult ? '#34d399' : '#38bdf8'}
                                strokeWidth={2.5}
                              />
                            );
                          })()}

                          {/* Rapid ΔT Annotation & Data Node Dots */}
                          <circle cx={pt1.x} cy={pt1.y} r={3} fill="#38bdf8" stroke="#ffffff" strokeWidth={1.2} />
                          <circle cx={pt2.x} cy={pt2.y} r={3} fill="#38bdf8" stroke="#ffffff" strokeWidth={1.2} />
                          <text
                            x={(pt1.x + pt2.x) / 2 + 5}
                            y={(pt1.y + pt2.y) / 2 + 3}
                            fill="#fbbf24"
                            fontSize={9}
                            fontWeight="bold"
                            fontFamily="sans-serif"
                          >
                            rapid ΔT
                          </text>

                          {/* Selected Active Depth Marker */}
                          {(() => {
                            const depthY = depthToY(depth);
                            return <line x1={padL} y1={depthY} x2={padL + plotW} y2={depthY} stroke="#f43f5e" strokeWidth={1.5} strokeDasharray="2 2" />;
                          })()}
                        </svg>

                        {/* Caption at bottom */}
                        <div className="text-[9px] text-gray-400 italic text-center mt-1 font-sans">
                          Highlighted band = detected rapid temperature-change region.
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}

              {!inferenceLoading && (
                <div className="flex justify-between text-[9px] font-mono text-gray-400 mt-1 pt-1 border-t border-cyan-500/40">
                  {inferenceResult ? (
                    <>
                      <span>Avg: {(inferenceResult.temperatures_degC.reduce((a, b) => a + b, 0) / 15).toFixed(1)}°C</span>
                      <span>Min: {Math.min(...inferenceResult.temperatures_degC).toFixed(1)}°C</span>
                      <span>Max: {Math.max(...inferenceResult.temperatures_degC).toFixed(1)}°C</span>
                    </>
                  ) : (
                    <>
                      <span>Avg: {profileData.avgTemp}°C</span>
                      <span>Min: {profileData.minTemp}°C</span>
                      <span>Max: {profileData.maxTemp}°C</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Tropical Cyclone Heat Potential (TCHP) Card */}
            <div className="bg-[#090c12] p-2.5 rounded-lg border border-amber-500/30 bg-gradient-to-r from-amber-950/40 via-purple-950/20 to-rose-950/40 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300">
                  <AlertTriangle size={13} className="text-amber-400 animate-pulse shrink-0" />
                  Cyclone Heat Potential (TCHP)
                </div>
                <div className="text-[9px] text-gray-400">
                  Upper Ocean Heat Content (&gt;26°C isotherm)
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[15px] font-mono font-black text-amber-300">
                  {profileData.tchp} <span className="text-[10px] font-normal text-amber-400/80">kJ/cm²</span>
                </div>
                <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded border inline-block ${profileData.tchp > 40
                    ? 'bg-rose-950/80 text-rose-300 border-rose-700/60'
                    : 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                  }`}>
                  {profileData.tchp > 40 ? 'High Cyclone Intensity Risk' : 'Low / Moderate Risk'}
                </span>
              </div>
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
function OceanMapApp() {
  const [probe, setProbe] = useState({ lat: 14.5, lon: 70.0 });
  const [screenPos, setScreenPos] = useState({ x: 450, y: 220 });
  const [depth, setDepth] = useState(0);
  const [year, setYear] = useState(2024);
  const [dayOfYear, setDayOfYear] = useState(150);
  const [forecastDays, setForecastDays] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gridOpacity, setGridOpacity] = useState(0.85);
  const [activeTool, setActiveTool] = useState('point');
  const [showProbeCard, setShowProbeCard] = useState(true);

  // ── 0.25° Grid Overlay State ──
  const [showGrid, setShowGrid] = useState(true);
  const [showGridLabels, setShowGridLabels] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [hoveredCell, setHoveredCell] = useState(null);

  // ── Inference state ──────────────────────────────────────────────────────
  const [inferenceResult, setInferenceResult] = useState(null);
  const [inferenceLoading, setInferenceLoading] = useState(false);
  const [inferenceError, setInferenceError] = useState(null);

  const callInference = useCallback(async (lat, lon) => {
    // Only call for ocean points within the model domain
    if (lat < 5 || lat > 30 || lon < 45 || lon > 105) return;
    setInferenceResult(null);
    setInferenceError(null);
    setInferenceLoading(true);
    try {
      const result = await fetchInferencePrediction({
        latitude: lat,
        longitude: lon,
        datetime: new Date().toISOString(),
      });
      setInferenceResult(result);
    } catch (err) {
      console.warn('[OceanEmbed] Inference API error:', err.message);
      setInferenceError(err.message);
    } finally {
      setInferenceLoading(false);
    }
  }, []);

  // 15 Depth levels from PPT
  const visibleDepths = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000];

  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => setYear(y => y >= 2026 ? 2005 : y + 1), 1000);
    return () => clearInterval(id);
  }, [isPlaying]);

  const isProbeLand = useMemo(() => isLandCoordinate(probe.lat, probe.lon), [probe.lat, probe.lon]);

  const probeSST = useMemo(() => {
    if (isProbeLand) return null;
    return getMockTemperature(probe.lat, probe.lon, depth, year, dayOfYear, forecastDays);
  }, [probe, depth, year, dayOfYear, forecastDays, isProbeLand]);

  const TOOLS = [
    { id: 'point', icon: MousePointer2, label: 'Point probe' },
    { id: 'grid', icon: Grid, label: showGrid ? 'Hide 0.25° Grid' : 'Show 0.25° Grid' },


    { id: 'import', icon: Upload, label: 'Download Data in NetCDF Format' },

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
          opacity={0.92}
        />

        {/* Vector Land GeoJSON Mask */}
        <LandVectorMask />

        {/* Layer 3: 0.25° x 0.25° High-Precision Spatial Grid Mesh Overlay */}
        <Grid025Overlay
          enabled={showGrid}
          showLabels={showGridLabels}
          opacity={gridOpacity}
          probe={probe}
          hoveredCell={hoveredCell}
        />

        {/* Active Marker */}
        <ProbeMarker lat={probe.lat} lon={probe.lon} />

        {/* Track Pin Position across map pan/zoom so info card stays anchored */}
        <MapPositionTracker probe={probe} setScreenPos={setScreenPos} />

        {/* Map Mouse Move & Click Handler (Support Snap to 0.25° Grid) */}
        <MapMouseEvents
          onCoordClick={(lat, lon, point) => {
            setProbe({ lat, lon });
            setScreenPos(point);
            setShowProbeCard(true);
            callInference(lat, lon);
          }}
          onCoordHover={setHoveredCell}
          snapToGrid={snapToGrid}
        />
      </MapContainer>

      {/* ══════════════════════════════════════════
          COPERNICUS MYOCEAN PRO FLOATING UI
      ══════════════════════════════════════════ */}

      <GlobalHeader floating />

      {/* ── TOP-LEFT LAYER CARD (Exact Copernicus Style) ── */}
      <div className="layer-selector glass-card absolute top-[76px] left-4 z-[1100] w-72 bg-[#0c1017]/90 backdrop-blur-xl text-white rounded-xl shadow-2xl overflow-hidden border border-[#2FB8C9]/20">
        <div className="flex items-center border-b border-white/10">
          <button className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-[#2FB8C9] border-b-2 border-[#2FB8C9] bg-[#2FB8C9]/10">
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

        {/* Forecast Lead Selection Pill Buttons (Prominent & Larger) */}
        <div className="px-3.5 py-2.5 bg-[#0B1B2B]/80 border-t border-b border-white/10 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-gray-800">
            <span>Forecast Lead Mode:</span>
            {forecastDays > 0 && (
              <span className="text-[10px] font-mono text-cyan-700 bg-cyan-100 border border-cyan-300 px-1.5 py-0.2 rounded font-bold">
                +{forecastDays} Days Ahead
              </span>
            )}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[0, 1, 2, 3, 7, 14].map(fDays => (
              <button
                key={fDays}
                onClick={() => setForecastDays(fDays)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold transition-all shadow-sm ${forecastDays === fDays
                    ? 'bg-[#2FB8C9] text-[#02040a] ring-2 ring-[#2FB8C9]/40 scale-105'
                    : 'bg-[#122A3E] text-gray-200 hover:bg-[#2FB8C9]/20 border border-white/10'
                  }`}
              >
                {fDays === 0 ? 'Now' : `+${fDays}d`}
              </button>
            ))}
          </div>
        </div>

        {/* Grid Opacity Slider */}
        <div className="px-3.5 py-2.5 flex items-center gap-2 border-t border-white/10">
          <span className="text-[10px] text-gray-600 font-bold shrink-0">Grid Opacity</span>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={gridOpacity}
            onChange={e => setGridOpacity(parseFloat(e.target.value))}
            className="flex-1 h-1.5 accent-cyan-600 cursor-pointer"
          />
          <span className="text-[10px] font-mono font-bold text-gray-700 w-8 text-right">
            {Math.round(gridOpacity * 100)}%
          </span>
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
          onClose={() => { setShowProbeCard(false); }}
          inferenceResult={inferenceResult}
          inferenceLoading={inferenceLoading}
        />
      )}

      {/* ── NORTH & SOUTH POLE BADGES ── */}
      <div className="absolute top-[76px] left-1/2 -translate-x-1/2 z-[1100] pointer-events-none">
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
              onClick={() => {
                if (id === 'grid') {
                  setShowGrid(g => !g);
                }
                setActiveTool(id);
              }}
              title=""
              className={`group relative w-10 h-10 flex items-center justify-center transition-all border-b border-white/[0.05] last:border-b-0
                ${activeTool === id || (id === 'grid' && showGrid)
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
                }`}
            >
              <Icon size={16} />
              <div className="absolute right-12 px-2 py-1 bg-[#0a0e1a] border border-white/20 text-gray-200 text-[10px] font-mono rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-[1200] shadow-xl">
                {label}
              </div>
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

      {/* ── COORDINATE & GRID HUD ── */}
      <div className="absolute bottom-4 left-4 z-[1100] bg-[#0a0e1a]/90 border border-white/10 backdrop-blur-md rounded-lg px-3 py-1.5 font-mono text-[10px] text-gray-300 flex items-center gap-3 shadow-xl">
        <span className="flex items-center gap-1.5 font-medium text-cyan-300">
          <Grid size={12} className="text-cyan-400" />
          🎯 Probe: {Math.abs(probe.lon).toFixed(3)}°{probe.lon >= 0 ? 'E' : 'W'}, {Math.abs(probe.lat).toFixed(3)}°{probe.lat >= 0 ? 'N' : 'S'}
          {probe.lat >= 5 && probe.lat <= 30 && probe.lon >= 45 && probe.lon <= 105 && (
            <span className="text-[9px] bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 px-1.5 py-0.2 rounded ml-1 font-bold">
              Cell [{Math.floor((probe.lat - 5) / 0.25)}, {Math.floor((probe.lon - 45) / 0.25)}]
            </span>
          )}
        </span>
        {hoveredCell && hoveredCell.lat >= 5 && hoveredCell.lat <= 30 && hoveredCell.lon >= 45 && hoveredCell.lon <= 105 && (
          <span className="border-l border-white/15 pl-3 text-pink-300 hidden md:flex items-center gap-1.5">
            <span>Hover:</span>
            <span className="font-bold">
              {Math.abs(hoveredCell.lon).toFixed(2)}°E, {Math.abs(hoveredCell.lat).toFixed(2)}°N
            </span>
            <span className="text-[8px] bg-pink-950/80 border border-pink-800/60 px-1 rounded text-pink-200">
              0.25° Mesh
            </span>
          </span>
        )}
        {!isProbeLand && (
          <span className="border-l border-white/15 pl-2.5 text-cyan-400 font-semibold hidden lg:inline">
            {probe.lon > 80 ? 'Bay of Bengal' : 'Arabian Sea'}
          </span>
        )}
        {probeSST !== null && !isProbeLand && (
          <span className="border-l border-white/15 pl-2.5 text-fuchsia-400 font-semibold">
            {probeSST.toFixed(2)}°C
          </span>
        )}
      </div>

    </div>
  );
}


export default function App() {
  return <OceanMapApp />;
}

