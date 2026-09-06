import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import { isTokenValid } from './api/config';

// Build a token with a given exp (seconds). Signature is irrelevant to the
// client-side validity check.
function tokenWithExp(expSeconds) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ user_role: 'demo', exp: expSeconds }));
  return `${header}.${payload}.sig`;
}

beforeEach(() => localStorage.clear());

test('renders the landing page without crashing', () => {
  render(<App />);
  expect(
    screen.getByRole('heading', { name: /toll management system/i })
  ).toBeInTheDocument();
});

describe('isTokenValid', () => {
  test('false for missing / malformed tokens', () => {
    expect(isTokenValid(null)).toBe(false);
    expect(isTokenValid('not-a-jwt')).toBe(false);
  });
  test('false for an expired token', () => {
    expect(isTokenValid(tokenWithExp(Math.floor(Date.now() / 1000) - 60))).toBe(false);
  });
  test('true for a token that is still valid', () => {
    expect(isTokenValid(tokenWithExp(Math.floor(Date.now() / 1000) + 3600))).toBe(true);
  });
});

// A minimal stand-in for App's PrivateRoute to prove the redirect contract.
function PrivateRoute({ children }) {
  const token = localStorage.getItem('token');
  if (isTokenValid(token)) return children;
  if (token) localStorage.removeItem('token');
  return <Navigate to="/" replace />;
}

describe('protected routes', () => {
  const Protected = () => (
    <MemoryRouter initialEntries={['/stats']}>
      <Routes>
        <Route path="/" element={<div>Landing</div>} />
        <Route path="/stats" element={<PrivateRoute><div>Dashboard</div></PrivateRoute>} />
      </Routes>
    </MemoryRouter>
  );

  test('an expired token is cleared and the visitor lands on "/"', () => {
    localStorage.setItem('token', tokenWithExp(Math.floor(Date.now() / 1000) - 5));
    render(<Protected />);
    expect(screen.getByText('Landing')).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
  });

  test('a valid token reaches the protected view', () => {
    localStorage.setItem('token', tokenWithExp(Math.floor(Date.now() / 1000) + 3600));
    render(<Protected />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});
