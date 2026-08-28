import { LAND_POLYGONS } from './landmask';

// Ray-casting point-in-polygon algorithm
export function isPointInPolygon(point, vs) {
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isLandPoint(lon, lat) {
  // Check bounding coordinates first
  if (lat > 28.5 && lon > 65.0) return true; // Northern Himalayas / Tibet
  if (lat > 25.0 && lon < 60.0 && lon > 48.0 && lat > 28.0) return true; // Northern Persian Gulf land

  for (let i = 0; i < LAND_POLYGONS.length; i++) {
    if (isPointInPolygon([lon, lat], LAND_POLYGONS[i])) {
      return true;
    }
  }
  return false;
}
