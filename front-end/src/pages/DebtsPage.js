import React, { useEffect, useMemo, useState } from 'react';
import { apiUrl, authHeaders } from '../api/config';
import {
  PageHeader, StatCard, Icon, LoadingState, EmptyState, ErrorState,
} from '../components/ui';
import { operatorName, operatorColor } from '../lib/operators';
import './DebtsPage.css';

const money = (n) => `€${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0)}`;

/**
 * The pyvis export references files that were never deployed
 * (`lib/bindings/utils.js`, a local `vis.js`) and links a mis-pathed stylesheet
 * that resolves to an HTML 404 page. vis-network from the CDN renders the graph
 * on a canvas without any of them, so we strip the dead references. The graph
 * data and layout options are left untouched apart from one vis-network key fix.
 */
function cleanGraphHtml(html) {
  if (!html) return html;
  return html
    // dead local <script src> references
    .replace(/<script[^>]*src=["'](?:lib\/bindings\/utils\.js|\.\.\/node_modules\/[^"']*)["'][^>]*>\s*<\/script>/gi, '')
    // mis-pathed vis-network stylesheet (returns an HTML 404 page)
    .replace(/<link[^>]*vis-network[^>]*>/gi, '')
    // vis-network expects `edges.font`, not `edges.label` as an object
    .replace('"smooth": {"type": "dynamic"}, "label": {"font": {"size": 18, "color": "white"}}}', '"smooth": {"type": "dynamic"}, "font": {"size": 18, "color": "white"}}');
}

export default function DebtsPage() {
  const [state, setState] = useState({ status: 'loading', data: null, error: '' });
  const [view, setView] = useState('after'); // before | after

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(apiUrl('/get_debts_optimization'), { headers: authHeaders() });
        if (res.status === 204) { if (alive) setState({ status: 'empty', data: null, error: '' }); return; }
        if (res.status === 401) { if (alive) setState({ status: 'error', data: null, error: 'Your session expired. Please restart the demo.' }); return; }
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (alive) setState({ status: 'ready', data, error: '' });
      } catch (e) {
        if (alive) setState({ status: 'error', data: null, error: 'Could not load the debt-optimization result.' });
      }
    })();
    return () => { alive = false; };
  }, []);

  const { status, data, error } = state;

  const settlements = useMemo(() => {
    if (!data || !data.csv) return [];
    return data.csv.trim().split('\n').slice(1)
      .map((r) => r.split(','))
      .filter((r) => r.length >= 3 && parseFloat(r[2]) > 0)
      .map((r) => ({ debtor: r[0].trim(), creditor: r[1].trim(), amount: parseFloat(r[2]) }))
      .sort((a, b) => b.amount - a.amount);
  }, [data]);

  const totalToTransfer = settlements.reduce((s, r) => s + r.amount, 0);
  const html = data && data.html;
  const png = data && data.figures;
  const hasGraphs = html && (html.html1 || html.html2);

  return (
    <>
      <PageHeader
        title="Debt Optimization"
        subtitle="Netting the obligations that build up when an e-pass is used across operators."
      />

      <p className="dbx-intro">
        Every passage through a toll run by an operator other than the one that issued the e-pass
        creates a debt from the issuer to the collector. Over a period this becomes a web of pairwise
        debts. A minimum-cash-flow algorithm reduces it to the fewest transfers that leave every
        operator square. The result below is <strong>precomputed from the sample dataset — this page
        is read-only.</strong>
      </p>

      {status === 'loading' && <LoadingState label="Loading optimization result…" />}
      {status === 'error' && <ErrorState message={error} onRetry={() => window.location.reload()} />}
      {status === 'empty' && <EmptyState icon="network" title="No result available" message="The optimization figures have not been generated for this dataset." />}

      {status === 'ready' && (
        <>
          <div className="dbx-summary">
            <StatCard label="Settlement transfers" value={settlements.length} hint="After netting" />
            <StatCard label="Total to transfer" value={money(totalToTransfer)} hint="Sum of net obligations" />
            <StatCard label="Operators involved" value={new Set(settlements.flatMap((s) => [s.debtor, s.creditor])).size} />
          </div>

          {/* Interactive network graph */}
          <section className="ui-section dbx-graph">
            <div className="dbx-graph__head">
              <h2>Obligation network</h2>
              {hasGraphs && (
                <div className="dbx-toggle" role="group" aria-label="Graph state">
                  <button type="button" aria-pressed={view === 'before'} className={view === 'before' ? 'is-active' : ''} onClick={() => setView('before')}>
                    Before
                  </button>
                  <button type="button" aria-pressed={view === 'after'} className={view === 'after' ? 'is-active' : ''} onClick={() => setView('after')}>
                    After optimization
                  </button>
                </div>
              )}
            </div>

            {hasGraphs ? (
              <div className="dbx-frame-wrap">
                <iframe
                  key={view}
                  title={view === 'before' ? 'Initial obligations network (interactive)' : 'Optimized transfers network (interactive)'}
                  srcDoc={cleanGraphHtml(view === 'before' ? html.html1 : html.html2)}
                  className="dbx-frame"
                  sandbox="allow-scripts"
                  loading="lazy"
                />
                <p className="dbx-frame-hint">
                  <Icon name="info" size={12} /> Drag nodes, scroll to zoom. Edge labels are the amount owed (€).
                </p>
              </div>
            ) : png && (png.figure1 || png.figure2) ? (
              <img className="dbx-img" src={png.figure2 || png.figure1} alt="Optimized inter-operator transfer network" />
            ) : (
              <EmptyState title="Graph unavailable" message="The network visualization was not generated." />
            )}
          </section>

          {/* Settlement instructions */}
          <section className="ui-section">
            <h2>Settlement instructions</h2>
            {settlements.length === 0 ? (
              <EmptyState title="Already balanced" message="No transfers are required for this dataset." />
            ) : (
              <div className="scroll-x dbx-tablewrap">
                <table className="ui-table dbx-table">
                  <thead><tr><th>Pays</th><th aria-hidden="true"></th><th>Receives</th><th className="num">Amount</th></tr></thead>
                  <tbody>
                    {settlements.map((s, i) => (
                      <tr key={i}>
                        <td><span className="dbx-dot" style={{ background: operatorColor(s.debtor) }} />{operatorName(s.debtor)}</td>
                        <td className="dbx-arrow"><Icon name="arrow-right" size={15} /></td>
                        <td><span className="dbx-dot" style={{ background: operatorColor(s.creditor) }} />{operatorName(s.creditor)}</td>
                        <td className="num">{money(s.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr><td colSpan="3">Total</td><td className="num">{money(totalToTransfer)}</td></tr></tfoot>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
