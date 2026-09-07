import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/ui';
import AppShell from './components/AppShell';
import { isTokenValid, clearInvalidToken } from './api/config';

import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import OverviewPage from './pages/OverviewPage';
import MapPage from './pages/MapPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ForecastPage from './pages/ForecastPage';
import DebtsPage from './pages/DebtsPage';
import ProjectPage from './pages/ProjectPage';

function RequireAuth({ children }) {
  const location = useLocation();
  const token = (() => {
    try { return localStorage.getItem('token'); } catch (e) { return null; }
  })();

  if (isTokenValid(token)) return children;
  const expired = Boolean(token);
  clearInvalidToken();
  return <Navigate to="/" replace state={{ from: location.pathname, expired }} />;
}

const Shell = ({ children, ...props }) => <AppShell {...props}>{children}</AppShell>;

export function AppRoutes() {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />

        <Route path="/map" element={<Shell flush><MapPage /></Shell>} />
        <Route path="/project" element={<Shell><ProjectPage /></Shell>} />

        <Route path="/overview" element={<RequireAuth><Shell><OverviewPage /></Shell></RequireAuth>} />
        <Route path="/analytics" element={<RequireAuth><Shell><AnalyticsPage /></Shell></RequireAuth>} />
        <Route path="/forecast" element={<RequireAuth><Shell><ForecastPage /></Shell></RequireAuth>} />
        <Route path="/debts" element={<RequireAuth><Shell><DebtsPage /></Shell></RequireAuth>} />

        {/* Legacy route aliases */}
        <Route path="/stats" element={<Navigate to="/analytics" replace />} />
        <Route path="/machine" element={<Navigate to="/forecast" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Router>
        <AppRoutes />
      </Router>
    </ToastProvider>
  );
}
