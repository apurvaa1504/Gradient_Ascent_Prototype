/**
 * PFZLegend — Compact legend for the Thermocline-Enhanced PFZ layer
 * Team Gradient Ascent — SIH 2026
 *
 * Renders a small panel in the bottom-right area, consistent with
 * the existing dark oceanographic dashboard aesthetic.
 * Only shown when the PFZ layer is enabled.
 */

import { PFZ_POTENTIAL_CONFIG } from './pfzData';

const ENTRIES = ['high', 'moderate', 'low'];

/**
 * PFZLegend
 *
 * Props:
 *   visible — boolean (only render when PFZ layer is on)
 */
export function PFZLegend({ visible }) {
  if (!visible) return null;

  return (
    <div
      className="absolute bottom-4 right-[130px] z-[1100] bg-[#0a0e1a]/90 backdrop-blur-md border border-white/10 rounded-xl shadow-xl overflow-hidden"
      style={{ minWidth: '168px' }}
    >
      {/* Header */}
      <div className="px-3 py-1.5 bg-white/[0.04] border-b border-white/[0.07] flex items-center gap-1.5">
        <span className="text-base leading-none">🐟</span>
        <span className="text-[10px] font-bold text-gray-200 uppercase tracking-wider">
          Thermocline-Enhanced Potential Fishing Zones
        </span>
      </div>

      {/* Legend rows */}
      <div className="px-3 py-2 space-y-1.5">
        {ENTRIES.map((potential) => {
          const cfg = PFZ_POTENTIAL_CONFIG[potential];
          return (
            <div key={potential} className="flex items-center gap-2">
              {/* Color swatch */}
              <svg width={14} height={14} className="shrink-0">
                <rect
                  x={1} y={1} width={12} height={12}
                  fill={cfg.fillColor}
                  stroke={cfg.strokeColor}
                  strokeWidth={potential === 'low' ? 1 : 1.5}
                  strokeDasharray={potential === 'low' ? '3 2' : '0'}
                  rx={2}
                />
              </svg>
              <span className="text-[10px] font-medium" style={{ color: cfg.textColor }}>
                {cfg.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Formula footnote */}
      <div className="px-3 pb-2 text-[8px] text-gray-500 leading-relaxed border-t border-white/[0.06] pt-1.5">
        Thermocline + Chlorophyll<br />
        <span className="text-gray-400 font-mono">→ Enhanced PFZ Signal</span>
      </div>
    </div>
  );
}
