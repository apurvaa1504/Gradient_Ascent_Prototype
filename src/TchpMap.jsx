import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { classifyTchp } from './tchpPhysics';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
function pointFromEvent(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100), y: clamp(((event.clientY - rect.top) / rect.height) * 70, 0, 70) };
}
function makeProfile(region, point) {
  if (!point) return region.profile;
  const lon = 45 + point.x * 0.6;
  const lat = 30 - point.y * (25 / 70);
  const heatIndex = point.x * 0.72 + (70 - point.y) * 0.28;
  const tchp = Math.round(clamp(12 + heatIndex * 0.9, 12, 105));
  return { ...region.profile, location: `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`, tchp, d26: Math.round(clamp(35 + tchp * 1.05, 35, 180)), confidence: Math.round(clamp(region.profile.confidence - Math.abs(50 - point.x) * 0.12, 55, 95)) };
}

const buoySites = [
  { x: 53, y: 29, name: 'RAMA buoy 1', code: 'R1' }, { x: 68, y: 37, name: 'RAMA buoy 2', code: 'R2' },
  { x: 79, y: 23, name: 'ARGO float 1', code: 'A1' }, { x: 42, y: 48, name: 'ARGO float 2', code: 'A2' },
  { x: 87, y: 50, name: 'RAMA buoy 3', code: 'R3' },
];
const longitudeTicks = [0, 16.67, 33.33, 50, 66.67, 83.33, 100];
const latitudeTicks = [0, 14, 28, 42, 56, 70];

export default function TchpMap({ region, layer, selectedPoint, onSelect, onNotify }) {
  const [hoverPoint, setHoverPoint] = useState(null);
  const hoverProfile = hoverPoint ? makeProfile(region, hoverPoint) : null;
  const layerKey = layer.toLowerCase().replaceAll(' ', '-');
  const choosePoint = (point, message) => { onSelect(point); onNotify(message); };

  return <div className="tchp-map mission-map">
    <div className="map-toolbar"><span className="map-kicker"><span className="live-dot" /> North Indian Ocean · {layer}</span><span>24 Sep 2026 <i className="map-live-tag">DEMO DATA</i></span></div>
    <div className="map-stage">
      <svg viewBox="0 0 100 70" preserveAspectRatio="none" role="img" aria-label={`Interactive North Indian Ocean map showing ${layer}`} onClick={event => { const point = pointFromEvent(event); choosePoint(point, `Selected ${makeProfile(region, point).location}`); }} onMouseMove={event => setHoverPoint(pointFromEvent(event))} onMouseLeave={() => setHoverPoint(null)}>
        <defs>
          <linearGradient id="tchpOcean" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#15224b"/><stop offset=".25" stopColor="#145275"/><stop offset=".5" stopColor="#167d83"/><stop offset=".72" stopColor="#a77a3a"/><stop offset="1" stopColor="#bd5148"/></linearGradient>
          <radialGradient id="tchpHeat"><stop stopColor="#ffcc70" stopOpacity=".82"/><stop offset="1" stopColor="#f27332" stopOpacity="0"/></radialGradient>
          <pattern id="tchpGrid" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M4 0H0V4" fill="none" stroke="#c4e1e9" strokeOpacity=".14" strokeWidth=".12"/></pattern>
          <pattern id="tchpLandTexture" width="2.5" height="2.5" patternUnits="userSpaceOnUse"><path d="M0 2.5 2.5 0" stroke="#d2c298" strokeOpacity=".2" strokeWidth=".18"/></pattern>
          <marker id="tchpArrow" viewBox="0 0 4 4" refX="3.4" refY="2" markerWidth="2.4" markerHeight="2.4" orient="auto"><path d="M0 0 4 2 0 4Z" fill="#b8f2e9"/></marker>
          <filter id="tchpGlow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation=".8" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="100" height="70" fill="#071722"/><rect width="100" height="70" fill="url(#tchpOcean)" className={`map-surface layer-${layerKey}`}/>
        <g className="heat-texture" aria-hidden="true"><ellipse cx="56" cy="25" rx="22" ry="17" fill="url(#tchpHeat)"/><ellipse cx="75" cy="42" rx="19" ry="15" fill="url(#tchpHeat)"/><ellipse cx="38" cy="53" rx="20" ry="14" fill="#304eb3" opacity=".24"/></g>
        <rect width="100" height="70" fill="url(#tchpGrid)"/>
        <g className="graticule" aria-hidden="true">
          {longitudeTicks.map((x, i) => <g key={`lon-${x}`}><line x1={x} y1="0" x2={x} y2="70"/><text x={x === 100 ? x - 1 : x + 1} y="68.4" textAnchor={x === 100 ? 'end' : 'start'}>{45 + i * 10}°E</text></g>)}
          {latitudeTicks.map((y, i) => <g key={`lat-${y}`}><line x1="0" y1={y} x2="100" y2={y}/><text x="1.2" y={y === 0 ? 2.8 : y - 1}>{30 - i * 5}°N</text></g>)}
        </g>
        <g className="land-mass">
          <path d="M0 0H13L14 8 12.5 15 15 20 13 25 16 30 13 35 12 40 8 44 7 50 10 54 9 59 12 64 10 70H0Z"/>
          <path d="M17 16 22 15 27 17 32 18 36 22 35 26 32 29 30 33 27 32 24 29 21 27 19 23 16 21Z"/>
          <path d="M64 0H100V15L96 17 94 22 91 24 88 29 85 33 82 31 80 26 78 23 77 18 74 15 71 12 68 9Z"/>
          <path d="M68.6 35.4 70.1 34.2 71.1 36.5 70.6 39.5 69.5 40.3 68.7 38Z M85 43 88 42 91 44 93 48 96 51 98 58 100 60V70H95L94 64 91 61 90 56 87 53Z M82 14 84 13 85 15 84 17Z"/>
          <path className="land-texture" d="M0 0H13L14 8 12.5 15 15 20 13 25 16 30 13 35 12 40 8 44 7 50 10 54 9 59 12 64 10 70H0Z M17 16 22 15 27 17 32 18 36 22 35 26 32 29 30 33 27 32 24 29 21 27 19 23 16 21Z M64 0H100V15L96 17 94 22 91 24 88 29 85 33 82 31 80 26 78 23 77 18 74 15 71 12 68 9Z" fill="url(#tchpLandTexture)"/>
        </g>
        <g className="geographic-labels" aria-hidden="true"><text x="24" y="27">ARABIAN SEA</text><text x="76" y="48">BAY OF BENGAL</text><text x="73" y="8">INDIA</text><text x="69" y="37">Sri Lanka</text><text x="92" y="61">SUMATRA</text></g>
        <g className={`layer-overlay overlay-${layerKey}`}>
          {(layer === 'D26 depth' || layer === 'TCHP') && <g className="isobands"><path d="M24 52C34 42 42 45 50 34S70 23 88 30"/><path d="M19 59C33 48 40 52 54 39S73 29 91 35"/><path d="M31 62C42 56 53 52 64 43S78 39 94 42"/></g>}
          {(layer === 'SST anomaly' || layer === '100m anomaly') && <g className="anomaly-field"><ellipse cx="42" cy="42" rx="14" ry="9"/><ellipse cx="75" cy="28" rx="18" ry="12"/></g>}
          {layer === 'Confidence' && <g className="confidence-cells"><path d="M20 20H43V39H20Z M45 20H68V39H45Z M70 20H92V39H70Z M20 41H43V59H20Z M45 41H68V59H45Z M70 41H92V59H70Z"/></g>}
          {layer === 'Currents' && <g className="current-streams"><path d="M20 35C35 27 43 38 57 31S77 28 91 21" markerMid="url(#tchpArrow)" markerEnd="url(#tchpArrow)"/><path d="M19 48C34 41 44 49 58 43S76 39 92 34" markerMid="url(#tchpArrow)" markerEnd="url(#tchpArrow)"/><path d="M25 58C40 52 52 60 65 53S82 49 94 45" markerMid="url(#tchpArrow)" markerEnd="url(#tchpArrow)"/></g>}
        </g>
        <path className="corridor-track" d="M54 23C59 26 64 29 68 33S74 38 79 42"/>
        <g className="corridor-line"><path d="M48 47C57 40 63 43 69 34S79 27 86 21"/><circle cx="48" cy="47" r=".65"/><circle cx="61" cy="41" r=".65"/><circle cx="73" cy="32" r=".65"/><circle cx="86" cy="21" r=".65"/></g>
        {buoySites.map(site => <g key={site.name} className="map-point" role="button" tabIndex="0" aria-label={`Select ${site.name}`} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choosePoint(site, `Buoy profile selected: ${makeProfile(region, site).location}`); } }} onClick={event => { event.stopPropagation(); choosePoint(site, `Buoy profile selected: ${makeProfile(region, site).location}`); }}><circle className="buoy-halo" cx={site.x} cy={site.y} r="2.2"/><circle className="buoy-marker" cx={site.x} cy={site.y} r=".9"/><text x={site.x + 1.3} y={site.y - 1.2}>{site.code}</text><title>{site.name}</title></g>)}
        {selectedPoint && <g className="selected-location" pointerEvents="none"><circle cx={selectedPoint.x} cy={selectedPoint.y} r="2.2"/><circle cx={selectedPoint.x} cy={selectedPoint.y} r="3.7"/></g>}
        {hoverPoint && <g className="hover-crosshair" pointerEvents="none"><line x1={hoverPoint.x} x2={hoverPoint.x} y1="0" y2="70"/><line x1="0" x2="100" y1={hoverPoint.y} y2={hoverPoint.y}/><circle cx={hoverPoint.x} cy={hoverPoint.y} r="1.1"/></g>}
      </svg>
      {hoverProfile && <div className="map-tooltip"><b><MapPin size={12}/>{hoverProfile.location}</b><span>TCHP <strong>{hoverProfile.tchp} kJ/cm²</strong></span><span>D26 <strong>{hoverProfile.d26} m</strong></span><span>Confidence <strong>{hoverProfile.confidence}%</strong></span><em>{classifyTchp(hoverProfile.tchp)}</em></div>}
      <div className="map-scale"><span>0</span><i/><span>500 km</span></div>
    </div>
    <div className="map-legend"><span>LOW RESERVOIR</span><div className={`legend-ramp legend-${layerKey}`} /><span>HIGH SUPPORT</span></div>
    <div className="map-caption"><span><MapPin size={12}/> Click or hover an ocean cell to inspect it</span><span>North Indian Ocean · 5–30°N · 45–105°E · 0.25° grid</span></div>
  </div>;
}
