import React from 'react';
import { PageHeader, Alert, Button } from '../components/ui';
import BrowserFrame from '../components/BrowserFrame';
import shotOverview from '../assets/shot-overview.webp';
import './ProjectPage.css';

const STACK = [
  ['Frontend', 'React (Create React App), React Router, Leaflet + marker clustering, Recharts, plain-CSS design tokens'],
  ['Backend', 'Node.js / Express REST API, JWT auth with role-based access, MySQL 8 (mysql2), OpenAPI'],
  ['Machine learning', 'Python 3.11, scikit-learn (RandomForest regressors), pandas / NumPy'],
  ['Delivery', 'Docker + docker compose, single-container topology, Jest (unit + disposable-DB integration)'],
];

export default function ProjectPage() {
  return (
    <>
      <PageHeader
        title="Project"
        subtitle="What TollAnalysis is, how it is built, and who built what."
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon="github"
            href="https://github.com/StavrosMitro/TollAnalysisWebApp"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </Button>
        }
      />

      <section className="pjx-lead">
        <div className="pjx-lead__text">
          <p>
            Greek motorways are run by eight separate concessionaires, yet one e-pass works across
            all of them. Every cross-operator passage creates an obligation between two operators.
            TollAnalysis keeps a shared record of passages and turns it into an interactive map,
            traffic and charge analytics, short-term ML forecasts, and a minimum-cash-flow
            settlement of the accumulated inter-operator debt.
          </p>
          <p className="pjx-muted">
            Built as a Software Engineering group project at ECE, NTUA, then stabilised,
            containerised and redesigned as this portfolio demonstration.
          </p>
        </div>
        <BrowserFrame url="tollanalysis · overview" className="pjx-shot">
          <img src={shotOverview} alt="The TollAnalysis overview dashboard" width="1200" height="760" loading="lazy" />
        </BrowserFrame>
      </section>

      <section className="ui-section">
        <h2>How it works</h2>
        <p className="pjx-muted pjx-arch-note">
          One application container serves the React production build <em>and</em> the REST API on a
          single origin. MySQL runs as a separate service. The Python ML runtime ships in the same
          image and is invoked as a subprocess for predictions.
        </p>
        <div className="scroll-x">
          <pre className="pjx-arch">{`Browser ──▶ App container (Express)
             ├─ /         React production build
             ├─ /api/*    REST API  (JWT, RBAC)
             └─ ml/*.py   scikit-learn predictions
                    │
                    ▼
               MySQL 8   (schema + deterministic seed)`}</pre>
        </div>
      </section>

      <section className="ui-section">
        <h2>Built with</h2>
        <dl className="pjx-stack">
          {STACK.map(([group, items]) => (
            <div key={group}>
              <dt>{group}</dt>
              <dd>{items}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="ui-section">
        <h2>Replaceable ML integration</h2>
        <p className="pjx-muted">
          The Traffic Forecast feature is built as an <strong>integration layer</strong>, not a
          predictor: dataset validation, reproducible preprocessing, a versioned model artifact
          that records the source-code and dataset hashes that produced it, inference-only API
          serving, load-time compatibility checks, and structured errors. The bundled models are
          trained on a fixed ~2-week 2022 sample purely to exercise that contract end to end.
        </p>
        <p className="pjx-muted">
          Given <strong>real client data or a client-provided model</strong>, the same pipeline
          retrains a replacement bundle and the same API serves it — no application changes.
          Everything is reproducible in the pinned container
          (<code>docs/ML_METHODOLOGY.md</code>).
        </p>
      </section>

      <section className="ui-section">
        <h2>Contributors</h2>
        <div className="pjx-people">
          <div>
            <h3>Stavros <span className="pjx-tag">this portfolio work</span></h3>
            <ul>
              <li>REST API / backend development (Node.js, Express)</li>
              <li>Relational database design</li>
              <li>Project documentation and API functional testing</li>
              <li>Later: reproducible environment, security &amp; stabilisation, safe demo mode, this UI redesign</li>
            </ul>
          </div>
          <div>
            <h3>Original team</h3>
            <ul>
              <li>Dimitris Thivaios</li>
              <li>Dimitris Liakis</li>
              <li>Vassilis Anastasiadis</li>
            </ul>
            <p className="pjx-muted pjx-note">
              The original application was a group effort — not every feature was implemented by one
              person.
            </p>
          </div>
        </div>
      </section>

      <Alert variant="warning" title="Machine-learning limitations">
        The forecasting models are an <strong>integration demonstration</strong>, not a predictor.
        They are RandomForest regressors trained on a fixed ~2-week 2022 sample and evaluated on a
        chronological hold-out; naive means are reported as sanity checks. On a sample this small
        the models track those means closely — the numbers show the integration works, not that the
        forecasts are accurate.
      </Alert>
    </>
  );
}
