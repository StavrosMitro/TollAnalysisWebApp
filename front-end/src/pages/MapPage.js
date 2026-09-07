import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import './MapPage.css';
import { apiUrl } from '../api/config';
import { tollName } from '../lib/tollNames';
import { OPERATORS, operatorName, operatorColor, operatorOf } from '../lib/operators';
import { Icon, Field, Select, Input, Badge, ErrorState, EmptyState } from '../components/ui';

const opCode = (toll) => operatorOf(toll.tollId || toll.operator);

// One divIcon per operator colour (shared across markers), plus a neutral default.
const iconCache = {};
const markerIconFor = (code) => {
  const key = code || 'default';
  if (!iconCache[key]) {
    iconCache[key] = L.divIcon({
      className: 'toll-marker',
      html: `<span style="background:${operatorColor(code)}"></span>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
  }
  return iconCache[key];
};

export default function MapPage() {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const clusterRef = useRef(null);
  const [tolls, setTolls] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error | empty
  const [operator, setOperator] = useState('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(apiUrl('/tolls'));
        if (res.status === 204) { if (alive) setStatus('empty'); return; }
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!alive) return;
        setTolls(Array.isArray(data) ? data : []);
        setStatus(data.length ? 'ready' : 'empty');
      } catch (e) {
        if (alive) setStatus('error');
      }
    })();
    return () => { alive = false; };
  }, []);

  // Init Leaflet once we have the container and data
  useEffect(() => {
    if (status !== 'ready' || mapRef.current || !mapEl.current) return undefined;
    const map = L.map(mapEl.current, { zoomControl: false, center: [38.4, 23.7], zoom: 7 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    const cluster = L.markerClusterGroup({ maxClusterRadius: 45, showCoverageOnHover: false });
    map.addLayer(cluster);
    mapRef.current = map;
    clusterRef.current = cluster;
    setTimeout(() => map.invalidateSize(), 0);
    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
    };
  }, [status]);

  const filtered = useMemo(
    () =>
      tolls.filter((t) => {
        const okOp = operator === 'all' || opCode(t) === operator;
        const okName = !query || tollName(t.tollId).toLowerCase().includes(query.toLowerCase());
        return okOp && okName;
      }),
    [tolls, operator, query]
  );

  // Redraw markers on filter change
  useEffect(() => {
    const cluster = clusterRef.current;
    const map = mapRef.current;
    if (!cluster || !map) return;
    cluster.clearLayers();
    const pts = [];
    filtered.forEach((t) => {
      const lat = parseFloat(t.latitude);
      const lng = parseFloat(t.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return;
      pts.push([lat, lng]);
      const marker = L.marker([lat, lng], { icon: markerIconFor(opCode(t)), keyboard: true, title: tollName(t.tollId) });
      marker.on('click', () => setSelected(t));
      cluster.addLayer(marker);
    });
    if (pts.length) {
      map.fitBounds(L.latLngBounds(pts).pad(0.15), { animate: false, maxZoom: 11 });
    }
  }, [filtered]);

  const detail = selected && (
    <aside className="mapx__detail" aria-label="Selected toll station">
      <button className="mapx__detail-close" onClick={() => setSelected(null)} aria-label="Close details">
        <Icon name="x" size={16} />
      </button>
      <Badge variant="neutral" icon="map-pin">{operatorName(opCode(selected))}</Badge>
      <h3>{tollName(selected.tollId)}</h3>
      <dl className="mapx__detail-list">
        <div><dt>Station ID</dt><dd>{selected.tollId}</dd></div>
        {selected.email && (
          <div><dt>Contact</dt><dd><a href={`mailto:${selected.email}`}>{selected.email}</a></dd></div>
        )}
        <div>
          <dt>Toll prices (€)</dt>
          <dd className="mapx__prices">
            {(selected.prices || []).map((p, i) => (
              <span key={i}>Cat {i + 1}: <b>{Number(p).toFixed(2)}</b></span>
            ))}
          </dd>
        </div>
      </dl>
    </aside>
  );

  return (
    <div className="mapx">
      <div className="mapx__toolbar">
        <div className="mapx__toolbar-title">
          <Icon name="map" size={18} />
          <div>
            <h1>Toll Map</h1>
            <p>{status === 'ready' ? `${filtered.length} of ${tolls.length} stations` : 'Toll stations across Greece'}</p>
          </div>
        </div>
        <div className="mapx__filters">
          <Field label="Operator">
            <Select
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              options={[{ value: 'all', label: 'All operators' }, ...OPERATORS.map((o) => ({ value: o.code, label: o.label }))]}
            />
          </Field>
          <Field label="Search stations">
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Station name…"
            />
          </Field>
        </div>
      </div>

      <div className="mapx__stage">
        {status === 'loading' && (
          <div className="mapx__overlay"><span className="ui-state__spinner" /><span>Loading toll stations…</span></div>
        )}
        {status === 'error' && (
          <div className="mapx__overlay">
            <ErrorState message="Could not load toll stations." onRetry={() => window.location.reload()} />
          </div>
        )}
        {status === 'empty' && (
          <div className="mapx__overlay"><EmptyState icon="map-pin" title="No stations" message="The API returned no toll stations." /></div>
        )}
        {status === 'ready' && filtered.length === 0 && (
          <div className="mapx__overlay mapx__overlay--soft">
            <EmptyState icon="filter" title="No matches" message="No stations match the current filters." />
          </div>
        )}

        <div ref={mapEl} className="mapx__canvas" role="application" aria-label="Map of toll stations" />

        <div className="mapx__legend">
          {OPERATORS.map((o) => (
            <span key={o.code} className="mapx__legend-op">
              <span className="mapx__legend-dot" style={{ background: o.color }} />
              {o.label}
            </span>
          ))}
          <span className="mapx__legend-op">
            <span className="mapx__legend-cluster">12</span> Cluster (zoom in)
          </span>
        </div>

        {detail}
      </div>
    </div>
  );
}
