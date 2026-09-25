/**
 * PFZPopup — Detailed oceanographic info card for a clicked PFZ zone
 * Team Gradient Ascent — SIH 2026
 *
 * Uses the same design language as OceanEmbedProbeCard in App.jsx:
 * - bg-[#0c1017]/95 backdrop-blur-xl
 * - border border-white/15
 * - dark monospace data rows
 * - SVG mini-chart for temperature profile
 */

import { useMemo } from 'react';
import { X } from 'lucide-react';
import { PFZ_POTENTIAL_CONFIG } from './pfzData';

const POTENTIAL_BADGE = {
  high:     { bg: 'bg-amber-950/80',   text: 'text-amber-300',   border: 'border-amber-500/70',   label: '● HIGH PFZ POTENTIAL' },
  moderate: { bg: 'bg-fuchsia-950/80', text: 'text-fuchsia-300', border: 'border-fuchsia-500/70', label: '● MODERATE PFZ POTENTIAL' },
  low:      { bg: 'bg-slate-900/80',   text: 'text-slate-200',   border: 'border-slate-400/60',   label: '○ LOW / UNCERTAIN' },
};

/**
 * PFZPopup
 *
 * Props:
 *   zone      — PFZ zone object from pfzData.js
 *   screenPos — {x, y} pixel position on screen (from Leaflet latlng)
 *   onClose   — callback to dismiss
 *   depth     — currently selected depth (from existing UI)
 */
export function PFZPopup({ zone, screenPos, onClose, depth }) {
  const cfg = PFZ_POTENTIAL_CONFIG[zone.potential];
  const badge = POTENTIAL_BADGE[zone.potential];

  // ── Smart card positioning (same logic as OceanEmbedProbeCard) ───────────
  const cardStyle = useMemo(() => {
    const cardW = 310;
    const cardH = 480;
    const pad = 16;
    let left = (screenPos?.x ?? 500) + 14;
    let top  = (screenPos?.y ?? 300) - 20;

    if (left + cardW > window.innerWidth - pad)  left = (screenPos?.x ?? 500) - cardW - 14;
    if (top  + cardH > window.innerHeight - 60)  top  = window.innerHeight - cardH - 60;
    if (top < 50) top = 50;

    return { top: `${top}px`, left: `${left}px` };
  }, [screenPos]);

  // ── Mini T(z) profile chart ───────────────────────────────────────────────
  const chartW = 265, chartH = 120;
  const padL = 32, padR = 8, padT = 10, padB = 18;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const profile = zone.depthProfile;
  const maxDepth = profile[profile.length - 1].depth;
  const tMin = Math.min(...profile.map(p => p.temp)) - 1;
  const tMax = Math.max(...profile.map(p => p.temp)) + 1;

  const tempToX  = (t) => padL + Math.max(0, Math.min(1, (t - tMin) / (tMax - tMin))) * plotW;
  const depthToY = (d) => padT + Math.max(0, Math.min(1, d / maxDepth)) * plotH;

  const pathD = profile.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${tempToX(p.temp)} ${depthToY(p.depth)}`
  ).join(' ');

  // Thermocline entry point
  const thermY = depthToY(zone.thermoclineDepth);

  return (
    <div
      style={cardStyle}
      className="absolute z-[1160] w-[310px] bg-[#0c1017]/95 backdrop-blur-xl text-white rounded-xl shadow-2xl border border-white/15 overflow-hidden font-sans select-none"
    >
      {/* ── HEADER ── */}
      <div className="px-3.5 py-2.5 bg-gradient-to-r from-white/[0.06] to-transparent border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🐟</span>
          <span className="text-[11px] font-mono font-bold text-gray-100 tracking-wider">
            POTENTIAL FISHING ZONE
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
          aria-label="Close PFZ popup"
        >
          <X size={14} />
        </button>
      </div>

      {/* ── ZONE IDENTITY ── */}
      <div className="px-3.5 pt-2.5 pb-2 border-b border-white/[0.06] flex items-center justify-between">
        <div>
          <div className="text-[16px] font-mono font-extrabold" style={{ color: cfg.textColor }}>
            {zone.id}
          </div>
          <div className="text-[10px] text-gray-400 font-medium">{zone.region} · {zone.label}</div>
        </div>
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${badge.bg} ${badge.text} ${badge.border}`}>
          {zone.potential.toUpperCase()}
        </span>
      </div>

      {/* ── METRIC TABLE ── */}
      <div className="px-3.5 pt-2 pb-1 grid grid-cols-2 gap-x-4 gap-y-1.5 border-b border-white/[0.06]">
        {[
          { label: 'Thermocline Depth', value: `${zone.thermoclineDepth} m`,       color: '#f59e0b' },
          { label: 'Chlorophyll-a',     value: `${zone.chlorophyll} mg/m³`,         color: '#34d399' },
          { label: 'SST',               value: `${zone.sst}°C`,                     color: '#38bdf8' },
          { label: 'Lat / Lon',         value: `${zone.centroid[0].toFixed(1)}°N, ${zone.centroid[1].toFixed(1)}°E`, color: '#a78bfa' },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex flex-col">
            <span className="text-[8px] font-medium text-gray-500 uppercase tracking-wide">{label}</span>
            <span className="text-[11px] font-mono font-bold" style={{ color }}>{value}</span>
          </div>
        ))}
      </div>

      {/* ── THERMOCLINE CONTEXT ── */}
      <div className="px-3.5 py-1.5 border-b border-white/[0.06] flex items-start gap-2">
        <div className="mt-0.5 w-2 h-2 rounded-full shrink-0" style={{ background: '#f59e0b' }} />
        <div>
          <div className="text-[10px] font-semibold text-amber-300">
            Thermocline at {zone.thermoclineDepth} m
          </div>
          <div className="text-[8.5px] text-gray-400 leading-snug">
            Detected from rapid temperature change with depth.
            {depth > 0 && depth !== zone.thermoclineDepth && (
              <span className="text-fuchsia-400 ml-1">(Active view depth: {depth}m)</span>
            )}
          </div>
        </div>
      </div>

      {/* ── SUBSURFACE SIGNAL CHART ── */}
      <div className="px-3.5 pt-2 pb-1">
        <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
          Subsurface Signal T(z)
        </div>
        <div className="bg-[#090c12] rounded-lg border border-white/[0.07] p-2">
          <svg width={chartW} height={chartH} className="overflow-visible">
            {/* Thermocline band highlight */}
            <rect
              x={padL} y={thermY - 2}
              width={plotW} height={16}
              fill="rgba(245, 158, 11, 0.12)"
              stroke="rgba(245, 158, 11, 0.3)"
              strokeWidth={0.5} rx={2}
            />
            {/* Thermocline dashed line */}
            <line
              x1={padL} y1={thermY}
              x2={padL + plotW} y2={thermY}
              stroke="#f59e0b" strokeWidth={1.2} strokeDasharray="4 3"
            />
            <text
              x={padL + plotW + 3} y={thermY + 3}
              fill="#f59e0b" fontSize={7.5} fontFamily="monospace" textAnchor="start"
            >
              ← {zone.thermoclineDepth}m
            </text>

            {/* Depth grid lines */}
            {profile.map(p => {
              const y = depthToY(p.depth);
              return (
                <g key={p.depth}>
                  <line x1={padL} y1={y} x2={padL + plotW} y2={y}
                    stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
                  <text x={padL - 3} y={y + 3} fill="#6b7280" fontSize={7}
                    textAnchor="end" fontFamily="monospace">
                    {p.depth}m
                  </text>
                </g>
              );
            })}

            {/* Temperature profile curve */}
            <path d={pathD} fill="none" stroke={cfg.strokeColor} strokeWidth={2} />

            {/* Data node dots, highlight thermocline node */}
            {profile.map(p => {
              const isTherm = p.depth === zone.thermoclineDepth;
              return (
                <circle
                  key={p.depth}
                  cx={tempToX(p.temp)} cy={depthToY(p.depth)}
                  r={isTherm ? 4 : 2.5}
                  fill={isTherm ? '#f59e0b' : cfg.strokeColor}
                  stroke={isTherm ? '#ffffff' : 'none'}
                  strokeWidth={isTherm ? 1.5 : 0}
                />
              );
            })}

            {/* Temp annotations beside the thermocline node */}
            {profile.map(p => {
              const isTherm = p.depth === zone.thermoclineDepth;
              if (!isTherm) return null;
              return (
                <text
                  key={`label-${p.depth}`}
                  x={tempToX(p.temp) + 6}
                  y={depthToY(p.depth) + 3}
                  fill="#f59e0b" fontSize={7.5} fontFamily="monospace"
                >
                  {p.temp}°C
                </text>
              );
            })}
          </svg>
        </div>
      </div>

      {/* ── FOOTER BADGE ── */}
      <div className={`mx-3.5 mb-3 mt-1 px-2.5 py-1.5 rounded-md border text-center text-[10px] font-bold ${badge.bg} ${badge.text} ${badge.border}`}>
        {badge.label}
      </div>

      {/* ── SCIENTIFIC NOTE ── */}
      <div className="px-3.5 pb-2.5 text-[8px] text-gray-500 leading-relaxed">
        Shallow thermocline + elevated chlorophyll → upwelling signal → fish aggregation likelihood.
      </div>
    </div>
  );
}
