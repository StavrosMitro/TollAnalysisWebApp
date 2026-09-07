import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from './components/ui';
import { AppRoutes } from './App';
import { isTokenValid } from './api/config';
import { makeToken } from './testUtils';

function renderAt(route) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[route]}><AppRoutes /></MemoryRouter>
    </ToastProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => [] }));
});

test('renders the landing page at "/"', () => {
  renderAt('/');
  expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /explore live demo/i })).toBeInTheDocument();
});

test('a protected route without a token redirects to the landing page', () => {
  renderAt('/analytics');
  expect(screen.getByRole('button', { name: /explore live demo/i })).toBeInTheDocument();
});

test('an expired token on a protected route is cleared and redirects home', () => {
  localStorage.setItem('token', makeToken({ ttlSeconds: -60 }));
  renderAt('/overview');
  expect(localStorage.getItem('token')).toBeNull();
  expect(screen.getByRole('button', { name: /explore live demo/i })).toBeInTheDocument();
});

test('legacy /stats route does not crash and lands on a valid page', () => {
  renderAt('/stats');
  expect(screen.getByRole('button', { name: /explore live demo/i })).toBeInTheDocument();
});

describe('isTokenValid', () => {
  test('false for missing / malformed', () => {
    expect(isTokenValid(null)).toBe(false);
    expect(isTokenValid('nope')).toBe(false);
  });
  test('false for expired, true for valid', () => {
    expect(isTokenValid(makeToken({ ttlSeconds: -30 }))).toBe(false);
    expect(isTokenValid(makeToken({ ttlSeconds: 3600 }))).toBe(true);
  });
});
