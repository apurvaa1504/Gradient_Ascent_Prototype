import { SITES } from './sites';
import { DAILY_FORECAST } from './daily-forecast';

export const DEPTH_PROFILE = {};

const STANDARD_DEPTHS = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000];

SITES.forEach(site => {
  const siteProfiles = {};
  
  // Create a profile for each day in the forecast
  DAILY_FORECAST[site.id].forEach(day => {
    const sst = day.deltaT + 4.0; // Assume deep water is ~4C, so SST is DeltaT + 4
    const mld = 40; // Mixed layer depth roughly 40m
    const deepTemp = 4.0;
    
    const profile = STANDARD_DEPTHS.map(d => {
      let temp = deepTemp;
      if (d <= mld) {
        temp = sst - (d / mld) * 0.2; // Slight cooling in mixed layer
      } else {
        const zScale = (d - mld) / 200; // Thermocline scale
        temp = deepTemp + (sst - 0.2 - deepTemp) * Math.exp(-zScale);
      }
      return {
        depth_m: d,
        temp_c: Number(temp.toFixed(2))
      };
    });
    
    siteProfiles[day.date] = profile;
  });
  
  DEPTH_PROFILE[site.id] = siteProfiles;
});
