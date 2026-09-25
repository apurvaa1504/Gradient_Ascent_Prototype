import { SITES } from './sites';

// Generate a 7-day forecast for each site
export const DAILY_FORECAST = {};

SITES.forEach(site => {
  const forecast = [];
  const baseDeltaT = site.meanDeltaT;

  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);

    // Add some random walk variation to the base Delta T
    const variation = (Math.random() * 0.8) - 0.4;
    const deltaT = Number((baseDeltaT + variation).toFixed(1));

    // Calculate gross power based on a nominal 1MW reference plant scaled by DeltaT efficiency
    // Simplified model: Power ~ (DeltaT - 20)^2 roughly. Let's just linearly scale for mock data.
    const efficiencyFactor = Math.max(0, (deltaT - 18) / 4);
    const grossPowerKw = Math.round(1000 * efficiencyFactor);

    // Freshwater production ~ roughly scales with power output
    const freshwaterL = Math.round(grossPowerKw * 105.5);

    let decision = 'Optimal';
    if (deltaT < 20) decision = 'Marginal Efficiency';
    if (deltaT < 18) decision = 'Non-Viable';

    forecast.push({
      date: d.toISOString().split('T')[0],
      deltaT,
      grossPowerKw,
      freshwaterL,
      decision
    });
  }

  DAILY_FORECAST[site.id] = forecast;
});
