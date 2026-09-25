import React, { useState, useMemo } from 'react';
import { otecTheme } from './otec-theme';
import { SectionCard, KpiCard, ThresholdBar, StatusBadge, InfoTooltip } from './components/SharedComponents';
import { Activity, Download, Calendar, MapPin, Clock, Thermometer, Zap, Droplets, Map, TrendingUp, TrendingDown, AlertCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, ReferenceLine, ReferenceArea, Tooltip as RechartsTooltip, ResponsiveContainer, ComposedChart, ReferenceDot, Bar } from 'recharts';
import { DAILY_FORECAST } from './mock-data/daily-forecast';
import { SITES } from './mock-data/sites';
import { DEPTH_PROFILE } from './mock-data/depth-profile';
import { HISTORY_30DAY } from './mock-data/history-30day';
import SiteExplorerTab from './components/SiteExplorerTab';
import FutureSiteRankingTab from './components/FutureSiteRankingTab';
import GlobalHeader from './components/GlobalHeader.jsx';

export default function OtecApp() {
  const [activeTab, setActiveTab] = useState("Today's Operations");
  const tabs = ["Today's Operations", "Site Explorer", "Future Site Ranking"];

  // Mock data for Tab 1
  const [selectedSiteId, setSelectedSiteId] = useState('kavaratti');
  const [compareList, setCompareList] = useState([]);
  const siteInfo = SITES.find(s => s.id === selectedSiteId);
  const forecast7Days = DAILY_FORECAST[selectedSiteId];
  const todayForecast = forecast7Days[0];
  const profile = DEPTH_PROFILE[selectedSiteId][todayForecast.date];
  const history30Day = HISTORY_30DAY[selectedSiteId];

  // State for Intake Depth (500, 700, 1000)
  const [intakeDepth, setIntakeDepth] = useState(1000);

  // Computed KPIs based on intake depth
  const surfaceTemp = profile.find(p => p.depth_m === 0)?.temp_c || 29.1;
  const deepTemp = profile.find(p => p.depth_m === intakeDepth)?.temp_c || 4.0;
  const computedDeltaT = Number((surfaceTemp - deepTemp).toFixed(1));

  const efficiencyFactor = Math.max(0, (computedDeltaT - 18) / 4);
  const computedPower = Math.round(1000 * efficiencyFactor);
  const computedWater = Math.round(computedPower * 105.5);
  const computedWaterLakh = (computedWater / 100000).toFixed(2);

  let deltaTStatus = 'viable';
  let deltaTStatusLabel = 'VIABLE';
  if (computedDeltaT < 20) {
    deltaTStatus = 'non-viable';
    deltaTStatusLabel = 'ALERT';
  } else if (computedDeltaT < 21) {
    deltaTStatus = 'caution';
    deltaTStatusLabel = 'MARGINAL';
  }

  // Derive decision status
  let decisionColor = otecTheme.colors.statusGreen;
  let decisionBadge = 'Run OTEC normally';
  if (computedDeltaT < 21 && computedDeltaT >= 20) {
    decisionColor = otecTheme.colors.statusAmber;
    decisionBadge = 'Use blended OTEC + diesel';
  } else if (computedDeltaT < 20) {
    decisionColor = otecTheme.colors.statusRed;
    decisionBadge = 'Activate backup generation';
  }

  // Generate enriched forecast data for right panel (mock uncertainties)
  const enrichedForecast = useMemo(() => {
    return forecast7Days.map((day, i) => {
      return {
        ...day,
        dtMin: day.deltaT - 0.3,
        dtMax: day.deltaT + 0.3,
        powerMin: day.grossPowerKw - 45,
        powerMax: day.grossPowerKw + 45
      };
    });
  }, [forecast7Days]);

  return (
    <div style={{ minHeight: '100vh', overflowY: 'auto', backgroundColor: 'var(--bg-base)', color: otecTheme.colors.textMain, fontFamily: 'var(--ui-font)' }}>
      <GlobalHeader subLabel="" />
      {/* Top Header Bar */}
      <header style={{
        backgroundColor: otecTheme.colors.panel,
        borderBottom: `1px solid ${otecTheme.colors.border}`,
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Link to="/" style={{ color: otecTheme.colors.textSecondary, display: 'flex', alignItems: 'center' }} title="Back to OceanEmbed Dashboard">
                <ArrowLeft size={18} />
              </Link>
              <div style={{ width: '24px', height: '24px', backgroundColor: otecTheme.colors.accentTeal, color: otecTheme.colors.bg, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Activity size={16} />
              </div>
              <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', tracking: 'wide' }}>OTEC Intelligence Platform</h1>
            </div>
            <p style={{ margin: '4px 0 0 32px', fontSize: '12px', color: otecTheme.colors.textSecondary }}>
              From daily AI-reconstructed ocean profiles to clean-energy, freshwater, and site-selection decisions.
            </p>
          </div>

          <nav style={{ display: 'flex', gap: '8px' }}>
            {tabs.map(tab => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: isActive ? `2px solid ${otecTheme.colors.accentTeal}` : '2px solid transparent',
                    color: isActive ? otecTheme.colors.textMain : otecTheme.colors.textSecondary,
                    padding: '8px 12px',
                    fontSize: '13px',
                    fontWeight: isActive ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {tab}
                </button>
              );
            })}
          </nav>
        </div>
      </header>



      {/* Main Content Area */}
      <main style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
        {activeTab === "Today's Operations" && (
          <div className="flex flex-col gap-6">
            {/* Sub-header Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Site Dropdown */}
                <div className="flex items-center gap-2 bg-[#122A3E] border border-white/10 rounded px-3 py-1.5 cursor-pointer hover:bg-white/5 transition-colors">
                  <MapPin size={14} className="text-[#2FB8C9]" />
                  <select value={selectedSiteId} onChange={(e) => setSelectedSiteId(e.target.value)} className="bg-transparent border-none text-[13px] font-medium text-white outline-none cursor-pointer">
                    {SITES.map(s => <option key={s.id} value={s.id}>{s.name}, {s.region}</option>)}
                  </select>
                </div>

                {/* Date Selector */}
                <div className="flex items-center gap-2 bg-[#122A3E] border border-white/10 rounded px-3 py-1.5">
                  <Calendar size={14} className="text-[#2FB8C9]" />
                  <span className="text-[13px] font-medium">{new Date(todayForecast.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>

                {/* Forecast Horizon */}
                <div className="flex items-center gap-2 bg-[#122A3E] border border-white/10 rounded px-3 py-1.5">
                  <Clock size={14} className="text-[#2FB8C9]" />
                  <select className="bg-transparent border-none text-[13px] font-medium text-white outline-none cursor-pointer">
                    <option value="today">Today</option>
                    <option value="3days">Next 3 Days</option>
                    <option value="7days">Next 7 Days</option>
                  </select>
                </div>

                {/* Status Pill */}
                <div className="flex items-center bg-[#122A3E] border border-white/10 rounded-full px-3 py-1 text-[12px] font-medium">
                  <span className="w-2 h-2 rounded-full bg-[#3FBF7F] mr-2"></span>
                  Model confidence: High
                  <InfoTooltip text="Confidence based on satellite data density and model validation against in-situ buoys in the region." />
                </div>
              </div>

              {/* Export Button */}
              <button className="flex items-center gap-2 bg-transparent hover:bg-white/5 border border-white/20 text-[#F2F6F8] rounded px-3 py-1.5 text-[13px] font-medium transition-colors cursor-pointer">
                <Download size={14} />
                Download Daily Advisory
              </button>
            </div>

            {/* KPI Cards Row */}
            <div className="grid grid-cols-4 gap-4">
              {/* CARD 1: Thermal Gradient */}
              <KpiCard
                icon={Thermometer}
                title="Thermal Gradient (ΔT)"
                value={computedDeltaT}
                unit="°C ± 0.2°C"
                statusLabel={deltaTStatusLabel}
                statusType={deltaTStatus}
                description={`Surface ${surfaceTemp.toFixed(1)}°C → Deep water at ${intakeDepth} m: ${deepTemp.toFixed(1)}°C`}
                barProps={{
                  value: computedDeltaT,
                  min: 15,
                  max: 25,
                  thresholds: [
                    { color: otecTheme.colors.statusRed, width: '50%' }, // <20
                    { color: otecTheme.colors.statusAmber, width: '10%' }, // 20-21
                    { color: otecTheme.colors.statusGreen, width: '40%' } // >=21
                  ]
                }}
              >
                <div className="text-[#9FB3C4] text-[11px] mt-1 flex items-center justify-between">
                  Is today's ocean fuel strong enough?
                  <InfoTooltip text="ΔT is the temperature difference between warm surface water and cold deep water. OTEC typically requires at least 20°C." />
                </div>
              </KpiCard>

              {/* CARD 2: Estimated Gross Power */}
              <KpiCard
                icon={Zap}
                title="Estimated Gross Power Output"
                value={computedPower}
                unit="kW (± 5%)"
                description="Expected today"
              >
                <div className="flex flex-col gap-1.5 h-full">
                  <div className="flex justify-between items-center text-[12px]">
                    <span className="text-[#9FB3C4]">Likely range: {Math.round(computedPower * 0.9)}–{Math.round(computedPower * 1.1)} kW</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#3FBF7F] bg-[#3FBF7F]/10 px-1.5 py-0.5 rounded">
                      <TrendingUp size={12} /> 4% vs yesterday
                    </span>
                  </div>
                  <div className="text-[#9FB3C4] text-[11px]">
                    Plan grid supply versus diesel backup.
                  </div>
                  {/* Sparkline */}
                  <div className="h-10 mt-auto w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={forecast7Days}>
                        <Line type="monotone" dataKey="grossPowerKw" stroke={otecTheme.colors.accentTeal} strokeWidth={2} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </KpiCard>

              {/* CARD 3: Estimated Freshwater Output */}
              <KpiCard
                icon={Droplets}
                title="Estimated Freshwater Output"
                value={computedWaterLakh}
                unit="lakh L/day (Indicative)"
                description={`${computedWater.toLocaleString()} L/day`}
              >
                <div className="flex flex-col gap-1.5 h-full">
                  <div className="flex justify-between items-center text-[12px]">
                    <span className="text-[#9FB3C4]">Likely range: {(computedWater * 0.9 / 100000).toFixed(1)}–{(computedWater * 1.1 / 100000).toFixed(1)} lakh L/day</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#E0524D] bg-[#E0524D]/10 px-1.5 py-0.5 rounded">
                      <TrendingDown size={12} /> 6% vs yesterday
                    </span>
                  </div>
                  <div className="text-[#9FB3C4] text-[11px]">
                    Plan desalination and water storage.
                  </div>
                  {/* Tank Fill Indicator */}
                  <div className="mt-auto pt-2">
                    <div className="flex justify-between text-[10px] text-[#9FB3C4] mb-1 font-mono">
                      <span>Expected</span>
                      <span>Demand (Target)</span>
                    </div>
                    <div className="w-full h-3 bg-white/5 rounded-full relative overflow-hidden flex items-center">
                      {/* Expected bar */}
                      <div className="absolute left-0 top-0 bottom-0 rounded-full transition-all duration-500" style={{ backgroundColor: otecTheme.colors.accentTeal, width: `${Math.min(100, (computedWater / 150000) * 100)}%` }}></div>
                      {/* Target line (e.g. 140,000 L) */}
                      <div className="absolute left-[93%] top-0 bottom-0 w-px bg-white z-10"></div>
                    </div>
                  </div>
                </div>
              </KpiCard>

              {/* CARD 4: Site ΔT Ranking */}
              <KpiCard
                icon={Map}
                title="Site ΔT Ranking"
                value="#3"
                unit="of 18"
                description="Kavaratti, Lakshadweep"
              >
                <div className="flex flex-col gap-1.5 h-full">
                  <div className="text-[#9FB3C4] text-[11px] leading-tight flex-1">
                    Based on thermal resource, reliability, and cold-water accessibility.
                  </div>
                  {/* Horizontal ranking bar */}
                  <div className="w-full h-2 bg-white/5 rounded-full relative mt-2 mb-2">
                    <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/20" style={{ left: '10%' }} title="Minicoy"></div>
                    <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/20" style={{ left: '30%' }} title="Agatti"></div>
                    <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#2FB8C9] shadow-[0_0_8px_#2FB8C9]" style={{ left: '50%' }} title="Kavaratti (#3)"></div>
                    <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/20" style={{ left: '80%' }} title="Port Blair"></div>
                  </div>
                  <button
                    onClick={() => setActiveTab('Future Site Ranking')}
                    className="w-full mt-auto py-1.5 rounded bg-white/5 hover:bg-white/10 text-[12px] font-medium text-[#2FB8C9] transition-colors cursor-pointer"
                  >
                    View candidate ranking
                  </button>
                </div>
              </KpiCard>
            </div>

            {/* Decision Banner */}
            <div className="w-full rounded-lg overflow-hidden flex shadow-sm transition-colors duration-500" style={{ backgroundColor: otecTheme.colors.panel, border: `1px solid ${decisionColor}40` }}>
              {/* Left accent color strip */}
              <div className="w-2 transition-colors duration-500" style={{ backgroundColor: decisionColor }}></div>
              <div className="p-4 flex items-center justify-between w-full">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: otecTheme.colors.textSecondary }}>Operating Advisory</div>
                  <div className="text-[14px]" style={{ color: otecTheme.colors.textMain }}>
                    OTEC thermal resource is {computedDeltaT >= 21 ? 'strong' : computedDeltaT >= 20 ? 'marginal' : 'weak'} today. Expected output can meet <strong>{Math.round((computedWater / 150000) * 100)}%</strong> of planned desalination demand. {computedDeltaT >= 20 ? 'Keep diesel backup on standby for evening reserve.' : 'Grid relies fully on backup generators.'}
                  </div>
                </div>
                <div className="shrink-0 ml-4">
                  <div className="px-4 py-2 rounded-full text-[13px] font-bold uppercase tracking-wide border transition-colors duration-500" style={{ color: decisionColor, backgroundColor: `${decisionColor}15`, borderColor: `${decisionColor}30` }}>
                    {decisionBadge}
                  </div>
                </div>
              </div>
            </div>

            {/* Two Column Layout: Profile Chart and 7-Day Forecast */}
            <div className="grid grid-cols-2 gap-6">
              {/* LEFT PANEL: Ocean Fuel Profile */}
              <SectionCard title="Ocean Fuel Profile">
                <div className="flex flex-col gap-4">
                  {/* Depth Slider Control */}
                  <div className="flex items-center gap-3 text-[13px]">
                    <span style={{ color: otecTheme.colors.textSecondary }}>Cold-water intake depth:</span>
                    <div className="flex bg-[#0B1B2B] rounded-lg p-1 border border-white/10">
                      {[500, 700, 1000].map(d => (
                        <button
                          key={d}
                          onClick={() => setIntakeDepth(d)}
                          className={`px-4 py-1.5 rounded-md text-[13px] font-medium transition-all ${intakeDepth === d ? 'bg-[#122A3E] text-white shadow-sm border border-white/5' : 'text-[#9FB3C4] hover:text-white'}`}
                        >
                          {d} m
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Chart Container */}
                  <div className="h-[340px] w-full relative mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={profile} layout="vertical" margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} stroke="rgba(255,255,255,0.05)" />
                        <XAxis type="number" dataKey="temp_c" domain={[0, 32]} tick={{ fill: otecTheme.colors.textSecondary, fontSize: 11 }} tickCount={8} unit="°C" />
                        <YAxis type="number" dataKey="depth_m" domain={[0, 1000]} reversed={true} tick={{ fill: otecTheme.colors.textSecondary, fontSize: 11 }} unit="m" />
                        <RechartsTooltip
                          contentStyle={{ backgroundColor: '#122A3E', border: '1px solid rgba(255,255,255,0.1)', fontSize: '12px' }}
                          labelFormatter={(l) => `Depth: ${l} m`}
                          formatter={(v) => [`${v}°C`, 'Temperature']}
                        />

                        {/* Viability Reference Line (20C) */}
                        <ReferenceLine x={20} stroke={otecTheme.colors.statusRed} strokeDasharray="4 4" label={{ position: 'top', value: '20°C OTEC Viability Threshold', fill: otecTheme.colors.statusRed, fontSize: 10, offset: 10 }} />

                        {/* Warm Intake Zone Shading (0-30m) */}
                        <ReferenceArea y1={0} y2={30} fill="rgba(224, 82, 77, 0.15)" strokeOpacity={0} />

                        <Line type="monotone" dataKey="temp_c" stroke={otecTheme.colors.accentTeal} strokeWidth={2.5} dot={false} />

                        <ReferenceDot x={surfaceTemp} y={0} r={5} fill={otecTheme.colors.statusRed} stroke="white" />
                        <ReferenceDot x={deepTemp} y={intakeDepth} r={5} fill={otecTheme.colors.accentTeal} stroke="white" />
                      </ComposedChart>
                    </ResponsiveContainer>

                    {/* Overlay Annotations */}
                    <div className="absolute top-[30px] right-[40px] text-[11px] font-medium flex flex-col gap-2 p-3 rounded bg-[#0B1B2B]/80 border border-white/10 backdrop-blur-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#E0524D]"></div>
                        <span className="text-[#9FB3C4]">Warm intake:</span> <span className="text-white font-mono">{surfaceTemp.toFixed(1)}°C</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#2FB8C9]"></div>
                        <span className="text-[#9FB3C4]">Cold intake at {intakeDepth}m:</span> <span className="text-white font-mono">{deepTemp.toFixed(1)}°C</span>
                      </div>
                      <div className="w-full h-px bg-white/10 my-1"></div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#9FB3C4]">Available ΔT:</span> <span className="text-[#2FB8C9] font-bold font-mono">{computedDeltaT.toFixed(1)}°C ± 0.2°C</span>
                      </div>
                    </div>
                  </div>
                </div>
              </SectionCard>

              {/* RIGHT PANEL: 7-Day Forecast */}
              <SectionCard title="7-Day Ocean Energy Forecast" subtitle="Projected plant performance based on AI ocean embeddings">
                <div className="flex flex-col gap-4">
                  <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={enrichedForecast} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} tick={{ fill: otecTheme.colors.textSecondary, fontSize: 11 }} />

                        {/* Left Y Axis: Delta T */}
                        <YAxis yAxisId="left" domain={[15, 25]} tick={{ fill: otecTheme.colors.accentTeal, fontSize: 11 }} width={40} />

                        {/* Right Y Axis: Power */}
                        <YAxis yAxisId="right" orientation="right" domain={[0, 1500]} tick={{ fill: otecTheme.colors.statusAmber, fontSize: 11 }} width={50} />

                        <RechartsTooltip
                          contentStyle={{ backgroundColor: '#122A3E', border: '1px solid rgba(255,255,255,0.1)', fontSize: '12px' }}
                        />

                        {/* Reference line at 20C on left axis */}
                        <ReferenceLine y={20} yAxisId="left" stroke={otecTheme.colors.statusRed} strokeDasharray="4 4" label={{ position: 'insideTopLeft', value: '20°C', fill: otecTheme.colors.statusRed, fontSize: 10 }} />

                        {/* Delta T Area (Uncertainty) and Line */}
                        <Area yAxisId="left" type="monotone" dataKey="dtMax" stroke="none" fill={otecTheme.colors.accentTeal} fillOpacity={0.1} />
                        <Area yAxisId="left" type="monotone" dataKey="dtMin" stroke="none" fill={otecTheme.colors.bg} fillOpacity={1} />
                        <Line yAxisId="left" type="monotone" dataKey="deltaT" stroke={otecTheme.colors.accentTeal} strokeWidth={2} dot={{ r: 3, fill: otecTheme.colors.panel }} name="ΔT (°C)" />

                        {/* Power Area (Uncertainty) and Line */}
                        <Area yAxisId="right" type="monotone" dataKey="powerMax" stroke="none" fill={otecTheme.colors.statusAmber} fillOpacity={0.1} />
                        <Area yAxisId="right" type="monotone" dataKey="powerMin" stroke="none" fill={otecTheme.colors.bg} fillOpacity={1} />
                        <Line yAxisId="right" type="monotone" dataKey="grossPowerKw" stroke={otecTheme.colors.statusAmber} strokeWidth={2} dot={{ r: 3, fill: otecTheme.colors.panel }} name="Power (kW)" />

                        {/* Event Annotations - Hardcoded for mock visual */}
                        <ReferenceLine x={enrichedForecast[2].date} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" label={{ position: 'top', value: 'Monsoon cooling', fill: otecTheme.colors.textSecondary, fontSize: 9 }} />
                        <ReferenceLine x={enrichedForecast[5].date} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" label={{ position: 'top', value: 'High confidence', fill: otecTheme.colors.textSecondary, fontSize: 9 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Compact Daily Table */}
                  <div className="overflow-x-auto mt-2">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-[#9FB3C4]">
                          <th className="py-2 px-3 font-medium">Date</th>
                          <th className="py-2 px-3 font-medium">ΔT (°C)</th>
                          <th className="py-2 px-3 font-medium">Gross Power</th>
                          <th className="py-2 px-3 font-medium">Freshwater</th>
                          <th className="py-2 px-3 font-medium">Operating Decision</th>
                        </tr>
                      </thead>
                      <tbody>
                        {enrichedForecast.map((day, i) => {
                          let badgeColor = otecTheme.colors.statusGreen;
                          let badgeBg = 'rgba(63, 191, 127, 0.15)';
                          let badgeLabel = 'Normal OTEC';
                          if (day.decision === 'Marginal Efficiency') {
                            badgeColor = otecTheme.colors.statusAmber;
                            badgeBg = 'rgba(224, 168, 46, 0.15)';
                            badgeLabel = 'Blended backup';
                          } else if (day.decision === 'Non-Viable') {
                            badgeColor = otecTheme.colors.statusRed;
                            badgeBg = 'rgba(224, 82, 77, 0.15)';
                            badgeLabel = 'Diesel backup advised';
                          }

                          return (
                            <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                              <td className="py-2 px-3 text-[#F2F6F8] font-medium">{new Date(day.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                              <td className="py-2 px-3 text-[#2FB8C9] font-mono font-medium">{day.deltaT.toFixed(1)}</td>
                              <td className="py-2 px-3 font-mono">{day.grossPowerKw} kW</td>
                              <td className="py-2 px-3 font-mono">{(day.freshwaterL / 1000).toFixed(1)}k L</td>
                              <td className="py-2 px-3">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide border" style={{ color: badgeColor, backgroundColor: badgeBg, borderColor: `${badgeColor}30` }}>
                                  {badgeLabel}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* Bottom Three Columns */}
            <div className="grid grid-cols-3 gap-6">
              {/* 1. Power and Water History */}
              <SectionCard title="Power & Water History">
                <div className="h-[200px] w-full mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={history30Day} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} tick={{ fill: otecTheme.colors.textSecondary, fontSize: 10 }} minTickGap={20} />
                      <YAxis yAxisId="left" tick={{ fill: '#2FB8C9', fontSize: 10 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fill: '#E0A82E', fontSize: 10 }} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: '#122A3E', border: '1px solid rgba(255,255,255,0.1)', fontSize: '11px' }}
                        labelFormatter={(l) => new Date(l).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      />
                      <Bar yAxisId="left" dataKey="freshwaterL" fill="#2FB8C9" opacity={0.6} radius={[2, 2, 0, 0]} name="Freshwater (L)" />
                      <Line yAxisId="right" type="monotone" dataKey="grossPowerKw" stroke="#E0A82E" strokeWidth={2} dot={false} name="Power (kW)" />
                      <ReferenceLine yAxisId="left" y={140000} stroke="rgba(255,255,255,0.3)" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Target Demand', fill: 'rgba(255,255,255,0.5)', fontSize: 9 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>

              {/* 2. Thermal Risk Events */}
              <SectionCard title="Thermal Risk Events">
                <div className="flex flex-col h-full gap-4 mt-2">
                  {/* Horizontal Timeline */}
                  <div className="relative w-full h-8 flex items-center">
                    <div className="absolute w-full h-0.5 bg-white/10 top-1/2 -translate-y-1/2"></div>
                    {/* Timeline Markers */}
                    <div className="absolute w-3 h-3 rounded-full bg-[#E0524D] top-1/2 -translate-y-1/2 shadow-[0_0_8px_#E0524D]" style={{ left: '20%' }}>
                      <span className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] text-[#9FB3C4]">12 Sep</span>
                    </div>
                    <div className="absolute w-3 h-3 rounded-full bg-[#E0A82E] top-1/2 -translate-y-1/2 shadow-[0_0_8px_#E0A82E]" style={{ left: '65%' }}>
                      <span className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] text-[#9FB3C4]">28 Sep</span>
                    </div>
                  </div>

                  {/* Risk List */}
                  <ul className="flex flex-col gap-3 mt-4 text-[12px]">
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#E0524D] mt-1.5 shrink-0"></div>
                      <span style={{ color: otecTheme.colors.textSecondary }}>Cold eddy, 12 Sep: <span style={{ color: otecTheme.colors.textMain }}>ΔT dropped to 18.9°C for 2 days</span></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#E0A82E] mt-1.5 shrink-0"></div>
                      <span style={{ color: otecTheme.colors.textSecondary }}>Monsoon winds, 28 Sep: <span style={{ color: otecTheme.colors.textMain }}>Surface mixing lowered ΔT to 20.1°C</span></span>
                    </li>
                  </ul>
                </div>
              </SectionCard>

              {/* 3. Model Confidence */}
              <SectionCard title="Model Confidence">
                <div className="flex flex-col h-full gap-4 mt-2">
                  <div className="flex items-center gap-3">
                    <StatusBadge status="good" label="HIGH CONFIDENCE" />
                    <span className="text-[12px]" style={{ color: otecTheme.colors.textSecondary }}>Overall Score</span>
                  </div>

                  <div className="flex flex-col gap-3 text-[12px] mt-2">
                    <div className="flex items-center justify-between">
                      <span style={{ color: otecTheme.colors.textSecondary }}>0–30 m (Surface)</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[#F2F6F8]">± 0.1°C</span>
                        <div className="w-16 h-1.5 bg-[#3FBF7F]/30 rounded-full"><div className="w-full h-full bg-[#3FBF7F] rounded-full"></div></div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span style={{ color: otecTheme.colors.textSecondary }}>500–1000 m (Deep)</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[#F2F6F8]">± 0.3°C</span>
                        <div className="w-16 h-1.5 bg-[#E0A82E]/30 rounded-full"><div className="w-3/4 h-full bg-[#E0A82E] rounded-full"></div></div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto text-[11px] italic" style={{ color: otecTheme.colors.textSecondary }}>
                    Forecast range is wider when the model has lower confidence.
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* Disclaimer */}
            <div className="w-full text-center text-[10px] py-4 mt-2 border-t border-white/5 text-[#9FB3C4]">
              Indicative decision-support output derived from AI-reconstructed temperature profiles. Not a substitute for plant SCADA sensors, detailed engineering design, or safety controls.
            </div>
          </div>
        )}

        {activeTab === "Site Explorer" && (
          <SiteExplorerTab
            selectedSiteId={selectedSiteId}
            setSelectedSiteId={setSelectedSiteId}
            compareList={compareList}
            setCompareList={setCompareList}
          />
        )}

        {activeTab === "Future Site Ranking" && (
          <FutureSiteRankingTab
            compareList={compareList}
            setCompareList={setCompareList}
            setActiveTab={setActiveTab}
            setSelectedSiteId={setSelectedSiteId}
          />
        )}
        {/* Global Disclaimer Footer */}
        <div className="mt-8 pt-4 border-t border-white/10 text-center text-[#9FB3C4] text-[11px] flex items-center justify-center gap-2">
          <AlertCircle size={12} className="text-[#E0A82E]" />
          Indicative decision-support output derived from AI-reconstructed temperature profiles. Not a substitute for plant SCADA sensors, detailed engineering design, or safety controls.
        </div>
      </main>
    </div>
  );
}
