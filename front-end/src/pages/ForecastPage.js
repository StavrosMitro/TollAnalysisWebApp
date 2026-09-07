import React, { useEffect, useRef, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts';
import { apiUrl, authHeaders } from '../api/config';
import {
  PageHeader, StatCard, Field, Select, Button, LoadingState, EmptyState, ErrorState, Icon,
} from '../components/ui';
import { OPERATORS } from '../lib/operators';
import './ForecastPage.css';

const OP_OPTIONS = OPERATORS.map((o) => ({ value: o.code, label: o.label }));
const num1 = (n) => (Math.round((Number(n) || 0) * 10) / 10).toString();

function hourLabel(h) {
  const c = Math.max(0, Math.min(23, Math.round(Number(h) || 0)));
  return `${String(c).padStart(2, '0')}:00`;
}

async function apiGet(url) {
  const res = await fetch(url, { headers: authHeaders() });
  if (res.status === 204) return { empty: true };
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error('Your session expired. Please restart the demo.');
  if (!res.ok) throw new Error((body && body.error && (body.error.message || body.error)) || 'The forecast request failed.');
  return body;
}

export default function ForecastPage() {
  return (
    <>
      <PageHeader
        title="Traffic Forecast"
        subtitle="Pre-trained models estimate future passage volume and peak hours per operator."
        actions={
          <span className="fcx-status">
            <Icon name="info" size={13} /> Educational model
          </span>
        }
      />

      <details className="fcx-disclosure">
        <summary>Model details and limitations</summary>
        <p>
          The models are RandomForest regressors trained on a small 2022 sample. They illustrate an
          applied-ML pipeline; the current evaluation does not use a strict chronological hold-out or
          a baseline comparison, so the outputs are <strong>not production-grade predictions</strong>.
          Peak-hour prediction regresses the hour directly, which ignores that 23:00 and 00:00 are
          adjacent. A proper methodology review is planned for a later milestone. No confidence
          intervals are shown because the current setup cannot justify them.
        </p>
      </details>

      <VolumeForecast />
      <PeakHourForecast />
    </>
  );
}

/* ---------------- Passage-volume forecast ---------------- */
function VolumeForecast() {
  const [op, setOp] = useState('NAO');
  const [date, setDate] = useState('2022-03-15');
  const [state, setState] = useState({ status: 'idle', rows: [], error: '' });

  const run = async () => {
    setState({ status: 'loading', rows: [], error: '' });
    try {
      const body = await apiGet(apiUrl(`/forecast/${op}/${date.replace(/-/g, '')}`));
      if (body.empty || !Array.isArray(body.predictions) || !body.predictions.length) {
        setState({ status: 'empty', rows: [], error: '' });
        return;
      }
      const rows = body.predictions.map((v, i) => ({
        station: `${op}${String(i + 1).padStart(2, '0')}`,
        value: Math.max(0, Number(v) || 0),
      }));
      setState({ status: 'ready', rows, error: '' });
    } catch (err) {
      setState({ status: 'error', rows: [], error: err.message });
    }
  };

  const didAuto = useRef(false);
  useEffect(() => {
    if (didAuto.current) return;
    didAuto.current = true;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { status, rows, error } = state;
  const total = rows.reduce((s, r) => s + r.value, 0);
  const peak = rows.reduce((m, r) => (r.value > m.value ? r : m), { value: -1, station: '—' });

  return (
    <section className="ui-section fcx-block">
      <h2>Passage-volume forecast</h2>
      <div className="fcx-controls">
        <Field label="Operator">
          <Select value={op} onChange={(e) => setOp(e.target.value)} options={OP_OPTIONS} />
        </Field>
        <Field label="Forecast date">
          <input type="date" className="ui-input" value={date} min="2022-01-01" max="2023-12-31"
            onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Button onClick={run} loading={status === 'loading'}>
          {status === 'loading' ? 'Forecasting…' : 'Forecast'}
        </Button>
      </div>

      {status === 'idle' && <EmptyState icon="trending-up" title="No forecast yet" message="Pick an operator and date, then forecast." />}
      {status === 'loading' && <LoadingState label="Running the model…" />}
      {status === 'error' && <ErrorState message={error} onRetry={run} />}
      {status === 'empty' && <EmptyState icon="inbox" title="No forecast returned" message="Try another operator or date." />}
      {status === 'ready' && (
        <>
          <div className="fcx-summary">
            <StatCard label="Total forecast passages" value={num1(total)} hint={`across ${rows.length} stations, ${date}`} />
            <StatCard label="Busiest station" value={peak.station} hint={`≈ ${num1(peak.value)} passages`} />
          </div>
          <div className="fcx-viz scroll-x">
            <ResponsiveContainer width="100%" height={260} minWidth={360}>
              <BarChart data={rows} margin={{ top: 18, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="station" tick={{ fill: 'var(--chart-axis)', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'var(--chart-grid)' }} interval={0} angle={-40} textAnchor="end" height={54} />
                <YAxis tick={{ fill: 'var(--chart-axis)', fontSize: 11 }} tickLine={false} axisLine={false} width={34} allowDecimals />
                <Tooltip cursor={{ fill: 'rgba(11,37,69,0.05)' }} formatter={(v) => [num1(v), 'Forecast passages']} />
                <Bar dataKey="value" fill="var(--teal-500)" radius={[2, 2, 0, 0]} maxBarSize={22}>
                  <LabelList dataKey="value" position="top" formatter={(v) => num1(v)} style={{ fill: 'var(--color-text-muted)', fontSize: 9 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </section>
  );
}

/* ---------------- Peak-hour prediction ---------------- */
function PeakHourForecast() {
  const [op, setOp] = useState('NAO');
  const [range, setRange] = useState({ from: '2022-01-10', to: '2022-01-20' });
  const [state, setState] = useState({ status: 'idle', rows: [], error: '' });

  const run = async () => {
    if (range.from > range.to) {
      setState({ status: 'error', rows: [], error: 'From must be on or before To.' });
      return;
    }
    setState({ status: 'loading', rows: [], error: '' });
    try {
      const body = await apiGet(apiUrl(`/peak_hour/${op}/${range.from.replace(/-/g, '')}/${range.to.replace(/-/g, '')}`));
      const list = Array.isArray(body) ? body : [];
      if (body.empty || !list.length) { setState({ status: 'empty', rows: [], error: '' }); return; }
      const seen = new Set();
      const rows = [];
      list.forEach((r) => {
        const day = String(r.passage_date || '').slice(0, 10);
        if (seen.has(day)) return;
        seen.add(day);
        const raw = Number(r.predicted_hour) || 0;
        rows.push({ day, hour: Math.round(raw), rawHour: raw, label: hourLabel(raw) });
      });
      setState({ status: 'ready', rows, error: '' });
    } catch (err) {
      setState({ status: 'error', rows: [], error: err.message });
    }
  };

  const { status, rows, error } = state;
  const avg = rows.length ? rows.reduce((s, r) => s + r.rawHour, 0) / rows.length : 0;

  return (
    <section className="ui-section fcx-block">
      <h2>Peak-hour prediction</h2>
      <div className="fcx-controls">
        <Field label="Operator">
          <Select value={op} onChange={(e) => setOp(e.target.value)} options={OP_OPTIONS} />
        </Field>
        <Field label="From">
          <input type="date" className="ui-input" value={range.from} max={range.to}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
        </Field>
        <Field label="To">
          <input type="date" className="ui-input" value={range.to} min={range.from}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
        </Field>
        <Button onClick={run} loading={status === 'loading'}>
          {status === 'loading' ? 'Predicting…' : 'Predict'}
        </Button>
      </div>

      {status === 'idle' && <EmptyState icon="clock" title="No prediction yet" message="Pick an operator and date range, then predict." />}
      {status === 'loading' && <LoadingState label="Running the model…" />}
      {status === 'error' && <ErrorState message={error} onRetry={run} />}
      {status === 'empty' && <EmptyState icon="inbox" title="No prediction returned" message="No output for this operator / range." />}
      {status === 'ready' && (
        <>
          <div className="fcx-summary">
            <StatCard label="Typical predicted peak" value={hourLabel(avg)} hint="Rounded to the nearest hour" />
            <StatCard label="Days predicted" value={rows.length} />
          </div>
          <div className="fcx-viz scroll-x">
            <ResponsiveContainer width="100%" height={240} minWidth={360}>
              <LineChart data={rows} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: 'var(--chart-axis)', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'var(--chart-grid)' }} />
                <YAxis domain={[0, 23]} ticks={[0, 6, 12, 18, 23]} tickFormatter={(v) => `${v}:00`}
                  tick={{ fill: 'var(--chart-axis)', fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
                <Tooltip formatter={(v) => [hourLabel(v), 'Predicted peak hour']} />
                <Line type="monotone" dataKey="rawHour" stroke="var(--navy-700)" strokeWidth={2} dot={{ r: 3, fill: 'var(--teal-500)' }}>
                  <LabelList dataKey="rawHour" position="top" formatter={(v) => hourLabel(v)} style={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="fcx-note">
            The model outputs a continuous value; it is shown rounded to the nearest whole hour (raw
            values in the table).
          </p>
          <div className="scroll-x fcx-tablewrap">
            <table className="ui-table">
              <thead><tr><th>Day</th><th>Predicted peak hour</th><th className="num">Raw model value</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.day}><td>{r.day}</td><td>{r.label}</td><td className="num">{r.rawHour.toFixed(2)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
