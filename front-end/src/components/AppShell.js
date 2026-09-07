import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import './AppShell.css';
import { Icon, BrandMark, Button, useToast } from './ui';
import { apiUrl } from '../api/config';
import { useSession, clearSession } from '../lib/session';

const NAV = [
  { to: '/overview', label: 'Overview', icon: 'layers', auth: true },
  { to: '/map', label: 'Toll Map', icon: 'map', auth: false },
  { to: '/analytics', label: 'Traffic Analytics', icon: 'bar-chart', auth: true },
  { to: '/forecast', label: 'Traffic Forecast', icon: 'trending-up', auth: true },
  { to: '/debts', label: 'Debt Optimization', icon: 'network', auth: true },
  { to: '/project', label: 'Project', icon: 'info', auth: false },
];

function Brand({ compact }) {
  return (
    <div className="shell__brand">
      <BrandMark badge size={compact ? 26 : 30} />
      <span>TollAnalysis</span>
    </div>
  );
}

export default function AppShell({ children, wide = false, flush = false }) {
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const firstLinkRef = useRef(null);

  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setDrawerOpen(false);
    document.addEventListener('keydown', onKey);
    firstLinkRef.current && firstLinkRef.current.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const signOut = async () => {
    const token = localStorage.getItem('token');
    try {
      if (token) {
        await fetch(apiUrl('/logout'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-observatory-auth': token },
        });
      }
    } catch (e) {
      /* best-effort */
    }
    clearSession();
    session.refresh();
    toast.info('You have been signed out.');
    navigate('/');
  };

  const visibleNav = NAV.filter((n) => !n.auth || session.authenticated);

  const nav = (
    <nav className="shell__nav" aria-label="Main">
      {visibleNav.map((n, i) => (
        <NavLink
          key={n.to}
          to={n.to}
          ref={i === 0 ? firstLinkRef : undefined}
          className={({ isActive }) => `shell__link${isActive ? ' is-active' : ''}`}
        >
          <Icon name={n.icon} size={16} className="shell__link-icon" />
          <span>{n.label}</span>
        </NavLink>
      ))}
    </nav>
  );

  const footer = (
    <div className="shell__footer">
      {session.authenticated ? (
        <>
          <div className="shell__user">
            <div className="shell__user-name">
              {session.isDemo && <span className="shell__demo-dot" aria-hidden="true" />}
              {session.isDemo ? 'Demo visitor' : session.email || 'Signed in'}
            </div>
            <div className="shell__user-role">
              {session.isDemo ? 'Read-only · sample data' : session.role}
            </div>
          </div>
          <button type="button" className="shell__signout" onClick={signOut}>
            <Icon name="log-out" size={15} /> Sign out
          </button>
        </>
      ) : (
        <>
          <Button variant="accent" size="sm" icon="arrow-right" onClick={() => navigate('/')}>
            Explore Live Demo
          </Button>
          <button type="button" className="shell__signout" onClick={() => navigate('/login')}>
            Operator sign in
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className="shell">
      <a href="#main-content" className="skip-link">Skip to main content</a>

      <header className="shell__topbar">
        <Brand compact />
        <button
          type="button"
          className="shell__burger"
          aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen((v) => !v)}
        >
          <Icon name={drawerOpen ? 'x' : 'menu'} size={22} />
        </button>
      </header>

      {drawerOpen && <div className="shell__drawer-backdrop" onClick={() => setDrawerOpen(false)} />}

      <aside className={`shell__sidebar${drawerOpen ? ' is-open' : ''}`}>
        <Brand />
        {nav}
        {footer}
      </aside>

      <div className="shell__main">
        <main
          id="main-content"
          className={`shell__content${wide ? ' shell__content--wide' : ''}${flush ? ' shell__content--flush' : ''}`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
