import React, { useState, useMemo } from 'react';
import { otecTheme } from '../otec-theme';
import { SectionCard, StatusBadge, InfoTooltip } from './SharedComponents';
import { Filter, ChevronDown, ChevronUp, MapPin, Target, Activity, Settings2, BarChart2, Download, FileText, X, ArrowUp, ArrowDown } from 'lucide-react';
import { SITES } from '../mock-data/sites';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, ScatterChart, Scatter, ZAxis, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ReferenceArea } from 'recharts';

export default function FutureSiteRankingTab({ compareList, setCompareList, setActiveTab, setSelectedSiteId }) {
  // Filter States
  const [region, setRegion] = useState('All');
  const [minGradient, setMinGradient] = useState(20);
  const [minReliability, setMinReliability] = useState(80);
  const [maxPipeLength, setMaxPipeLength] = useState(15);
  const [capacity, setCapacity] = useState(10);
  const [excludeConstrained, setExcludeConstrained] = useState(false);
  const [weightsExpanded, setWeightsExpanded] = useState(false);

  // Weight States
  const [weights, setWeights] = useState({
    thermal: 30,
    reliability: 25,
    pipe: 20,
    infra: 15,
    env: 10
  });

  // Handle slider change with auto-normalization
  const handleWeightChange = (key, value) => {
    let val = Math.max(0, Math.min(100, Number(value)));
    const others = Object.keys(weights).filter(k => k !== key);
    const otherSum = others.reduce((sum, k) => sum + weights[k], 0);
    const newWeights = { ...weights, [key]: val };

    if (val === 100) {
      others.forEach(k => (newWeights[k] = 0));
    } else if (otherSum === 0) {
      // If others were 0, distribute evenly
      const split = (100 - val) / others.length;
      others.forEach(k => (newWeights[k] = split));
    } else {
      // Scale others proportionately
      const factor = (100 - val) / otherSum;
      others.forEach(k => {
        newWeights[k] = weights[k] * factor;
      });
    }

    // Fix rounding errors
    const total = Object.values(newWeights).reduce((a, b) => a + b, 0);
    if (Math.abs(total - 100) > 0.01) {
      const correction = 100 - total;
      newWeights[others[0]] += correction;
    }

    // Round to 1 decimal for clean UI
    Object.keys(newWeights).forEach(k => {
      newWeights[k] = Math.round(newWeights[k] * 10) / 10;
    });

    setWeights(newWeights);
  };

  // Compute scoring and filtering
  const { filteredSites, bestOverall, bestThermal, bestPipe } = useMemo(() => {
    // 1. Filter
    let candidates = SITES.filter(site => {
      if (region !== 'All' && site.region !== region) return false;
      if (site.meanDeltaT < minGradient) return false;
      if (site.reliability < minReliability) return false;
      if ((site.pipeLengthMeters / 1000) > maxPipeLength) return false;
      if (excludeConstrained && site.environmentalFlag !== 'None') return false;
      return true;
    });

    // Normalize values across the dataset for scoring
    const maxDeltaT = Math.max(...SITES.map(s => s.meanDeltaT), 24);
    const minDeltaT = Math.min(...SITES.map(s => s.meanDeltaT), 18);
    const minPipe = Math.min(...SITES.map(s => s.pipeLengthMeters), 1500);
    const maxPipe = Math.max(...SITES.map(s => s.pipeLengthMeters), 5000);

    // 2. Score
    candidates = candidates.map(site => {
      // 0 to 1 scales
      const thermalScore = Math.max(0, (site.meanDeltaT - minDeltaT) / (maxDeltaT - minDeltaT));
      const relScore = site.reliability / 100;
      // Invert pipe score (shorter is better)
      const pipeScore = 1 - Math.max(0, (site.pipeLengthMeters - minPipe) / (maxPipe - minPipe));
      
      // Mock Infra: higher for known hubs, lower for remote
      let infraScore = 0.5;
      if (site.name.includes('Port Blair') || site.name.includes('Kavaratti')) infraScore = 0.9;
      if (site.name.includes('Candidate')) infraScore = 0.2;

      // Mock Env: 1 if 'None', 0.5 if constrained
      const envScore = site.environmentalFlag === 'None' ? 1.0 : 0.5;

      // Weighted sum out of 100
      const totalScore = (
        (thermalScore * weights.thermal) +
        (relScore * weights.reliability) +
        (pipeScore * weights.pipe) +
        (infraScore * weights.infra) +
        (envScore * weights.env)
      );

      return {
        ...site,
        suitabilityScore: Number(totalScore.toFixed(1))
      };
    });

    candidates.sort((a, b) => b.suitabilityScore - a.suitabilityScore);

    const bestOverall = candidates.length > 0 ? candidates[0] : null;
    const bestThermal = [...candidates].sort((a, b) => b.meanDeltaT - a.meanDeltaT)[0] || null;
    const bestPipe = [...candidates].sort((a, b) => a.pipeLengthMeters - b.pipeLengthMeters)[0] || null;

    return { filteredSites: candidates, bestOverall, bestThermal, bestPipe };
  }, [region, minGradient, minReliability, maxPipeLength, excludeConstrained, weights]);

  const highPotentialSites = filteredSites.filter(s => s.suitabilityScore > 75);

  // Table Sorting
  const [sortConfig, setSortConfig] = useState({ key: 'suitabilityScore', direction: 'desc' });

  const sortedSites = useMemo(() => {
    let sortableItems = [...filteredSites];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        
        // Handle calculated power for sorting
        if (sortConfig.key === 'power') {
          valA = capacity * ((a.meanDeltaT - 18) / 4) * 1000;
          valB = capacity * ((b.meanDeltaT - 18) / 4) * 1000;
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredSites, sortConfig, capacity]);

  const requestSort = (key) => {
    let direction = 'desc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    if (sortConfig?.key === key) {
      return sortConfig.direction === 'asc' ? <ArrowUp size={12} className="ml-1 inline" /> : <ArrowDown size={12} className="ml-1 inline" />;
    }
    return null;
  };

  // Compare Checkbox
  const handleToggleCompare = (id) => {
    if (compareList.includes(id)) {
      setCompareList(compareList.filter(item => item !== id));
    } else {
      if (compareList.length >= 3) {
        alert('Maximum 3 sites can be compared.');
        return;
      }
      setCompareList([...compareList, id]);
    }
  };

  // Navigation
  const handleSiteNav = (id) => {
    setSelectedSiteId(id);
    setActiveTab("Site Explorer");
  };

  // Export CSV
  const exportToCSV = () => {
    const headers = ['Rank', 'Site Name', 'Region', 'Suitability Score', 'Mean Delta T', 'Worst-Month Delta T', 'Viable Days (%)', 'Intake Depth (m)', 'Pipe Length (m)', 'Gross Power (kW)', 'Environmental Flag'];
    const rows = sortedSites.map((site, index) => {
      const power = capacity * ((site.meanDeltaT - 18) / 4) * 1000;
      return [
        index + 1,
        `"${site.name}"`,
        `"${site.region}"`,
        site.suitabilityScore,
        site.meanDeltaT,
        site.worstMonthDeltaT,
        site.reliability,
        site.recommendedIntakeDepth,
        site.pipeLengthMeters,
        Math.round(power),
        `"${site.environmentalFlag}"`
      ].join(',');
    });
    
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "otec_site_ranking.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Prepare Data for Charts
  const focusedSiteId = compareList.length > 0 ? compareList[0] : (sortedSites[0]?.id || null);
  const focusedSite = sortedSites.find(s => s.id === focusedSiteId) || sortedSites[0];
  
  // 1. Scatter Plot Data
  const scatterData = sortedSites.map(s => ({
    id: s.id,
    name: s.name,
    pipeLength: s.pipeLengthMeters / 1000,
    meanDeltaT: s.meanDeltaT,
    reliability: s.reliability,
    score: s.suitabilityScore
  }));

  // 2. Year-Round Reliability (Box/Range)
  const top5Sites = sortedSites.slice(0, 5).map(s => {
    // Generate a min/max/mean mock range for the chart
    return {
      name: s.name.split(',')[0],
      min: s.worstMonthDeltaT,
      mean: s.meanDeltaT,
      max: s.meanDeltaT + (s.meanDeltaT - s.worstMonthDeltaT) * 0.8,
      range: [s.worstMonthDeltaT, s.meanDeltaT + (s.meanDeltaT - s.worstMonthDeltaT) * 0.8]
    };
  });

  // 3. Why This Site Ranks Here Data
  const scoreBreakdown = useMemo(() => {
    if (!focusedSite) return [];
    
    // Reverse calculate the 0-1 scores used in sorting
    const maxDeltaT = Math.max(...SITES.map(s => s.meanDeltaT), 24);
    const minDeltaT = Math.min(...SITES.map(s => s.meanDeltaT), 18);
    const minPipe = Math.min(...SITES.map(s => s.pipeLengthMeters), 1500);
    const maxPipe = Math.max(...SITES.map(s => s.pipeLengthMeters), 5000);

    const thermalScore = Math.max(0, (focusedSite.meanDeltaT - minDeltaT) / (maxDeltaT - minDeltaT));
    const relScore = focusedSite.reliability / 100;
    const pipeScore = 1 - Math.max(0, (focusedSite.pipeLengthMeters - minPipe) / (maxPipe - minPipe));
    
    let infraScore = 0.5;
    if (focusedSite.name.includes('Port Blair') || focusedSite.name.includes('Kavaratti')) infraScore = 0.9;
    if (focusedSite.name.includes('Candidate')) infraScore = 0.2;

    const envScore = focusedSite.environmentalFlag === 'None' ? 1.0 : 0.5;

    return [
      { factor: 'Thermal', raw: `${focusedSite.meanDeltaT}°C`, weighted: thermalScore * weights.thermal, max: weights.thermal },
      { factor: 'Reliability', raw: `${focusedSite.reliability}%`, weighted: relScore * weights.reliability, max: weights.reliability },
      { factor: 'Pipe', raw: `${(focusedSite.pipeLengthMeters/1000).toFixed(1)}km`, weighted: pipeScore * weights.pipe, max: weights.pipe },
      { factor: 'Infra', raw: `Access`, weighted: infraScore * weights.infra, max: weights.infra },
      { factor: 'Environment', raw: focusedSite.environmentalFlag === 'None' ? 'Clear' : 'Flagged', weighted: envScore * weights.env, max: weights.env },
      { factor: 'Overall', raw: `${focusedSite.suitabilityScore}/100`, weighted: focusedSite.suitabilityScore, max: 100 }
    ];
  }, [focusedSite, weights]);

  // 4. Radar Chart Data
  const radarData = useMemo(() => {
    if (compareList.length < 2 || compareList.length > 3) return [];
    const axes = ['Thermal', 'Reliability', 'Pipe', 'Infra', 'Env'];
    
    return axes.map(axis => {
      const row = { axis };
      compareList.forEach((id, i) => {
        const site = sortedSites.find(s => s.id === id);
        if (!site) return;
        
        let val = 0;
        if (axis === 'Thermal') val = (site.meanDeltaT - 18) / 6 * 100; // normalize 0-100
        if (axis === 'Reliability') val = site.reliability;
        if (axis === 'Pipe') val = Math.max(0, 100 - (site.pipeLengthMeters / 5000 * 100));
        if (axis === 'Infra') val = site.name.includes('Port') ? 90 : 50;
        if (axis === 'Env') val = site.environmentalFlag === 'None' ? 100 : 50;
        
        row[`site${i}`] = val;
        row[`name${i}`] = site.name;
      });
      return row;
    });
  }, [compareList, sortedSites]);
  
  return (
    <div className="flex flex-col gap-6 h-full pb-8">
      {/* Page Title */}
      <h2 className="text-[22px] font-bold text-white tracking-wide border-b border-white/10 pb-4">
        Where Should India Build Its Next MW-Scale OTEC Plant?
      </h2>

      {/* Top Filter Panel */}
      <SectionCard>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-4 text-[13px]">
            {/* Region */}
            <div className="flex items-center gap-2">
              <label className="text-[#9FB3C4]">Region:</label>
              <select value={region} onChange={e => setRegion(e.target.value)} className="bg-[#0B1B2B] border border-white/10 rounded px-2 py-1 text-white outline-none cursor-pointer">
                <option value="All">All Regions</option>
                <option value="Lakshadweep">Lakshadweep</option>
                <option value="Andaman">Andaman</option>
                <option value="Nicobar">Nicobar</option>
              </select>
            </div>

            {/* Min Thermal Gradient */}
            <div className="flex items-center gap-2">
              <label className="text-[#9FB3C4]">Min ΔT:</label>
              <select value={minGradient} onChange={e => setMinGradient(Number(e.target.value))} className="bg-[#0B1B2B] border border-white/10 rounded px-2 py-1 text-white outline-none cursor-pointer">
                <option value={20}>≥ 20°C</option>
                <option value={21}>≥ 21°C</option>
                <option value={22}>≥ 22°C</option>
              </select>
            </div>

            {/* Min Reliability */}
            <div className="flex items-center gap-2">
              <label className="text-[#9FB3C4]">Min Reliability:</label>
              <select value={minReliability} onChange={e => setMinReliability(Number(e.target.value))} className="bg-[#0B1B2B] border border-white/10 rounded px-2 py-1 text-white outline-none cursor-pointer">
                <option value={80}>≥ 80% days</option>
                <option value={90}>≥ 90% days</option>
                <option value={95}>≥ 95% days</option>
              </select>
            </div>

            {/* Max Pipe Route Length */}
            <div className="flex items-center gap-2">
              <label className="text-[#9FB3C4]">Max Pipe Route:</label>
              <select value={maxPipeLength} onChange={e => setMaxPipeLength(Number(e.target.value))} className="bg-[#0B1B2B] border border-white/10 rounded px-2 py-1 text-white outline-none cursor-pointer">
                <option value={5}>5 km</option>
                <option value={10}>10 km</option>
                <option value={15}>15 km</option>
                <option value={99}>Any</option>
              </select>
            </div>

            {/* Planned Capacity */}
            <div className="flex items-center gap-2">
              <label className="text-[#9FB3C4]">Planned Capacity:</label>
              <select value={capacity} onChange={e => setCapacity(Number(e.target.value))} className="bg-[#0B1B2B] border border-white/10 rounded px-2 py-1 text-white outline-none cursor-pointer">
                <option value={1}>1 MW</option>
                <option value={5}>5 MW</option>
                <option value={10}>10 MW</option>
                <option value={50}>50 MW</option>
              </select>
            </div>
            
            {/* Environmental Toggle */}
            <div className="flex items-center gap-2 ml-auto bg-[#0B1B2B] px-3 py-1.5 rounded border border-white/10">
              <label className="flex items-center gap-2 cursor-pointer text-[#F2F6F8]">
                <input type="checkbox" checked={excludeConstrained} onChange={e => setExcludeConstrained(e.target.checked)} className="accent-[#2FB8C9]" />
                Exclude environmentally constrained zones
              </label>
            </div>
          </div>

          {/* Expandable Decision Weights */}
          <div className="mt-2 border-t border-white/10 pt-4">
            <button 
              onClick={() => setWeightsExpanded(!weightsExpanded)}
              className="flex items-center gap-2 text-[#2FB8C9] font-medium text-[13px] hover:text-white transition-colors"
            >
              <Settings2 size={16} />
              Adjust decision weights
              {weightsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            
            {weightsExpanded && (
              <div className="mt-4 bg-[#0B1B2B] p-5 rounded-lg border border-white/5">
                <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                  {Object.entries({
                    thermal: 'Thermal resource quality',
                    reliability: 'Reliability / persistence',
                    pipe: 'Cold-water pipe feasibility',
                    infra: 'Infrastructure / demand access',
                    env: 'Environmental compatibility'
                  }).map(([key, label]) => (
                    <div key={key} className="flex flex-col gap-2">
                      <div className="flex justify-between text-[12px]">
                        <span className="text-[#F2F6F8]">{label}</span>
                        <span className="font-mono text-[#2FB8C9]">{weights[key].toFixed(1)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" max="100" step="0.1"
                        value={weights[key]}
                        onChange={(e) => handleWeightChange(key, e.target.value)}
                        className="w-full accent-[#2FB8C9]"
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-4 border-t border-white/5 text-[11px] text-[#9FB3C4] italic flex items-start gap-2">
                  <InfoTooltip text="Sliders automatically normalize to 100%" />
                  Overall Suitability Score = weighted combination of thermal quality, year-round reliability, pipe feasibility, infrastructure, and environmental constraints.
                </div>
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Top Summary Cards */}
      <div className="grid grid-cols-5 gap-4">
        {/* Card 1 */}
        <div className="bg-[#122A3E] border border-[#2FB8C9]/20 rounded-lg p-4 flex flex-col justify-center items-center text-center shadow-sm h-[100px]">
          <div className="text-[28px] font-bold text-white font-mono leading-none">{filteredSites.length}</div>
          <div className="text-[11px] text-[#9FB3C4] uppercase tracking-wide mt-2">Candidate sites analyzed</div>
        </div>
        
        {/* Card 2 */}
        <div className="bg-[#122A3E] border border-[#3FBF7F]/20 rounded-lg p-4 flex flex-col justify-center items-center text-center shadow-sm h-[100px]">
          <div className="text-[28px] font-bold text-[#3FBF7F] font-mono leading-none">{highPotentialSites.length}</div>
          <div className="text-[11px] text-[#9FB3C4] uppercase tracking-wide mt-2">High-potential sites</div>
        </div>

        {/* Card 3 */}
        <div className="bg-[#122A3E] border border-white/10 rounded-lg p-4 flex flex-col justify-center items-center text-center shadow-sm h-[100px]">
          <div className="text-[15px] font-bold text-white leading-tight">{bestOverall ? bestOverall.name : 'None'}</div>
          <div className="text-[11px] text-[#9FB3C4] uppercase tracking-wide mt-2">Best overall candidate</div>
        </div>

        {/* Card 4 */}
        <div className="bg-[#122A3E] border border-white/10 rounded-lg p-4 flex flex-col justify-center items-center text-center shadow-sm h-[100px]">
          <div className="text-[15px] font-bold text-white leading-tight">{bestThermal ? bestThermal.name : 'None'}</div>
          <div className="text-[11px] text-[#9FB3C4] uppercase tracking-wide mt-2">Best thermal resource</div>
        </div>

        {/* Card 5 */}
        <div className="bg-[#122A3E] border border-white/10 rounded-lg p-4 flex flex-col justify-center items-center text-center shadow-sm h-[100px]">
          <div className="text-[15px] font-bold text-white leading-tight">{bestPipe ? bestPipe.name : 'None'}</div>
          <div className="text-[11px] text-[#9FB3C4] uppercase tracking-wide mt-2">Lowest pipe-cost proxy</div>
        </div>
      </div>

      {/* Step 9 Table */}
      <SectionCard title="Candidate Ranking Table">
        <div className="flex justify-between items-end mb-4">
          <div className="text-[12px] text-[#9FB3C4]">
            Select up to 3 sites to generate a comparison report or export the current filtered list.
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowModal(true)}
              disabled={compareList.length !== 1}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium transition-colors border ${compareList.length === 1 ? 'bg-[#2FB8C9]/20 text-[#2FB8C9] border-[#2FB8C9]/30 hover:bg-[#2FB8C9]/30 cursor-pointer' : 'bg-transparent text-[#9FB3C4]/50 border-white/10 cursor-not-allowed'}`}
            >
              <FileText size={14} />
              Generate site briefing
            </button>
            <button 
              onClick={exportToCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded text-[12px] font-medium transition-colors cursor-pointer"
            >
              <Download size={14} />
              Export to CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border border-white/10 rounded-lg">
          <table className="w-full text-left text-[12px] border-collapse whitespace-nowrap">
            <thead className="bg-[#0B1B2B] text-[#9FB3C4] border-b border-white/10">
              <tr>
                <th className="py-2.5 px-3 font-medium text-center w-10">Compare</th>
                <th className="py-2.5 px-3 font-medium cursor-pointer hover:text-white" onClick={() => requestSort('suitabilityScore')}>Rank {getSortIcon('suitabilityScore')}</th>
                <th className="py-2.5 px-3 font-medium cursor-pointer hover:text-white" onClick={() => requestSort('name')}>Site {getSortIcon('name')}</th>
                <th className="py-2.5 px-3 font-medium cursor-pointer hover:text-white" onClick={() => requestSort('suitabilityScore')}>Suitability Score {getSortIcon('suitabilityScore')}</th>
                <th className="py-2.5 px-3 font-medium cursor-pointer hover:text-white" onClick={() => requestSort('meanDeltaT')}>Mean ΔT {getSortIcon('meanDeltaT')}</th>
                <th className="py-2.5 px-3 font-medium cursor-pointer hover:text-white" onClick={() => requestSort('worstMonthDeltaT')}>Worst-Month ΔT {getSortIcon('worstMonthDeltaT')}</th>
                <th className="py-2.5 px-3 font-medium cursor-pointer hover:text-white" onClick={() => requestSort('reliability')}>Viable Days {getSortIcon('reliability')}</th>
                <th className="py-2.5 px-3 font-medium cursor-pointer hover:text-white" onClick={() => requestSort('recommendedIntakeDepth')}>Rec. Depth {getSortIcon('recommendedIntakeDepth')}</th>
                <th className="py-2.5 px-3 font-medium cursor-pointer hover:text-white" onClick={() => requestSort('pipeLengthMeters')}>Est. Pipe {getSortIcon('pipeLengthMeters')}</th>
                <th className="py-2.5 px-3 font-medium cursor-pointer hover:text-white" onClick={() => requestSort('power')}>Gross Power ({capacity}MW) {getSortIcon('power')}</th>
                <th className="py-2.5 px-3 font-medium cursor-pointer hover:text-white" onClick={() => requestSort('environmentalFlag')}>Env. Flag {getSortIcon('environmentalFlag')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedSites.map((site, idx) => {
                const power = capacity * ((site.meanDeltaT - 18) / 4) * 1000;
                const isSelected = compareList.includes(site.id);
                return (
                  <tr key={site.id} className={`border-b border-white/5 transition-colors ${isSelected ? 'bg-[#3FBF7F]/10' : 'hover:bg-white/5'}`}>
                    <td className="py-2.5 px-3 text-center">
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => handleToggleCompare(site.id)}
                        className="accent-[#3FBF7F] cursor-pointer"
                      />
                    </td>
                    <td className="py-2.5 px-3 font-bold text-white">#{idx + 1}</td>
                    <td className="py-2.5 px-3 font-medium text-[#2FB8C9] cursor-pointer hover:underline" onClick={() => handleSiteNav(site.id)}>
                      {site.name}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{site.suitabilityScore.toFixed(1)}</span>
                        <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-[#2FB8C9]" style={{ width: `${site.suitabilityScore}%` }}></div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono">{site.meanDeltaT.toFixed(1)}°C</td>
                    <td className={`py-2.5 px-3 font-mono ${site.worstMonthDeltaT < 20 ? 'text-[#E0524D]' : ''}`}>{site.worstMonthDeltaT.toFixed(1)}°C</td>
                    <td className="py-2.5 px-3 font-mono">{site.reliability}%</td>
                    <td className="py-2.5 px-3 font-mono">{site.recommendedIntakeDepth} m</td>
                    <td className="py-2.5 px-3 font-mono">{(site.pipeLengthMeters/1000).toFixed(1)} km</td>
                    <td className="py-2.5 px-3 font-mono">{Math.round(power).toLocaleString()} kW</td>
                    <td className="py-2.5 px-3">
                      {site.environmentalFlag !== 'None' ? (
                        <span className="text-[10px] uppercase text-[#E0A82E] font-bold border border-[#E0A82E]/30 bg-[#E0A82E]/10 px-1.5 py-0.5 rounded">
                          {site.environmentalFlag}
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase text-[#9FB3C4]">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {sortedSites.length === 0 && (
                <tr>
                  <td colSpan="11" className="py-8 text-center text-[#9FB3C4]">No sites match the current filter criteria.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Briefing Modal */}
      {showModal && compareList.length === 1 && (
        <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0B1B2B] border border-[#2FB8C9]/30 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="bg-[#122A3E] px-4 py-3 flex items-center justify-between border-b border-white/10">
              <h3 className="font-bold text-white flex items-center gap-2">
                <FileText size={16} className="text-[#2FB8C9]" />
                Site Briefing
              </h3>
              <button onClick={() => setShowModal(false)} className="text-[#9FB3C4] hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 text-[13px] text-[#F2F6F8] flex flex-col gap-4">
              <p>
                <strong>{SITES.find(s => s.id === compareList[0])?.name}</strong> is a high-potential candidate for a <strong>{capacity} MW</strong> OTEC facility.
              </p>
              <div className="bg-white/5 p-3 rounded border border-white/5 font-mono text-[12px] leading-relaxed">
                Region: {SITES.find(s => s.id === compareList[0])?.region}<br/>
                Mean Thermal Gradient: {SITES.find(s => s.id === compareList[0])?.meanDeltaT.toFixed(1)}°C<br/>
                Reliability Window: {SITES.find(s => s.id === compareList[0])?.reliability}% of year<br/>
                Infrastructure Constraint: {SITES.find(s => s.id === compareList[0])?.environmentalFlag}
              </div>
              <p className="text-[#9FB3C4]">
                This is a preliminary AI-generated summary derived from reconstructed ocean profiles. A full marine survey is legally required before front-end engineering design (FEED).
              </p>
            </div>
            <div className="p-4 border-t border-white/10 flex justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-1.5 bg-[#2FB8C9] text-[#0B1B2B] font-medium rounded text-[13px] hover:bg-[#2FB8C9]/90 transition-colors">
                Close Briefing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Charts */}
      <div className="grid grid-cols-2 gap-6 mt-2">
        {/* Chart 1: Scatter */}
        <SectionCard title="Thermal Resource vs Pipe Feasibility">
          <div className="h-[250px] w-full relative">
            {/* Background Quadrant Labels */}
            <div className="absolute inset-0 pointer-events-none flex flex-col z-0 opacity-20">
              <div className="flex-1 flex">
                <div className="flex-1 p-2 text-[10px] text-white font-bold leading-tight">Best prospects:<br/>high ΔT, short pipe</div>
                <div className="flex-1 p-2 text-right text-[10px] text-white font-bold leading-tight">Strong thermal resource,<br/>expensive pipe</div>
              </div>
              <div className="flex-1 flex">
                <div className="flex-1 p-2 flex items-end text-[10px] text-white font-bold leading-tight">Easy access,<br/>weaker thermal resource</div>
                <div className="flex-1 p-2 flex justify-end items-end text-right text-[10px] text-white font-bold leading-tight">Low priority</div>
              </div>
            </div>

            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" dataKey="pipeLength" name="Pipe Length (km)" domain={[0, 5]} tick={{fill: otecTheme.colors.textSecondary, fontSize: 10}} />
                <YAxis type="number" dataKey="meanDeltaT" name="Mean ΔT (°C)" domain={[18, 25]} tick={{fill: otecTheme.colors.textSecondary, fontSize: 10}} />
                <ZAxis type="number" dataKey="reliability" range={[50, 400]} name="Viable Days %" />
                <RechartsTooltip 
                  cursor={{strokeDasharray: '3 3'}} 
                  contentStyle={{ backgroundColor: '#122A3E', border: '1px solid rgba(255,255,255,0.1)', fontSize: '11px' }}
                  formatter={(value, name) => [name === 'Mean ΔT (°C)' ? `${value}°C` : name === 'Pipe Length (km)' ? `${value}km` : `${value}%`, name]}
                />
                <Scatter data={scatterData}>
                  {scatterData.map((entry, index) => {
                    // Color scale mapping from score
                    let fill = otecTheme.colors.statusRed;
                    if (entry.score > 60) fill = otecTheme.colors.statusAmber;
                    if (entry.score > 80) fill = otecTheme.colors.statusGreen;
                    
                    const isFocused = entry.id === focusedSiteId;
                    return (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={fill} 
                        fillOpacity={0.7} 
                        stroke={isFocused ? 'white' : fill} 
                        strokeWidth={isFocused ? 2 : 0} 
                      />
                    );
                  })}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        {/* Chart 2: Year-Round Reliability Box */}
        <SectionCard title="Year-Round Reliability (Top 5)">
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={top5Sites} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" domain={[15, 26]} tick={{fill: otecTheme.colors.textSecondary, fontSize: 10}} />
                <YAxis dataKey="name" type="category" width={80} tick={{fill: otecTheme.colors.textSecondary, fontSize: 10}} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#122A3E', border: '1px solid rgba(255,255,255,0.1)', fontSize: '11px' }}
                  formatter={(value) => [`${value[0].toFixed(1)}°C - ${value[1].toFixed(1)}°C`, 'Range']}
                />
                {/* Reference line for 20C threshold */}
                <ReferenceLine x={20} stroke={otecTheme.colors.statusRed} strokeDasharray="4 4" label={{ position: 'top', value: '20°C Limit', fill: otecTheme.colors.statusRed, fontSize: 9 }} />
                
                <Bar dataKey="range" fill={otecTheme.colors.accentTeal} barSize={12} radius={[4, 4, 4, 4]}>
                  {top5Sites.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.min < 20 ? 'rgba(224, 82, 77, 0.7)' : otecTheme.colors.accentTeal} />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        {/* Chart 3: Why This Site Ranks Here */}
        <SectionCard title={`Why This Site Ranks Here: ${focusedSite?.name || ''}`}>
          <div className="h-[250px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={scoreBreakdown} layout="vertical" margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis dataKey="factor" type="category" width={80} tick={{fill: otecTheme.colors.textSecondary, fontSize: 10}} />
                <RechartsTooltip 
                  cursor={{fill: 'rgba(255,255,255,0.05)'}}
                  contentStyle={{ backgroundColor: '#122A3E', border: '1px solid rgba(255,255,255,0.1)', fontSize: '11px' }}
                  formatter={(value, name, props) => [`${value.toFixed(1)} / ${props.payload.max} (${props.payload.raw})`, 'Contribution']}
                />
                
                {/* Background max bar for context */}
                <Bar dataKey="max" fill="rgba(255,255,255,0.05)" barSize={16} radius={[0, 4, 4, 0]} />
                
                {/* Actual score bar overlaid */}
                <Bar dataKey="weighted" barSize={16} radius={[0, 4, 4, 0]} label={{ position: 'right', fill: 'white', fontSize: 10, formatter: (val) => val.toFixed(1) }}>
                  {scoreBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.factor === 'Overall' ? '#F2F6F8' : otecTheme.colors.accentTeal} />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        {/* Chart 4: Radar Chart (Only visible if 2-3 sites compared) */}
        {(compareList.length === 2 || compareList.length === 3) ? (
          <SectionCard title="Multi-Site Feature Comparison">
            <div className="h-[250px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart outerRadius={80} data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis dataKey="axis" tick={{ fill: otecTheme.colors.textSecondary, fontSize: 10 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <RechartsTooltip contentStyle={{ backgroundColor: '#122A3E', border: '1px solid rgba(255,255,255,0.1)', fontSize: '11px' }} />
                  
                  {/* Site 0 */}
                  {radarData[0]?.site0 !== undefined && (
                    <Radar name={radarData[0].name0} dataKey="site0" stroke={otecTheme.colors.accentTeal} fill={otecTheme.colors.accentTeal} fillOpacity={0.3} />
                  )}
                  {/* Site 1 */}
                  {radarData[0]?.site1 !== undefined && (
                    <Radar name={radarData[0].name1} dataKey="site1" stroke={otecTheme.colors.statusGreen} fill={otecTheme.colors.statusGreen} fillOpacity={0.3} />
                  )}
                  {/* Site 2 */}
                  {radarData[0]?.site2 !== undefined && (
                    <Radar name={radarData[0].name2} dataKey="site2" stroke={otecTheme.colors.statusAmber} fill={otecTheme.colors.statusAmber} fillOpacity={0.3} />
                  )}
                </RadarChart>
              </ResponsiveContainer>
            </div>
            {/* Custom Legend */}
            <div className="flex justify-center gap-4 mt-2">
              {compareList.map((id, i) => (
                <div key={id} className="flex items-center gap-1 text-[10px] text-white">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: i === 0 ? otecTheme.colors.accentTeal : i === 1 ? otecTheme.colors.statusGreen : otecTheme.colors.statusAmber }}></div>
                  {sortedSites.find(s => s.id === id)?.name.split(',')[0]}
                </div>
              ))}
            </div>
          </SectionCard>
        ) : (
          <SectionCard title="Multi-Site Feature Comparison">
            <div className="h-[250px] w-full flex items-center justify-center text-[12px] text-[#9FB3C4]/50 border-2 border-dashed border-white/5 rounded-lg text-center p-4">
              Select 2 or 3 sites in the table above to unlock the multi-site radar comparison chart.
            </div>
          </SectionCard>
        )}
      </div>

    </div>
  );
}
