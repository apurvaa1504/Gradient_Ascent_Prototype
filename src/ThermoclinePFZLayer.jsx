/**
 * ThermoclinePFZLayer — Canvas-based PFZ Overlay for React-Leaflet
 * Team Gradient Ascent — SIH 2026
 *
 * Renders Potential Fishing Zone polygons on the existing Leaflet map.
 * Uses the same canvas + useMap pattern as the Grid025Overlay already in App.jsx.
 */

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { PFZ_POTENTIAL_CONFIG } from './pfzData';

const FISH_EMOJI = '🐟';

/**
 * Projects a [lat, lon] array to a Leaflet container point.
 * Returns {x, y} in pixel space relative to the map container.
 */
function latLonToPixel(map, lat, lon) {
  return map.latLngToContainerPoint(L.latLng(lat, lon));
}

/**
 * ThermoclinePFZLayer
 *
 * Props:
 *   zones       — array of PFZ zone objects from pfzData.js
 *   enabled     — boolean, whether this layer is visible
 *   onZoneClick — callback(zone) when a zone polygon is clicked
 */
export function ThermoclinePFZLayer({ zones, enabled, onZoneClick }) {
  const map = useMap();
  const canvasRef = useRef(null);
  // Store hit-test polygons in pixel space for click detection
  const pixelPolygonsRef = useRef([]);

  useEffect(() => {
    if (!map) return;

    // ── Create our canvas in the overlay pane ─────────────────────────────
    const container = map.getPanes().overlayPane;
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none'; // clicks pass through to map, then we intercept
    canvas.style.zIndex = '12'; // above heatmap (10), below grid (15)
    container.appendChild(canvas);
    canvasRef.current = canvas;

    // ── Redraw function ───────────────────────────────────────────────────
    const redraw = () => {
      if (!canvasRef.current) return;
      const ctx = canvas.getContext('2d');
      const size = map.getSize();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = size.x * dpr;
      canvas.height = size.y * dpr;
      canvas.style.width = `${size.x}px`;
      canvas.style.height = `${size.y}px`;
      ctx.scale(dpr, dpr);

      // Reposition canvas to track pan offset
      const topLeft = map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(canvas, topLeft);

      ctx.clearRect(0, 0, size.x, size.y);

      if (!enabled || !zones || zones.length === 0) {
        pixelPolygonsRef.current = [];
        return;
      }

      const newPixelPolygons = [];

      zones.forEach((zone) => {
        const cfg = PFZ_POTENTIAL_CONFIG[zone.potential];
        if (!cfg) return;

        // Convert geo-polygon to pixel points
        const pts = zone.polygon.map(([lat, lon]) => latLonToPixel(map, lat, lon));
        if (pts.length < 3) return;

        // Store for hit testing on click
        newPixelPolygons.push({ zone, pts });

        // ── Outer Glow Pass (all potential levels) ─────────────────────
        if (cfg.glowColor) {
          ctx.save();
          ctx.shadowBlur = zone.potential === 'high' ? 22 : 12;
          ctx.shadowColor = cfg.glowColor;
          ctx.beginPath();
          pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
          ctx.closePath();
          ctx.strokeStyle = cfg.strokeColor;
          ctx.lineWidth = cfg.strokeWidth + 2;
          ctx.stroke();
          ctx.restore();
        }

        // ── Fill ─────────────────────────────────────────────────────────
        ctx.beginPath();
        pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.fillStyle = cfg.fillColor;
        ctx.fill();

        // ── Black Under-Stroke (Contrast outline against ocean tiles) ────
        ctx.beginPath();
        pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.lineWidth = cfg.strokeWidth + 2;
        ctx.stroke();

        // ── Main Color Stroke ────────────────────────────────────────────
        ctx.beginPath();
        pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.strokeStyle = cfg.strokeColor;
        ctx.lineWidth = cfg.strokeWidth;
        if (zone.potential === 'low') ctx.setLineDash([5, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // ── Centroid label + fish marker with Dark Backdrop Pill ─────────
        const centPx = latLonToPixel(map, zone.centroid[0], zone.centroid[1]);

        ctx.save();
        
        // Draw dark translucent pill behind label for contrast
        const pillW = zone.potential === 'high' ? 64 : 52;
        const pillH = zone.potential === 'high' ? 34 : 20;
        const pillX = centPx.x - pillW / 2;
        const pillY = centPx.y - (zone.potential === 'high' ? 20 : 10);

        ctx.fillStyle = 'rgba(10, 14, 26, 0.88)';
        ctx.strokeStyle = cfg.strokeColor;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(pillX, pillY, pillW, pillH, 6);
        } else {
          ctx.rect(pillX, pillY, pillW, pillH);
        }
        ctx.fill();
        ctx.stroke();

        // PFZ ID label text inside pill
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (zone.potential === 'high') {
          // Fish emoji above the ID
          ctx.font = '12px serif';
          ctx.fillText(FISH_EMOJI, centPx.x - 18, centPx.y - 4);
          ctx.font = 'bold 10px JetBrains Mono, monospace';
          ctx.fillStyle = cfg.textColor;
          ctx.fillText(zone.id, centPx.x + 8, centPx.y - 4);

          // "HIGH" subtitle
          ctx.font = 'bold 8px JetBrains Mono, monospace';
          ctx.fillStyle = '#FFC107';
          ctx.fillText('HIGH PFZ', centPx.x, centPx.y + 8);
        } else if (zone.potential === 'moderate') {
          ctx.font = 'bold 10px JetBrains Mono, monospace';
          ctx.fillStyle = cfg.textColor;
          ctx.fillText(zone.id, centPx.x, centPx.y);
        } else {
          ctx.font = 'bold 9px JetBrains Mono, monospace';
          ctx.fillStyle = cfg.textColor;
          ctx.fillText(zone.id, centPx.x, centPx.y);
        }
        ctx.restore();
      });

      pixelPolygonsRef.current = newPixelPolygons;
    };

    redraw();
    map.on('move', redraw);
    map.on('zoom', redraw);
    map.on('resize', redraw);

    // ── Click handler ────────────────────────────────────────────────────
    const handleMapClick = (e) => {
      if (!enabled) return;
      const clickPt = map.latLngToContainerPoint(e.latlng);

      // Iterate in reverse (top zones first if overlapping)
      const polygons = pixelPolygonsRef.current;
      for (let i = polygons.length - 1; i >= 0; i--) {
        const { zone, pts } = polygons[i];
        if (isPointInPixelPolygon(clickPt.x, clickPt.y, pts)) {
          if (onZoneClick) onZoneClick(zone, e.latlng);
          return; // consume click — prevent probe card from opening for PFZ clicks
        }
      }
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('move', redraw);
      map.off('zoom', redraw);
      map.off('resize', redraw);
      map.off('click', handleMapClick);
      if (canvasRef.current) {
        canvasRef.current.remove();
        canvasRef.current = null;
      }
    };
  }, [map, zones, enabled, onZoneClick]);

  return null;
}

/**
 * Ray-casting point-in-polygon test in pixel space.
 */
function isPointInPixelPolygon(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y;
    const xj = pts[j].x, yj = pts[j].y;
    const intersect = ((yi > py) !== (yj > py)) &&
      (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
