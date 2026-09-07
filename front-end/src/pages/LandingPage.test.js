import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LandingPage from './LandingPage';
import { renderWithProviders } from '../testUtils';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

beforeEach(() => {
  localStorage.clear();
  mockNavigate.mockReset();
  global.fetch = jest.fn();
});

test('communicates the product: headline, value proposition, capabilities, demo CTA', () => {
  renderWithProviders(<LandingPage />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/toll network|analytics/i);
  expect(screen.getByRole('button', { name: /explore live demo/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /view project/i })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /every motorway toll station/i })).toBeInTheDocument();
  ['Traffic Analytics', 'Traffic Forecasting', 'Debt Optimization'].forEach((c) => {
    expect(screen.getByRole('heading', { name: c })).toBeInTheDocument();
  });
  expect(screen.getByText(/educational sample dataset/i)).toBeInTheDocument();
});

test('does not show any username or password on the landing page', () => {
  renderWithProviders(<LandingPage />);
  expect(screen.queryByText(/yme123|password|username/i)).not.toBeInTheDocument();
});

test('demo login: success stores the token and enters the overview', async () => {
  global.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ token: 'demo.jwt.tok', role: 'demo' }) });
  renderWithProviders(<LandingPage />);
  await userEvent.click(screen.getByRole('button', { name: /explore live demo/i }));
  await waitFor(() => expect(localStorage.getItem('token')).toBe('demo.jwt.tok'));
  expect(mockNavigate).toHaveBeenCalledWith('/overview');
  expect(global.fetch.mock.calls[0][0]).toMatch(/\/auth\/demo-login$/);
});

test('demo login: error shows a recoverable message and does not navigate', async () => {
  global.fetch.mockResolvedValueOnce({
    ok: false, status: 503,
    json: async () => ({ error: { code: 'DEMO_UNAVAILABLE', message: 'The public demo is not available right now.' } }),
  });
  renderWithProviders(<LandingPage />);
  await userEvent.click(screen.getByRole('button', { name: /explore live demo/i }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/not available/i);
  expect(localStorage.getItem('token')).toBeNull();
  expect(mockNavigate).not.toHaveBeenCalled();
});

test('demo button is disabled while the request is in flight', async () => {
  let resolve;
  global.fetch.mockImplementationOnce(() => new Promise((r) => { resolve = () => r({ ok: true, status: 200, json: async () => ({ token: 't' }) }); }));
  renderWithProviders(<LandingPage />);
  const btn = screen.getByRole('button', { name: /explore live demo/i });
  await userEvent.click(btn);
  expect(btn).toBeDisabled();
  resolve();
  await waitFor(() => expect(localStorage.getItem('token')).toBe('t'));
});
