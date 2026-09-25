export const tchpMockData = {
  metadata: {
    productName: 'OceanEmbed TCHP Intelligence',
    status: 'Prototype demonstration',
    analysisDate: '24 September 2026',
    modelVersion: 'OceanEmbed-demo-v1.0',
    resolution: '0.25° concept grid',
  },
  regions: {
    bayOfBengal: {
      name: 'Bay of Bengal', shortName: 'Bay of Bengal', bounds: { latMin: 5, latMax: 22, lonMin: 80, lonMax: 100 },
      summary: { title: 'Deep warm reservoir detected', text: 'The central Bay of Bengal contains a deep warm layer. Elevated TCHP and D26 may reduce cyclone-induced surface cooling if atmospheric conditions are also favourable.' },
      kpis: [{ label: 'TCHP', value: '84', unit: 'kJ/cm²', note: 'High oceanic support', trend: '+18% vs baseline' }, { label: 'D26', value: '118', unit: 'm', note: '26°C isotherm depth', trend: '+24 m anomaly' }, { label: 'D20', value: '275', unit: 'm', note: 'Deep thermocline structure', trend: 'Profile-derived' }, { label: '0–100 m anomaly', value: '+0.9', unit: '°C', note: 'Subsurface anomaly', trend: 'Persistent 6 days' }, { label: 'Confidence', value: '78', unit: '%', note: 'Moderate confidence', trend: 'SSS partly degraded' }],
      trend: { tchp: [68,69,70,72,73,75,76,78,79,80,81,82,83,84], d26: [93,95,96,98,100,101,103,105,107,109,111,113,116,118] },
      interpretation: 'Confidence is moderate because sea-surface salinity quality is reduced near rainfall-affected and coastal regions.',
      // Shapes the demo profile so the frontend calculation resolves to D26 118 m, D20 275 m, and approximately 84 kJ/cm².
      profile: { location: '17.25°N, 88.50°E', tchp: 84, d26: 118, d20: 275, thermocline: 132, layer: 75, confidence: 78, depths: [0,10,20,30,50,75,100,150,200,300,400,500,700,850,1000], temperature: [29.8,29.7,29.5,29.2,27.84,26.7,26.4,25.29,23.1,18.97,13.2,10.5,7.2,5.8,4.8], uncertainty: [0.15,0.15,0.18,0.2,0.25,0.3,0.38,0.45,0.5,0.55,0.58,0.6,0.62,0.65,0.68], climatology: [29.4,29.3,29.2,29,28,27.2,26.1,24.4,21.5,16.5,13,10.4,7.1,5.7,4.7], glorys: [29.7,29.6,29.4,29.1,28.2,27.4,26.6,24.7,21.7,16.7,13.1,10.6,7.3,5.9,4.9] },
      alerts: [{ level: 'HIGH SUPPORT', title: 'Deep warm reservoir', detail: 'Central Bay of Bengal · TCHP 84 kJ/cm² · D26 118 m' }, { level: 'DATA NOTE', title: 'SSS quality reduced', detail: 'Rainfall and coastal freshwater may reduce confidence northward' }],
      inputs: [['SST', '30.1°C', 'available'], ['SSS', '33.8 PSU', 'moderate quality'], ['SSH / SLA', '+0.09 m', 'available'], ['Surface current', '0.32 / 0.18 m/s', 'available'], ['Wind vector', '-4.8 / 2.6 m/s', 'available']],
    },
    arabianSea: {
      name: 'Arabian Sea', shortName: 'Arabian Sea', bounds: { latMin: 8, latMax: 24, lonMin: 50, lonMax: 76 },
      summary: { title: 'Moderate-to-high subsurface heat support', text: 'The eastern Arabian Sea contains a warm upper-ocean structure, but the warm layer is shallower than the central Bay of Bengal case. Review wind shear and storm translation speed alongside this signal.' },
      kpis: [{ label: 'TCHP', value: '62', unit: 'kJ/cm²', note: 'Favourable support', trend: '+11% vs baseline' }, { label: 'D26', value: '86', unit: 'm', note: '26°C isotherm depth', trend: '+12 m anomaly' }, { label: 'D20', value: '230', unit: 'm', note: 'Thermal structure', trend: 'Profile-derived' }, { label: '0–100 m anomaly', value: '+0.5', unit: '°C', note: 'Subsurface anomaly', trend: 'Persistent 5 days' }, { label: 'Confidence', value: '86', unit: '%', note: 'High confidence', trend: 'Inputs available' }],
      trend: { tchp: [51,52,53,54,55,56,57,58,59,60,60,61,62,62], d26: [73,74,75,75,76,77,78,79,80,81,82,83,84,86] },
      interpretation: 'The eastern Arabian Sea signal should be interpreted with storm translation speed, wind shear, and atmospheric moisture.',
      profile: { location: '15.50°N, 68.50°E', tchp: 62, d26: 86, d20: 230, thermocline: 104, layer: 52, confidence: 86, depths: [0,10,20,30,50,75,100,150,200,300,400,500,700,850,1000], temperature: [29.4,29.3,29.1,28.9,26.7,26.7,25.11,23.6,20.5,18.83,13,10.3,7.2,5.8,4.8], uncertainty: [0.12,0.12,0.15,0.18,0.2,0.25,0.3,0.4,0.45,0.5,0.55,0.58,0.6,0.62,0.65], climatology: [29.1,29,28.8,28.6,27.9,27,25.1,23.2,20.2,16,12.8,10.1,7.1,5.7,4.7], glorys: [29.3,29.2,29,28.8,27.6,27,25.4,23.4,20.4,16.1,12.9,10.4,7.3,5.9,4.9] },
      alerts: [{ level: 'SUPPORT', title: 'Warm upper ocean', detail: 'Eastern Arabian Sea · TCHP 62 kJ/cm² · D26 86 m' }, { level: 'PERSISTENCE', title: 'Subsurface heat anomaly', detail: '50–100 m layer · +0.7°C for 8 days' }],
      inputs: [['SST', '29.7°C', 'available'], ['SSS', '35.2 PSU', 'available'], ['SSH / SLA', '+0.06 m', 'available'], ['Surface current', '0.28 / 0.11 m/s', 'available'], ['Wind vector', '-5.1 / 1.9 m/s', 'available']],
    },
  },
  dates: ['11 Sep','12 Sep','13 Sep','14 Sep','15 Sep','16 Sep','17 Sep','18 Sep','19 Sep','20 Sep','21 Sep','22 Sep','23 Sep','24 Sep'],
  corridor: [{ label: 'Current', lat: 13, lon: 87, tchp: 76, d26: 104, sst: 29.9, confidence: 'High' }, { label: '+24 h', lat: 14.2, lon: 87.5, tchp: 81, d26: 112, sst: 30, confidence: 'Moderate' }, { label: '+48 h', lat: 15.5, lon: 88.2, tchp: 84, d26: 118, sst: 30.1, confidence: 'Moderate' }, { label: '+72 h', lat: 17, lon: 89, tchp: 79, d26: 110, sst: 29.8, confidence: 'Moderate' }],
};

export const regionOptions = [{ id: 'bayOfBengal', label: 'Bay of Bengal' }, { id: 'arabianSea', label: 'Arabian Sea' }];
