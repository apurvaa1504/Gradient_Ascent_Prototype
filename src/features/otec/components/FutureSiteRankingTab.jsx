import React, { useState, useMemo } from 'react';
import { otecTheme } from '../otec-theme';
import { SectionCard, StatusBadge, InfoTooltip } from './SharedComponents';
import { Filter, ChevronDown, ChevronUp, MapPin, Target, Activity, Settings2, BarChart2 } from 'lucide-react';
import { SITES } from '../mock-data/sites';

export default function FutureSiteRankingTab({ compareList, setCompareList }) {
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

      {/* Step 9 Table Placeholder */}
      <SectionCard title="Candidate Ranking Table">
        <div className="h-[300px] flex items-center justify-center border-2 border-dashed border-white/5 rounded-lg text-[#9FB3C4] text-[13px]">
          Ranking Table (Step 9) will render here.
        </div>
      </SectionCard>

    </div>
  );
}
