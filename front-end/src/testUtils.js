/* Shared helpers for component tests. */
import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from './components/ui';

export function renderWithProviders(ui, { route = '/', ...options } = {}) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </ToastProvider>,
    options
  );
}

export function makeToken({ role = 'demo', email = 'demo@toll-analysis.example', ttlSeconds = 3600 } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => btoa(JSON.stringify(o));
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ user_role: role, user_email: email, iat: now, exp: now + ttlSeconds })}.sig`;
}

export function mockFetchSequence(responses) {
  const queue = [...responses];
  global.fetch = jest.fn(() => {
    const next = queue.shift() || { ok: true, status: 200, json: async () => ({}) };
    return Promise.resolve({
      ok: next.ok !== false,
      status: next.status || (next.ok === false ? 500 : 200),
      json: async () => (typeof next.json === 'function' ? next.json() : next.json ?? {}),
      text: async () => next.text || '',
    });
  });
  return global.fetch;
}
