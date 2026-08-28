import landTopo from 'world-atlas/land-50m.json';
import countriesTopo from 'world-atlas/countries-50m.json';
import * as topojson from 'topojson-client';

// Convert TopoJSON to GeoJSON features
export const worldLandGeoJSON = topojson.feature(landTopo, landTopo.objects.land);
export const worldCountriesGeoJSON = topojson.feature(countriesTopo, countriesTopo.objects.countries);
