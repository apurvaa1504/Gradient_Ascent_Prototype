import React, { useState } from 'react';
import { otecTheme } from './otec-theme';
import { SectionCard, KpiCard, ThresholdBar, StatusBadge, InfoTooltip } from './components/SharedComponents';
import { Activity, Download, Calendar, MapPin, Clock, Thermometer, Zap, Droplets, Map, TrendingUp, TrendingDown } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { DAILY_FORECAST } from './mock-data/daily-forecast';
import { SITES } from './mock-data/sites';

export default function OtecApp() {
  const [activeTab, setActiveTab] = useState("Today's Operations");
  const tabs = ["Today's Operations", "Site Explorer", "Future Site Ranking"];

  // Mock data for Tab 1
  const selectedSiteId = 'kavaratti';
  const siteInfo = SITES.find(s => s.id === selectedSiteId);
  const forecast7Days = DAILY_FORECAST[selectedSiteId];
  const todayForecast = forecast7Days[0];

  // Derive decision status
  let decisionColor = otecTheme.colors.statusGreen;
  let decisionBadge = 'Run OTEC normally';
  if (todayForecast.decision === 'Marginal Efficiency') {
    decisionColor = otecTheme.colors.statusAmber;
    decisionBadge = 'Use blended OTEC + diesel';
  } else if (todayForecast.decision === 'Non-Viable') {
    decisionColor = otecTheme.colors.statusRed;
    decisionBadge = 'Activate backup generation';
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: otecTheme.colors.bg, color: otecTheme.colors.textMain, fontFamily: 'sans-serif' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

      {/* Hero Strip */}
      <div style={{ 
        backgroundColor: 'rgba(47, 184, 201, 0.05)', 
        borderBottom: `1px solid ${otecTheme.colors.border}`,
        padding: '12px 24px',
        fontSize: '13px',
        color: otecTheme.colors.accentTeal,
        fontWeight: 500
      }}>
        Satellites see the ocean's surface. Our AI reconstructs the temperature beneath it—turning daily ocean conditions into energy, freshwater, and site-selection intelligence.
      </div>

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
                   <select className="bg-transparent border-none text-[13px] font-medium text-white outline-none cursor-pointer">
                     <option value="kavaratti">Kavaratti, Lakshadweep</option>
                     {/* Other sites could be here */}
                   </select>
                 </div>
                 
                 {/* Date Selector */}
                 <div className="flex items-center gap-2 bg-[#122A3E] border border-white/10 rounded px-3 py-1.5">
                   <Calendar size={14} className="text-[#2FB8C9]" />
                   <span className="text-[13px] font-medium">24 Sep 2026</span>
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
               <button className="flex items-center gap-2 bg-transparent hover:bg-white/5 border border-white/20 text-[#F2F6F8] rounded px-3 py-1.5 text-[13px] font-medium transition-colors">
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
                 value="22.4"
                 unit="°C"
                 statusLabel="VIABLE"
                 statusType="viable"
                 description="Surface 29.1°C → Deep water at 1000 m: 6.7°C"
                 barProps={{
                   value: 22.4,
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
                 value="62"
                 unit="kW"
                 description="Expected today"
               >
                 <div className="flex flex-col gap-1.5 h-full">
                   <div className="flex justify-between items-center text-[12px]">
                     <span className="text-[#9FB3C4]">Likely range: 56–68 kW</span>
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
                         <Line type="monotone" dataKey="grossPowerKw" stroke={otecTheme.colors.accentTeal} strokeWidth={2} dot={{ r: 2, fill: otecTheme.colors.accentTeal }} isAnimationActive={false} />
                       </LineChart>
                     </ResponsiveContainer>
                   </div>
                 </div>
               </KpiCard>

               {/* CARD 3: Estimated Freshwater Output */}
               <KpiCard
                 icon={Droplets}
                 title="Estimated Freshwater Output"
                 value="1.35"
                 unit="lakh L/day"
                 description="135,000 L/day"
               >
                 <div className="flex flex-col gap-1.5 h-full">
                   <div className="flex justify-between items-center text-[12px]">
                     <span className="text-[#9FB3C4]">Likely range: 1.2–1.5 lakh L/day</span>
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
                       <div className="absolute left-0 top-0 bottom-0 bg-[#2FB8C9]/80 rounded-full" style={{ width: '92%' }}></div>
                       {/* Target line */}
                       <div className="absolute left-[100%] top-0 bottom-0 w-px bg-white z-10" style={{ transform: 'translateX(-1px)' }}></div>
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
                     className="w-full mt-auto py-1.5 rounded bg-white/5 hover:bg-white/10 text-[12px] font-medium text-[#2FB8C9] transition-colors"
                   >
                     View candidate ranking
                   </button>
                 </div>
               </KpiCard>
             </div>

             {/* Decision Banner */}
             <div className="w-full rounded-lg overflow-hidden flex border border-white/10 shadow-sm" style={{ backgroundColor: otecTheme.colors.panel }}>
               {/* Left accent color strip */}
               <div className="w-2" style={{ backgroundColor: decisionColor }}></div>
               <div className="p-4 flex items-center justify-between w-full">
                 <div>
                   <div className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: otecTheme.colors.textSecondary }}>Operating Advisory</div>
                   <div className="text-[14px]" style={{ color: otecTheme.colors.textMain }}>
                     OTEC thermal resource is strong today. Expected output can meet <strong>92%</strong> of planned desalination demand. Keep diesel backup on standby for evening reserve.
                   </div>
                 </div>
                 <div className="shrink-0 ml-4">
                   <div className="px-4 py-2 rounded-full text-[13px] font-bold uppercase tracking-wide border" style={{ color: decisionColor, backgroundColor: `${decisionColor}15`, borderColor: `${decisionColor}30` }}>
                     {decisionBadge}
                   </div>
                 </div>
               </div>
             </div>
          </div>
        )}
        
        {activeTab === "Site Explorer" && (
          <div>
             <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Site Explorer</h2>
             {/* Shell placeholder for tab 2 */}
          </div>
        )}
        
        {activeTab === "Future Site Ranking" && (
          <div>
             <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Future Site Ranking</h2>
             {/* Shell placeholder for tab 3 */}
          </div>
        )}
      </main>
    </div>
  );
}
