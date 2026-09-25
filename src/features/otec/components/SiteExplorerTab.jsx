import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Tooltip, LayersControl, Polygon, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { otecTheme } from '../otec-theme';
import { SectionCard, StatusBadge } from './SharedComponents';
import { MapPin, Filter, Layers, Database, Droplet, Ship, Check, Eye } from 'lucide-react';
import { SITES } from '../mock-data/sites';

// Fix for default leaflet icons not showing in React properly
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Icon for candidate sites
const candidateIcon = new L.DivIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: ${otecTheme.colors.accentTeal}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 8px ${otecTheme.colors.accentTeal};"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

// Selected Icon
const selectedIcon = new L.DivIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: ${otecTheme.colors.statusGreen}; width: 18px; height: 18px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 12px ${otecTheme.colors.statusGreen};"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9]
});

export default function SiteExplorerTab({ selectedSiteId, setSelectedSiteId }) {
  // Filters State
  const [region, setRegion] = useState('All');
  const [period, setPeriod] = useState('Last 1 Year');
  const [intakeDepth, setIntakeDepth] = useState(1000);
  const [capacity, setCapacity] = useState(10);
  
  // Toggles
  const [showBathy, setShowBathy] = useState(false);
  const [showProtected, setShowProtected] = useState(false);
  const [showInfra, setShowInfra] = useState(false);
  
  // Map Layer selection
  const [activeLayer, setActiveLayer] = useState('deltaT');

  const handleSiteClick = (id) => {
    setSelectedSiteId(id);
  };

  // Mock Bathymetry contours (just a couple of polylines near Lakshadweep/Andaman)
  const mockBathyLines = [
    // Lakshadweep 1000m contour approx
    [[12, 71], [11, 71.5], [10, 71.8], [9, 72], [8, 72.5]],
    [[12, 73.5], [11, 73], [10, 73], [9, 73.2], [8, 73.8]],
    // Andaman 1000m contour approx
    [[14, 91.5], [12, 92], [10, 92.2], [8, 93]],
    [[14, 93.5], [12, 94], [10, 94.2], [8, 94.5]]
  ];

  // Mock Protected Areas
  const mockProtected = [
    [[10.6, 72.6], [10.5, 72.7], [10.4, 72.6], [10.5, 72.5]], // Near Kavaratti
    [[11.9, 92.9], [11.8, 93.0], [11.7, 92.9], [11.8, 92.8]]  // Near Havelock
  ];

  // Mock Shipping Lanes
  const mockShipping = [
    [[5, 80], [15, 90]],
    [[8, 70], [12, 75]]
  ];

  return (
    <div className="flex flex-col gap-6 h-full">
      
      {/* Top Controls Row */}
      <div className="flex flex-wrap items-center gap-3 bg-[#122A3E] p-3 rounded-lg border border-white/10 shadow-sm text-[12px]">
        {/* Region */}
        <div className="flex items-center gap-2 bg-[#0B1B2B] border border-white/10 rounded px-3 py-1.5 cursor-pointer">
          <Filter size={14} className="text-[#2FB8C9]" />
          <select value={region} onChange={(e) => setRegion(e.target.value)} className="bg-transparent border-none text-white outline-none cursor-pointer">
            <option value="All">Entire North Indian Ocean</option>
            <option value="Lakshadweep">Lakshadweep</option>
            <option value="Andaman">Andaman & Nicobar</option>
          </select>
        </div>

        {/* Site Selector */}
        <div className="flex items-center gap-2 bg-[#0B1B2B] border border-white/10 rounded px-3 py-1.5 cursor-pointer">
          <MapPin size={14} className="text-[#2FB8C9]" />
          <select value={selectedSiteId} onChange={(e) => setSelectedSiteId(e.target.value)} className="bg-transparent border-none font-medium text-white outline-none cursor-pointer">
            {SITES.map(s => <option key={s.id} value={s.id}>{s.name}, {s.region}</option>)}
          </select>
        </div>

        {/* Period */}
        <div className="flex items-center gap-2 bg-[#0B1B2B] border border-white/10 rounded px-3 py-1.5 cursor-pointer">
          <Database size={14} className="text-[#2FB8C9]" />
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="bg-transparent border-none text-white outline-none cursor-pointer">
            <option value="Last 1 Year">Last 1 Year</option>
            <option value="5-Year Climatology">5-Year Climatology</option>
            <option value="Full Record">Full Record</option>
          </select>
        </div>

        <div className="w-px h-6 bg-white/10 mx-1"></div>

        {/* Depth */}
        <div className="flex items-center gap-2 bg-[#0B1B2B] border border-white/10 rounded px-3 py-1.5 cursor-pointer">
          <Droplet size={14} className="text-[#2FB8C9]" />
          <span className="text-[#9FB3C4]">Intake:</span>
          <select value={intakeDepth} onChange={(e) => setIntakeDepth(Number(e.target.value))} className="bg-transparent border-none text-white outline-none cursor-pointer">
            <option value={500}>500 m</option>
            <option value={700}>700 m</option>
            <option value={1000}>1000 m</option>
          </select>
        </div>

        {/* Capacity */}
        <div className="flex items-center gap-2 bg-[#0B1B2B] border border-white/10 rounded px-3 py-1.5 cursor-pointer">
          <Zap size={14} className="text-[#2FB8C9]" />
          <span className="text-[#9FB3C4]">Plant:</span>
          <select value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className="bg-transparent border-none text-white outline-none cursor-pointer">
            <option value={1}>1 MW</option>
            <option value={5}>5 MW</option>
            <option value={10}>10 MW</option>
            <option value={50}>50 MW</option>
          </select>
        </div>

        <div className="w-px h-6 bg-white/10 mx-1"></div>

        {/* Toggles */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer text-[#9FB3C4] hover:text-white transition-colors">
            <input type="checkbox" checked={showBathy} onChange={(e) => setShowBathy(e.target.checked)} className="accent-[#2FB8C9]" />
            Show bathymetry
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-[#9FB3C4] hover:text-white transition-colors">
            <input type="checkbox" checked={showProtected} onChange={(e) => setShowProtected(e.target.checked)} className="accent-[#2FB8C9]" />
            Show protected areas
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-[#9FB3C4] hover:text-white transition-colors">
            <input type="checkbox" checked={showInfra} onChange={(e) => setShowInfra(e.target.checked)} className="accent-[#2FB8C9]" />
            Show infrastructure
          </label>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-12 gap-6" style={{ minHeight: '600px' }}>
        
        {/* Main Map (Left) */}
        <div className="col-span-8 h-full">
          <SectionCard title="Geospatial Intelligence Map">
            <div className="relative w-full h-[600px] rounded overflow-hidden border border-white/10">
              
              {/* Map Layer Controls overlay */}
              <div className="absolute top-4 left-4 z-[1000] bg-[#0B1B2B]/90 backdrop-blur border border-white/10 rounded-lg p-2 shadow-lg flex flex-col gap-1 text-[11px]">
                <div className="text-[#9FB3C4] font-medium mb-1 px-2 uppercase tracking-wide text-[9px]">Base Layer</div>
                <button onClick={() => setActiveLayer('deltaT')} className={`text-left px-3 py-1.5 rounded flex items-center gap-2 ${activeLayer === 'deltaT' ? 'bg-[#2FB8C9]/20 text-[#2FB8C9]' : 'text-white hover:bg-white/5'}`}>
                  <div className={`w-2 h-2 rounded-full ${activeLayer === 'deltaT' ? 'bg-[#2FB8C9]' : 'bg-transparent border border-white/30'}`}></div>
                  Thermal Gradient ΔT (Continuous)
                </button>
                <button onClick={() => setActiveLayer('viability')} className={`text-left px-3 py-1.5 rounded flex items-center gap-2 ${activeLayer === 'viability' ? 'bg-[#2FB8C9]/20 text-[#2FB8C9]' : 'text-white hover:bg-white/5'}`}>
                  <div className={`w-2 h-2 rounded-full ${activeLayer === 'viability' ? 'bg-[#2FB8C9]' : 'bg-transparent border border-white/30'}`}></div>
                  OTEC Viability (Categorical)
                </button>
                <button onClick={() => setActiveLayer('reliability')} className={`text-left px-3 py-1.5 rounded flex items-center gap-2 ${activeLayer === 'reliability' ? 'bg-[#2FB8C9]/20 text-[#2FB8C9]' : 'text-white hover:bg-white/5'}`}>
                  <div className={`w-2 h-2 rounded-full ${activeLayer === 'reliability' ? 'bg-[#2FB8C9]' : 'bg-transparent border border-white/30'}`}></div>
                  Reliability (% Days &ge; 20°C)
                </button>
                <button onClick={() => setActiveLayer('mindepth')} className={`text-left px-3 py-1.5 rounded flex items-center gap-2 ${activeLayer === 'mindepth' ? 'bg-[#2FB8C9]/20 text-[#2FB8C9]' : 'text-white hover:bg-white/5'}`}>
                  <div className={`w-2 h-2 rounded-full ${activeLayer === 'mindepth' ? 'bg-[#2FB8C9]' : 'bg-transparent border border-white/30'}`}></div>
                  Minimum Viable Depth
                </button>
              </div>

              {/* Map */}
              <MapContainer 
                center={[11.5, 82.5]} 
                zoom={5} 
                scrollWheelZoom={true} 
                style={{ height: '100%', width: '100%', backgroundColor: '#0B1B2B' }}
                zoomControl={false}
              >
                {/* Dark Basemap */}
                <TileLayer
                  attribution='&copy; <a href="https://carto.com/">Carto</a>'
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />

                {/* Optional Overlays */}
                {showBathy && mockBathyLines.map((line, idx) => (
                  <Polyline key={`bathy-${idx}`} positions={line} color="rgba(255,255,255,0.15)" weight={1} dashArray="4 4">
                    <Tooltip sticky>1000m Isobath</Tooltip>
                  </Polyline>
                ))}

                {showProtected && mockProtected.map((poly, idx) => (
                  <Polygon key={`mpp-${idx}`} positions={poly} color="#3FBF7F" fillColor="#3FBF7F" fillOpacity={0.2} weight={1}>
                    <Tooltip sticky>Marine Protected / Coral Area</Tooltip>
                  </Polygon>
                ))}

                {showInfra && mockShipping.map((line, idx) => (
                  <Polyline key={`ship-${idx}`} positions={line} color="#E0A82E" weight={2} opacity={0.3} dashArray="2 6">
                    <Tooltip sticky>Major Shipping Route</Tooltip>
                  </Polyline>
                ))}

                {/* Sites Markers */}
                {SITES.map(site => {
                  if (region !== 'All' && site.region !== region) return null;
                  
                  const isSelected = selectedSiteId === site.id;
                  
                  let status = 'viable';
                  let statusText = 'Excellent';
                  if (site.worstMonthDeltaT < 20) {
                    status = 'non-viable';
                    statusText = 'Marginal/Alert';
                  } else if (site.worstMonthDeltaT < 21) {
                    status = 'caution';
                    statusText = 'Acceptable';
                  }

                  return (
                    <Marker 
                      key={site.id} 
                      position={[site.lat, site.lon]}
                      icon={isSelected ? selectedIcon : candidateIcon}
                      eventHandlers={{
                        click: () => handleSiteClick(site.id)
                      }}
                      zIndexOffset={isSelected ? 1000 : 0}
                    >
                      <Tooltip direction="top" offset={[0, -10]} opacity={1} className="custom-map-tooltip">
                        <div className="bg-[#122A3E] border border-white/20 p-3 rounded-lg shadow-xl text-white text-[12px] min-w-[200px]" style={{ fontFamily: 'sans-serif' }}>
                          <div className="font-bold text-[14px] mb-1 pb-1 border-b border-white/10">{site.name}</div>
                          <div className="flex flex-col gap-1 mt-2">
                            <div className="flex justify-between">
                              <span className="text-[#9FB3C4]">Mean ΔT:</span>
                              <span className="font-mono text-[#2FB8C9]">{site.meanDeltaT}°C</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#9FB3C4]">Worst Season ΔT:</span>
                              <span className={`font-mono ${site.worstMonthDeltaT < 20 ? 'text-[#E0524D]' : 'text-white'}`}>{site.worstMonthDeltaT}°C</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#9FB3C4]">Viable Days:</span>
                              <span className="font-mono text-white">{site.reliability}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#9FB3C4]">Shallowest Viable:</span>
                              <span className="font-mono text-white">{site.recommendedIntakeDepth}m</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#9FB3C4]">Pipe length to 1000m:</span>
                              <span className="font-mono text-white">{site.pipeLengthMeters}m</span>
                            </div>
                          </div>
                          <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between">
                            <span className="text-[#9FB3C4] text-[10px] uppercase">Suitability</span>
                            <StatusBadge status={status} label={statusText} />
                          </div>
                        </div>
                      </Tooltip>
                    </Marker>
                  );
                })}
              </MapContainer>

              {/* Map Legend */}
              <div className="absolute bottom-4 right-4 z-[1000] bg-[#0B1B2B]/90 backdrop-blur border border-white/10 rounded-lg p-3 shadow-lg text-[11px]">
                <div className="text-[#F2F6F8] font-bold mb-2">Legend</div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#2FB8C9] border border-white"></div>
                    <span className="text-[#9FB3C4]">Candidate Site</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-[#3FBF7F] border-2 border-white"></div>
                    <span className="text-[#9FB3C4]">Selected Site</span>
                  </div>
                  {showBathy && (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-px border-t border-dashed border-white/50"></div>
                      <span className="text-[#9FB3C4]">1000m Isobath</span>
                    </div>
                  )}
                  {showProtected && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-[#3FBF7F]/30 border border-[#3FBF7F]"></div>
                      <span className="text-[#9FB3C4]">Protected Area</span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </SectionCard>
        </div>

        {/* Right Panel Placeholder (Step 6) */}
        <div className="col-span-4 h-full">
           <SectionCard title="Site Feasibility Report">
             <div className="flex items-center justify-center h-[550px] text-[#9FB3C4] text-[13px] border-2 border-dashed border-white/5 rounded-lg">
                Right Panel (Step 6) will render here.
             </div>
           </SectionCard>
        </div>

      </div>

      {/* Styles for Leaflet custom tooltip to override default leaflet white styling */}
      <style>{`
        .custom-map-tooltip.leaflet-tooltip {
          background: transparent;
          border: none;
          box-shadow: none;
          padding: 0;
        }
        .custom-map-tooltip.leaflet-tooltip-top:before {
          border-top-color: #122A3E;
        }
      `}</style>
    </div>
  );
}
