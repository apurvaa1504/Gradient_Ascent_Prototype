export function findIsothermDepth(profile, depths, threshold) {
  for (let i = 1; i < profile.length; i += 1) {
    if (profile[i - 1] >= threshold && profile[i] <= threshold) {
      const fraction = (threshold - profile[i - 1]) / (profile[i] - profile[i - 1]);
      return depths[i - 1] + fraction * (depths[i] - depths[i - 1]);
    }
  }
  return null;
}

export function calculateTchp(profile, depths, threshold = 26) {
  const d26 = findIsothermDepth(profile, depths, threshold);
  if (d26 === null) return null;
  let area = 0;
  for (let i = 1; i < profile.length; i += 1) {
    const z0 = depths[i - 1]; const z1 = Math.min(depths[i], d26);
    if (z1 <= z0) continue;
    const t0 = Math.max(profile[i - 1] - threshold, 0);
    const t1 = Math.max((z1 === depths[i] ? profile[i] : threshold) - threshold, 0);
    area += ((t0 + t1) / 2) * (z1 - z0);
  }
  return area * 1025 * 3985 / 1e7;
}

export function calculateThermoclineDepth(profile, depths) {
  let maxGradient = -Infinity; let depth = null;
  for (let i = 1; i < profile.length; i += 1) {
    const gradient = Math.abs((profile[i] - profile[i - 1]) / (depths[i] - depths[i - 1]));
    if (gradient > maxGradient) { maxGradient = gradient; depth = (depths[i] + depths[i - 1]) / 2; }
  }
  return depth;
}

export function calculateHeatContent(profile, depths, upperDepth, threshold = 0) {
  let area = 0;
  for (let i = 1; i < profile.length; i += 1) {
    const z0 = depths[i - 1];
    const z1 = Math.min(depths[i], upperDepth);
    if (z1 <= z0) continue;
    const t0 = Math.max(profile[i - 1] - threshold, 0);
    const t1 = Math.max((z1 === depths[i] ? profile[i] : profile[i - 1] + ((profile[i] - profile[i - 1]) * (z1 - z0)) / (depths[i] - z0)) - threshold, 0);
    area += ((t0 + t1) / 2) * (z1 - z0);
  }
  return area;
}

export function calculateTemperatureDefinedLayerDepth(profile, depths, deltaT = 0.8) {
  const threshold = profile[0] - deltaT;
  return findIsothermDepth(profile, depths, threshold);
}

export function classifyTchp(value) {
  if (value < 20) return 'Low oceanic support';
  if (value < 40) return 'Moderate oceanic support';
  if (value < 80) return 'Favourable oceanic support';
  if (value <= 100) return 'High oceanic support';
  return 'Very high oceanic support';
}
