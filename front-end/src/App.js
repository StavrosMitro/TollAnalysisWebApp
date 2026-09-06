import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import WelcomePage from './pages/WelcomePage';
import MapPage from './pages/MapPage';
import DebtsPage from './pages/DebtsPage';
import StatsDashboard from './pages/StatsDashboard';
import MachineLearning from './pages/MachineLearning';
import LoginPage from './pages/LoginPage';
import { isTokenValid } from './api/config';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => isTokenValid(localStorage.getItem('token')));

  // Keep login state in sync with the stored token (covers demo login, logout,
  // and an expired token that another tab cleared).
  useEffect(() => {
    const sync = () => setIsLoggedIn(isTokenValid(localStorage.getItem('token')));
    sync();
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  // Protected routes require a present, non-expired token. An expired token is
  // cleared and the visitor is sent to the landing page.
  const PrivateRoute = ({ children }) => {
    const token = localStorage.getItem('token');
    if (isTokenValid(token)) return children;
    if (token) {
      localStorage.removeItem('token');
    }
    return <Navigate to="/" replace />;
  };

  return (
    <Router>
      <div className="App">
        <Header isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn} />
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<WelcomePage isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn} />} />
          <Route path="/map" element={<MapPage />} />

          {/* Protected Routes */}
          <Route
            path="/stats"
            element={
              <PrivateRoute>
                <StatsDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/debts"
            element={
              <PrivateRoute>
                <DebtsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/machine"
            element={
              <PrivateRoute>
                <MachineLearning />
              </PrivateRoute>
            }
          />

          {/* Login Route */}
          <Route path="/login" element={<LoginPage setIsLoggedIn={setIsLoggedIn} />} />

          {/* Redirect all unknown routes */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
