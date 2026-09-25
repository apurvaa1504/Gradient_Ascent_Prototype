import { SITES } from './sites';

export const HISTORY_30DAY = {};

SITES.forEach(site => {
  const history = [];
  const baseDeltaT = site.meanDeltaT;
  
  for (let i = 30; i >= 1; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    
    // Smooth random walk variation for history
    const seasonalTrend = Math.sin(i / 10) * 0.5;
    const noise = (Math.random() * 0.4) - 0.2;
    const deltaT = baseDeltaT + seasonalTrend + noise;
    
    const efficiencyFactor = Math.max(0, (deltaT - 18) / 4);
    const grossPowerKw = Math.round(1000 * efficiencyFactor);
    const freshwaterL = Math.round(grossPowerKw * 105.5);
    
    history.push({
      date: d.toISOString().split('T')[0],
      freshwaterL,
      grossPowerKw
    });
  }
  
  HISTORY_30DAY[site.id] = history;
});
