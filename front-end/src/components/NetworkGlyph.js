import React, { useMemo } from 'react';
import { operatorOf, operatorColor } from '../lib/operators';

/**
 * A compact SVG plot of the toll network - real station coordinates projected
 * to a box, coloured by operator. Traces the shape of Greece's motorway network
 * without a basemap. Decorative (aria-hidden) - the real map is at /map.
 */
export default function NetworkGlyph({ tolls = [], width = 520, height = 300, className }) {
  const pts = useMemo(() => {
    const rows = tolls
      .map((t) => ({
        lat: parseFloat(t.latitude),
        lng: parseFloat(t.longitude),
        op: operatorOf(t.tollId || t.operator),
      }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (!rows.length) return [];
    const lats = rows.map((r) => r.lat);
    const lngs = rows.map((r) => r.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const pad = 14;
    const w = width - pad * 2;
    const h = height - pad * 2;
    const spanLng = maxLng - minLng || 1;
    const spanLat = maxLat - minLat || 1;
    // keep aspect: latitude ~1.3x longitude at this latitude
    const scale = Math.min(w / spanLng, h / (spanLat * 1.35));
    const offX = pad + (w - spanLng * scale) / 2;
    const offY = pad + (h - spanLat * 1.35 * scale) / 2;
    return rows.map((r) => ({
      x: offX + (r.lng - minLng) * scale,
      y: offY + (maxLat - r.lat) * 1.35 * scale,
      c: operatorColor(r.op),
    }));
  }, [tolls, width, height]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="presentation"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.4} fill={p.c} opacity="0.85" />
      ))}
    </svg>
  );
}
