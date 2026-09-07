import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { apiUrl, authHeaders } from '../api/config';
import { PageHeader, Icon, Skeleton, ErrorState } from '../components/ui';
import NetworkGlyph from '../components/NetworkGlyph';
import { OPERATORS, OP_LABEL, operatorColor, operatorOf } from '../lib/operators';
import './OverviewPage.css';

const JOURNEY = [
  { to: '/map', label: 'Open the Toll Map', text: 'Every station, filter by operator' },
  { to: '/analytics', label: 'Run Traffic Analytics', text: 'Cross-operator passages and charges' },
  { to: '/forecast', label: 'Generate a Forecast', text: 'Estimated future passage volume' },
  { to: '/debts', label: 'View Debt Optimization', text: 'Inter-operator settlement, before / after' },
];

const fmt = (n) => new Intl.NumberFormat('en-US').format(n);

export default function OverviewPage() {
  const [state, setState] = useState({ loading: true, error: '', tolls: [], debtCsv: '' });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [tollsRes, debtRes] = await Promise.all([
          fetch(apiUrl('/tolls')),
          fetch(apiUrl('/get_debts_optimization'), { headers: authHeaders() }),
        ]);
        if (!tollsRes.ok) throw new Error('Could not load toll data.');
        const tolls = await tollsRes.json();
        let debtCsv = '';
        if (debtRes.ok) {
          const d = await debtRes.json();
          debtCsv = (d && d.csv) || '';
        }
        if (alive) setState({ loading: false, error: '', tolls, debtCsv });
      } catch (err) {
        if (alive) setState({ loading: false, error: err.message || 'Failed to load overview.', tolls: [], debtCsv: '' });
      }
    })();
    return () => { alive = false; };
  }, []);

  const { loading, error, tolls, debtCsv } = state;

  if (error) {
    return (
      <>
        <PageHeader title="Overview" subtitle="A snapshot of the toll network in the sample dataset." />
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      </>
    );
  }

  const byOperator = {};
  tolls.forEach((t) => {
    const op = operatorOf(t.tollId) || 'other';
    byOperator[op] = (byOperator[op] || 0) + 1;
  });
  const opRows = OPERATORS
    .map((o) => ({ op: o.code, name: o.label, count: byOperator[o.code] || 0 }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  let settled = null;
  if (debtCsv) {
    const total = debtCsv.trim().split('\n').slice(1)
      .reduce((s, r) => s + (parseFloat(r.split(',')[2]) || 0), 0);
    if (Number.isFinite(total) && total > 0) settled = total;
  }

  const stationCount = tolls.length;
  const operatorCount = opRows.length || 8;

  const metrics = [
    { label: 'Operators', value: operatorCount, hint: 'Toll concessionaires' },
    { label: 'Toll stations', value: fmt(stationCount || 253), hint: 'Live from the API' },
    { label: 'Passages', value: '1,002', hint: 'Sample dataset · fixed' },
    { label: 'Debts settled', value: settled != null ? `€${fmt(Math.round(settled))}` : '—', hint: 'After optimization' },
  ];

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Greece's interoperable motorway toll network, from the fixed 2022 sample dataset."
      />

      {/* Network context + headline metrics */}
      <div className="ov-hero">
        <div className="ov-hero__map" aria-hidden="true">
          {loading ? <Skeleton height={260} /> : <NetworkGlyph tolls={tolls} width={560} height={280} />}
          <span className="ov-hero__map-label">253 toll stations · 8 operators</span>
        </div>
        <dl className="ov-metrics">
          {metrics.map((m) => (
            <div key={m.label} className="ov-metric">
              <dt>{m.label}</dt>
              <dd>{loading ? <Skeleton width="60%" height={26} /> : m.value}</dd>
              <span>{m.hint}</span>
            </div>
          ))}
        </dl>
      </div>

      {/* Stations by operator */}
      <section className="ui-section ov-chart">
        <h2>Toll stations by operator</h2>
        {loading ? (
          <Skeleton height={280} />
        ) : (
          <div className="scroll-x">
            <ResponsiveContainer width="100%" height={300} minWidth={340}>
              <BarChart data={opRows} margin={{ top: 20, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--chart-grid)" vertical={false} />
                <XAxis
                  dataKey="op"
                  tick={{ fill: 'var(--chart-axis)', fontSize: 12, fontWeight: 600 }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--chart-grid)' }}
                />
                <YAxis tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} tickLine={false} axisLine={false} width={32} />
                <Tooltip
                  cursor={{ fill: 'rgba(11,37,69,0.05)' }}
                  formatter={(v) => [`${v} stations`, 'Stations']}
                  labelFormatter={(op) => OP_LABEL[op] || op}
                />
                <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={46}>
                  <LabelList dataKey="count" position="top" style={{ fill: 'var(--color-text-muted)', fontSize: 12, fontWeight: 600 }} />
                  {opRows.map((r) => <Cell key={r.op} fill={operatorColor(r.op)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Suggested journey */}
      <section className="ui-section">
        <h2>Suggested demo journey</h2>
        <ol className="ov-journey">
          {JOURNEY.map((j, i) => (
            <li key={j.to}>
              <Link to={j.to} className="ov-journey__item">
                <span className="ov-journey__num">{i + 1}</span>
                <span className="ov-journey__text">
                  <strong>{j.label}</strong>
                  <span>{j.text}</span>
                </span>
                <Icon name="chevron-right" size={16} className="ov-journey__chev" />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <p className="ov-note">
        Figures come from a fixed educational sample (2022 passages) used for the Software Engineering
        course at NTUA — not live traffic, not for operational use.
      </p>
    </>
  );
}
