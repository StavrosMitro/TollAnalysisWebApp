import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './LandingPage.css';
import { Button, Alert, BrandMark, Icon } from '../components/ui';
import BrowserFrame from '../components/BrowserFrame';
import { requestDemoSession } from '../api/config';
import shotMap from '../assets/shot-map.webp';
import shotAnalytics from '../assets/shot-analytics.webp';
import motorway from '../assets/motorway-egnatia-1600.webp';
import motorwaySm from '../assets/motorway-egnatia-800.webp';

const CAPABILITIES = [
  { icon: 'bar-chart', title: 'Traffic Analytics', text: 'Passage volumes and cross-operator charges over any date range, with CSV export.' },
  { icon: 'trending-up', title: 'Traffic Forecasting', text: 'Pre-trained models estimate future passage volume and peak hours per operator.' },
  { icon: 'network', title: 'Debt Optimization', text: 'Minimum-cash-flow settlement of the debts that accrue from shared e-pass usage.' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const expired = location.state && location.state.expired;

  const startDemo = async () => {
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const token = await requestDemoSession();
      localStorage.setItem('token', token);
      navigate('/overview');
    } catch (err) {
      setError(err.message || 'Could not start the demo. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-brand"><BrandMark badge size={28} /> TollAnalysis</div>
        <nav className="lp-nav__links" aria-label="Primary">
          <Link to="/map">Toll Map</Link>
          <Link to="/project">Project</Link>
          <Link to="/login">Sign in</Link>
        </nav>
      </header>

      <main id="main-content">
        <section className="lp-hero">
          <img
            className="lp-photo"
            src={motorway}
            srcSet={`${motorwaySm} 800w, ${motorway} 1600w`}
            sizes="100vw"
            alt=""
            aria-hidden="true"
          />
          <div className="lp-photo__scrim" aria-hidden="true" />
          <div className="lp-hero__inner">
            <div className="lp-hero__copy">
              <p className="lp-eyebrow">Toll passage management &amp; analysis</p>
              <h1 className="lp-title">
                The interoperable toll network of Greece, as a working analytics platform.
              </h1>
              <p className="lp-lede">
                Map every toll station, analyse traffic and cross-operator charges, forecast passage
                volume, and settle the debts that build up when one e-pass works across eight operators.
              </p>

              <ul className="lp-facts">
                <li><strong>8</strong> toll operators</li>
                <li><strong>253</strong> toll stations</li>
                <li>Interactive analytics &amp; ML forecasting</li>
              </ul>

              {expired && (
                <Alert variant="info" title="Session ended">Your demo session expired — start a new one below.</Alert>
              )}
              {error && <Alert variant="danger" title="Demo unavailable">{error}</Alert>}

              <div className="lp-cta">
                <Button size="lg" variant="accent" icon="arrow-right" loading={loading} onClick={startDemo}>
                  {loading ? 'Starting demo…' : 'Explore Live Demo'}
                </Button>
                <Button size="lg" variant="secondary" to="/project">View Project</Button>
              </div>
              <p className="lp-note">Read-only session on a fixed educational sample dataset — no account needed.</p>
            </div>

            <BrowserFrame url="tollanalysis · toll map" className="lp-shot">
              <img src={shotMap} alt="The TollAnalysis interactive toll map showing station clusters across Greece" width="1200" height="760" />
            </BrowserFrame>
          </div>
        </section>

        {/* Capabilities — one lead feature + supporting */}
        <section className="lp-caps">
          <article className="lp-cap-lead">
            <div className="lp-cap-lead__text">
              <span className="lp-cap-kicker"><Icon name="map" size={14} /> Interactive toll network</span>
              <h2>Every motorway toll station, on one map</h2>
              <p>
                253 stations from all eight operators, clustered on a Leaflet map, filterable by
                operator, with per-station pricing and activity. The same station data drives every
                analytics and forecast view.
              </p>
              <Button variant="ghost" size="sm" to="/map" icon="arrow-right">Open the map</Button>
            </div>
            <BrowserFrame url="tollanalysis · analytics" className="lp-cap-lead__shot">
              <img src={shotAnalytics} alt="The Traffic Analytics view with a cross-operator charges chart" width="1200" height="760" loading="lazy" />
            </BrowserFrame>
          </article>

          <div className="lp-cap-grid">
            {CAPABILITIES.map((c) => (
              <article key={c.title} className="lp-cap">
                <Icon name={c.icon} size={18} className="lp-cap__icon" />
                <h3>{c.title}</h3>
                <p>{c.text}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <span>Originally developed at NTUA (Software Engineering); prepared later as a portfolio demonstration.</span>
        <Link to="/project">Contributors &amp; details →</Link>
      </footer>
    </div>
  );
}
