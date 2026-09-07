import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './LoginPage.css';
import { apiUrl, requestDemoSession } from '../api/config';
import { Icon, Button, Field, Alert, BrandMark, useToast } from '../components/ui';
import BrowserFrame from '../components/BrowserFrame';
import shotMap from '../assets/shot-map.webp';
import motorway from '../assets/motorway-egnatia-1600.webp';
import motorwaySm from '../assets/motorway-egnatia-800.webp';

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FACTS = ['8 toll operators', '253 toll stations', 'Analytics · forecasting · debt netting'];

export default function LoginPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const validate = () => {
    const e = {};
    if (!email) e.email = 'Enter your email.';
    else if (!emailRe.test(email)) e.email = 'Enter a valid email address.';
    if (!password) e.password = 'Enter your password.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setFormError('');
    if (!validate() || loading) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_email: email, user_password: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.token) {
        localStorage.setItem('token', data.token);
        toast.success('Signed in.');
        navigate('/overview');
        return;
      }
      if (res.status === 429) setFormError('Too many attempts. Please wait a few minutes and try again.');
      else if (res.status === 401 || res.status === 404) setFormError('Email or password is incorrect.');
      else setFormError((data && data.error && (data.error.message || data.error)) || 'Sign in failed. Please try again.');
    } catch (e) {
      setFormError('Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const startDemo = async () => {
    if (demoLoading) return;
    setDemoLoading(true);
    setFormError('');
    try {
      const token = await requestDemoSession();
      localStorage.setItem('token', token);
      navigate('/overview');
    } catch (err) {
      setFormError(err.message);
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="lgx">
      <section className="lgx__visual">
        <img
          className="lgx__photo"
          src={motorway}
          srcSet={`${motorwaySm} 800w, ${motorway} 1600w`}
          sizes="(max-width: 879px) 100vw, 56vw"
          alt=""
          aria-hidden="true"
        />
        <div className="lgx__scrim" aria-hidden="true" />
        <div className="lgx__visual-inner">
          <Link to="/" className="lgx__brand">
            <BrandMark badge size={30} /> TollAnalysis
          </Link>
          <p className="lgx__visual-line">
            Interoperable analysis of Greece&rsquo;s motorway toll network — one record of passages
            across eight operators, with traffic analytics, forecasting and debt settlement.
          </p>
          <ul className="lgx__facts">
            {FACTS.map((f) => <li key={f}>{f}</li>)}
          </ul>
          <BrowserFrame url="tollanalysis · toll map" className="lgx__shot">
            <img src={shotMap} alt="The TollAnalysis toll map" width="1200" height="760" />
          </BrowserFrame>
        </div>
      </section>

      <section className="lgx__panel">
        <div className="lgx__panel-inner">
          <Link to="/" className="lgx__panel-brand">
            <BrandMark badge size={26} /> TollAnalysis
          </Link>

          <h1 className="lgx__title">Operator sign in</h1>
          <p className="lgx__sub">For operator and administrator accounts.</p>

          {formError && <div className="lgx__alert"><Alert variant="danger">{formError}</Alert></div>}

          <form className="lgx__form" onSubmit={submit} noValidate>
            <Field label="Email" error={errors.email}>
              <input
                className="ui-input"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </Field>
            <Field label="Password" error={errors.password}>
              <input
                className="ui-input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </Field>
            <Button type="submit" block loading={loading}>{loading ? 'Signing in…' : 'Sign in'}</Button>
          </form>

          <div className="lgx__demo">
            <div className="lgx__demo-head">
              <h2>Just exploring?</h2>
              <p>No account needed — open a read-only session on the sample dataset.</p>
            </div>
            <Button variant="accent" block icon="arrow-right" loading={demoLoading} onClick={startDemo}>
              {demoLoading ? 'Starting demo…' : 'Explore the live demo'}
            </Button>
          </div>

          <Link to="/" className="lgx__back">
            <Icon name="chevron-right" size={14} style={{ transform: 'rotate(180deg)' }} /> Back to home
          </Link>
        </div>
      </section>
    </div>
  );
}
