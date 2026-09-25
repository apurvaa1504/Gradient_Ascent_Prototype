import React from 'react';
import { Info } from 'lucide-react';
import { otecTheme } from '../otec-theme';

export function GlassCard({ children, className = '', title, style = {} }) {
  return <section className={`glass-card ${className}`} style={style}>{title && <h3 className="glass-card-title">{title}</h3>}{children}</section>;
}

export function MetricReadout({ value, unit, label, className = '' }) {
  return <span className={`metric-readout ${className}`} data-metric>{label && <small>{label}</small>}<strong>{value}</strong>{unit && <small>{unit}</small>}</span>;
}

export function TabGroup({ tabs, value, onChange, className = '' }) {
  return <div className={`shared-tab-group ${className}`} role="tablist">{tabs.map(tab => { const label = typeof tab === 'string' ? tab : tab.label; const key = typeof tab === 'string' ? tab : tab.value; return <button key={key} role="tab" aria-selected={value === key} className={value === key ? 'active' : ''} onClick={() => onChange(key)}>{label}</button>; })}</div>;
}

export function SliderControl({ label, ...props }) {
  return <label className="shared-slider"><span>{label}</span><input type="range" {...props} /></label>;
}

export function LegendGradientBar({ label, gradient = 'linear-gradient(90deg,#0f0a28,#301258,#5c166e,#912664,#c84146,#f27332,#fdb955,#fefab4)' }) {
  return <div className="shared-legend">{label && <span>{label}</span>}<i style={{ background: gradient }} /></div>;
}

export function ExportButton({ children = 'Export', ...props }) {
  return <button className="shared-export-button" {...props}>{children}</button>;
}

export function ToastNotification({ children, onClose }) {
  return <div className="shared-toast" role="status">{children}{onClose && <button onClick={onClose} aria-label="Dismiss">×</button>}</div>;
}

// Wrapper for all charts/tables
export function SectionCard({ children, title, subtitle }) {
  return (
    <div style={{
      backgroundColor: otecTheme.colors.panel,
      borderRadius: otecTheme.radius.lg,
      boxShadow: otecTheme.shadow.soft,
      border: `1px solid ${otecTheme.colors.border}`,
      overflow: 'hidden'
    }}>
      {(title || subtitle) && (
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${otecTheme.colors.border}` }}>
          {title && <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: otecTheme.colors.textMain }}>{title}</h3>}
          {subtitle && <p style={{ margin: '4px 0 0', fontSize: '13px', color: otecTheme.colors.textSecondary }}>{subtitle}</p>}
        </div>
      )}
      <div style={{ padding: '20px' }}>
        {children}
      </div>
    </div>
  );
}

export function InfoTooltip({ text }) {
  return (
    <span className="group relative inline-flex items-center cursor-help ml-1 align-middle">
      <Info size={14} color={otecTheme.colors.textSecondary} />
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-[#0B1B2B] text-[#F2F6F8] text-[11px] leading-tight rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 text-center border border-white/10">
        {text}
      </span>
    </span>
  );
}

// Colorblind-safe status badge
export function StatusBadge({ status, label, className = '' }) {
  let bgColor, textColor, icon;
  
  if (status === 'good' || status === 'viable') {
    bgColor = 'rgba(63, 191, 127, 0.15)';
    textColor = otecTheme.colors.statusGreen;
    icon = '✓';
  } else if (status === 'marginal' || status === 'caution') {
    bgColor = 'rgba(224, 168, 46, 0.15)';
    textColor = otecTheme.colors.statusAmber;
    icon = '!';
  } else if (status === 'alert' || status === 'non-viable') {
    bgColor = 'rgba(224, 82, 77, 0.15)';
    textColor = otecTheme.colors.statusRed;
    icon = '✗';
  } else {
    bgColor = 'rgba(159, 179, 196, 0.15)';
    textColor = otecTheme.colors.textSecondary;
    icon = '·';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${className}`} style={{ backgroundColor: bgColor, color: textColor }}>
      <span style={{ fontSize: '10px' }} aria-hidden="true">{icon}</span>
      {label}
    </span>
  );
}

// Colored threshold bar
export function ThresholdBar({ value, min, max, target, thresholds = [] }) {
  const percent = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  
  // Default thresholds if none provided: red (0-33%), amber (33-66%), green (66-100%)
  const segments = thresholds.length ? thresholds : [
    { color: otecTheme.colors.statusRed, width: '33.3%' },
    { color: otecTheme.colors.statusAmber, width: '33.3%' },
    { color: otecTheme.colors.statusGreen, width: '33.4%' },
  ];

  return (
    <div className="relative w-full h-1.5 bg-gray-800 rounded-full mt-2 overflow-hidden flex">
      {segments.map((seg, i) => (
        <div key={i} style={{ backgroundColor: seg.color, width: seg.width, height: '100%', opacity: 0.8 }} />
      ))}
      <div 
        className="absolute top-0 bottom-0 w-1 bg-white shadow-sm transition-all duration-500 z-10" 
        style={{ left: `calc(${percent}% - 2px)` }}
      />
      {target !== undefined && (
        <div 
          className="absolute top-0 bottom-0 w-px bg-white/50 border-l border-dashed border-white transition-all z-0" 
          style={{ left: `${Math.min(100, Math.max(0, ((target - min) / (max - min)) * 100))}%` }}
        />
      )}
    </div>
  );
}

export function KpiCard({ icon: Icon, title, value, unit, statusLabel, statusType, description, barProps, children }) {
  return (
    <div style={{
      backgroundColor: otecTheme.colors.panel,
      borderRadius: otecTheme.radius.base,
      border: `1px solid ${otecTheme.colors.border}`,
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      height: '100%'
    }}>
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2 text-[13px] font-medium" style={{ color: otecTheme.colors.textSecondary }}>
          {Icon && <Icon size={16} />}
          {title}
        </div>
        {statusLabel && <StatusBadge status={statusType} label={statusLabel} />}
      </div>
      
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-3xl font-bold tabular-nums" style={{ color: otecTheme.colors.textMain }}>
          {value}
        </span>
        {unit && <span className="text-sm font-medium" style={{ color: otecTheme.colors.textSecondary }}>{unit}</span>}
      </div>

      {barProps && <ThresholdBar {...barProps} />}

      {description && (
        <div className="text-[12px] mt-1" style={{ color: otecTheme.colors.textSecondary }}>
          {description}
        </div>
      )}
      
      {children && (
        <div className="mt-2 flex-1 flex flex-col justify-end">
          {children}
        </div>
      )}
    </div>
  );
}
