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
const num2 = (n) => (Number.isFinite(Number(n)) ? Number(n).toFixed(2) : '—');

function hourLabel(h) {
  const c = Math.max(0, Math.min(23, Math.round(Number(h) || 0)));
  return `${String(c).padStart(2, '0')}:00`;
}

/* Compact artifact + held-out-result line under the result summary. */
function ModelNote({ model, dateContext, lines }) {
  const range = model && model.train_date_range;
  const codeHash = model && model.provenance && model.provenance.code_sha256;
  return (
    <div className="fcx-modelnote">
      <div className="fcx-modelnote__head">
        <Icon name="info" size={13} />
        <span>
          Artifact <code>{(model && model.artifact_version) || 'v2'}</code>
          {range && range.min ? ` · trained on ${range.min} → ${range.max}` : ''}
          {codeHash ? ` · code ${codeHash.slice(0, 7)}` : ''}
        </span>
      </div>
      {dateContext && dateContext.extrapolation && (
        <p className="fcx-modelnote__warn">
          <Icon name="alert-triangle" size={12} /> Date outside the observed window — this is an
          unvalidated extrapolation, shown to exercise the integration.
        </p>
      )}
      <ul>{lines.filter(Boolean).map((l) => <li key={l}>{l}</li>)}</ul>
      <p className="fcx-modelnote__foot">
        Held-out figures below; the mean baseline is a sanity check, not a target. Swap in a
        client model or client data and this same layer serves it unchanged.
      </p>
    </div>
  );
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
        subtitle="How a trained model plugs into the application — dataset, versioned artifact, inference API and honest limitations."
        actions={
          <span className="fcx-status">
            <Icon name="info" size={13} /> Integration demo
          </span>
        }
      />

      <details className="fcx-disclosure">
        <summary>What this is (and what it is not)</summary>
        <div>
          <p>
            This feature demonstrates a <strong>complete, replaceable ML integration</strong>:
            dataset validation, reproducible preprocessing, a versioned model artifact with
            provenance (source-code and dataset hashes), inference-only API serving, compatibility
            checks and structured errors. It is <strong>not</strong> meant to prove predictive
            performance.
          </p>
          <p>
            The models are RandomForest regressors trained on a fixed <strong>~2-week 2022
            sample</strong> (2021-12-31 → 2022-01-14). Evaluation uses a <strong>chronological
            hold-out</strong> — earliest dates train, latest dates test, no date in both — and the
            test dates were never used for model selection or tuning. Naive means (global,
            per-station, per-day-of-week) are reported alongside as <strong>sanity checks</strong>,
            not a target. On a sample this small the models are close to those means; the numbers
            show the pipeline works end to end, nothing more.
          </p>
          <p>
            Peak hour is the integer hour 0–23 with the highest of 24 predicted hourly volumes (not
            a regressed fractional hour), scored with circular distance so 23:00 and 00:00 are
            adjacent. No confidence intervals — the sample cannot justify them. Dates far outside
            the ~2-week window are flagged as extrapolation.
          </p>
          <p>
            <strong>With real client data or a client-provided model</strong>, the same API and
            artifact contract serve a replacement bundle — retrain, drop it in
            <code> ml/artifacts/</code>, done — without changing the application. Full methodology:
            <code> docs/ML_METHODOLOGY.md</code>.
          </p>
        </div>
      </details>

      <VolumeForecast />
      <PeakHourForecast />
    </>
  );
}

/* ---------------- Passage-volume forecast ---------------- */
const HELD_OUT_DATE = '2022-01-14'; // default demo: a held-out test date, not extrapolation
const EMPTY = { status: 'idle', rows: [], error: '', model: null, evaluation: null, dateContext: null };

function VolumeForecast() {
  const [op, setOp] = useState('NAO');
  const [date, setDate] = useState(HELD_OUT_DATE);
  const [state, setState] = useState(EMPTY);

  const run = async () => {
    setState({ ...EMPTY, status: 'loading' });
    try {
      const body = await apiGet(apiUrl(`/forecast/${op}/${date.replace(/-/g, '')}`));
      const list = Array.isArray(body.stations) ? body.stations : [];
      if (body.empty === true && !list.length) {
        setState({ ...EMPTY, status: 'empty' });
        return;
      }
      const rows = list.map((s, i) => ({
        station: s.tollID || `${op}${String(i + 1).padStart(2, '0')}`,
        value: Math.max(0, Number(s.predicted_passages) || 0),
      }));
      setState({
        ...EMPTY, status: 'ready', rows,
        model: body.model || null, evaluation: body.evaluation || null,
        dateContext: body.date_context || null,
      });
    } catch (err) {
      setState({ ...EMPTY, status: 'error', error: err.message });
    }
  };

  const didAuto = useRef(false);
  useEffect(() => {
    if (didAuto.current) return;
    didAuto.current = true;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { status, rows, error, model, evaluation, dateContext } = state;
  const total = rows.reduce((s, r) => s + r.value, 0);
  const peak = rows.reduce((m, r) => (r.value > m.value ? r : m), { value: -1, station: '—' });

  return (
    <section className="ui-section fcx-block">
      <h2>Passage-volume forecast</h2>
      <div className="fcx-controls">
        <Field label="Operator">
          <Select value={op} onChange={(e) => setOp(e.target.value)} options={OP_OPTIONS} />
        </Field>
        <Field label="Date" hint="Default: a held-out test date. Data covers 2021-12-31 → 2022-01-14.">
          <input type="date" className="ui-input" value={date} min="2021-12-31" max="2023-12-31"
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
          {(evaluation || dateContext) && (
            <ModelNote
              model={model}
              dateContext={dateContext}
              lines={evaluation ? [
                `Held-out test MAE ${num2(evaluation.test_mae)} passages/station-day · RMSE ${num2(evaluation.test_rmse)}`,
                evaluation.sanity_check_baseline
                  ? `Sanity check — a "${evaluation.sanity_check_baseline.name}" scores MAE ${num2(evaluation.sanity_check_baseline.test_mae)} on the same dates`
                  : null,
              ] : []}
            />
          )}
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
  const [range, setRange] = useState({ from: '2022-01-13', to: '2022-01-14' });
  const [state, setState] = useState(EMPTY);

  const run = async () => {
    if (range.from > range.to) {
      setState({ ...EMPTY, status: 'error', error: 'From must be on or before To.' });
      return;
    }
    setState({ ...EMPTY, status: 'loading' });
    try {
      const body = await apiGet(apiUrl(`/peak_hour/${op}/${range.from.replace(/-/g, '')}/${range.to.replace(/-/g, '')}`));
      const list = Array.isArray(body.predictions) ? body.predictions : [];
      if ((body.empty === true && !list.length) || !list.length) { setState({ ...EMPTY, status: 'empty' }); return; }
      const seen = new Set();
      const rows = [];
      list.forEach((r) => {
        const day = String(r.passage_date || '').slice(0, 10);
        if (!day || seen.has(day)) return;
        seen.add(day);
        const hour = Math.max(0, Math.min(23, Math.round(Number(r.predicted_hour) || 0)));
        rows.push({ day, hour, label: hourLabel(hour) });
      });
      setState({
        ...EMPTY, status: 'ready', rows,
        model: body.model || null, evaluation: body.evaluation || null,
        dateContext: body.date_context || null,
      });
    } catch (err) {
      setState({ ...EMPTY, status: 'error', error: err.message });
    }
  };

  const { status, rows, error, model, evaluation, dateContext } = state;
  const modeHour = rows.length
    ? Number(Object.entries(rows.reduce((m, r) => ({ ...m, [r.hour]: (m[r.hour] || 0) + 1 }), {}))
        .sort((a, b) => b[1] - a[1])[0][0])
    : 0;

  return (
    <section className="ui-section fcx-block">
      <h2>Peak-hour prediction</h2>
      <div className="fcx-controls">
        <Field label="Operator">
          <Select value={op} onChange={(e) => setOp(e.target.value)} options={OP_OPTIONS} />
        </Field>
        <Field label="From" hint="Default: the held-out test dates">
          <input type="date" className="ui-input" value={range.from} max={range.to} min="2021-12-31"
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
            <StatCard label="Most common predicted hour" value={hourLabel(modeHour)} hint="Integer hour, argmax of 24 hourly volumes" />
            <StatCard label="Days predicted" value={rows.length} />
          </div>
          {(evaluation || dateContext) && (
            <ModelNote
              model={model}
              dateContext={dateContext}
              lines={evaluation ? [
                `Held-out test: exact-hour ${Math.round((evaluation.exact_hour_accuracy || 0) * 100)}%, within one hour ${Math.round((evaluation.within_1_hour_accuracy || 0) * 100)}% (circular distance)`,
                `Mean circular error ${num2(evaluation.mean_circular_abs_error_hours)} h${evaluation.sanity_check_baseline ? ` · sanity check vs the "${evaluation.sanity_check_baseline.name}" baseline` : ''}`,
              ] : []}
            />
          )}
          <div className="fcx-viz scroll-x">
            <ResponsiveContainer width="100%" height={240} minWidth={360}>
              <LineChart data={rows} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: 'var(--chart-axis)', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'var(--chart-grid)' }} />
                <YAxis domain={[0, 23]} ticks={[0, 6, 12, 18, 23]} tickFormatter={(v) => `${v}:00`}
                  tick={{ fill: 'var(--chart-axis)', fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
                <Tooltip formatter={(v) => [hourLabel(v), 'Predicted peak hour']} />
                <Line type="stepAfter" dataKey="hour" stroke="var(--navy-700)" strokeWidth={2} dot={{ r: 3, fill: 'var(--teal-500)' }}>
                  <LabelList dataKey="hour" position="top" formatter={(v) => hourLabel(v)} style={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="fcx-note">
            Each value is the integer hour (0–23) with the highest predicted passage volume that day.
          </p>
          <div className="scroll-x fcx-tablewrap">
            <table className="ui-table">
              <thead><tr><th>Day</th><th>Predicted peak hour</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.day}><td>{r.day}</td><td>{r.label}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
