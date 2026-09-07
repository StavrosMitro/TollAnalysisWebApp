import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppShell from './AppShell';
import { renderWithProviders, makeToken } from '../testUtils';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

beforeEach(() => {
  localStorage.clear();
  mockNavigate.mockReset();
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => ({}) }));
});

function renderShell() {
  return renderWithProviders(<AppShell><h1>Page</h1></AppShell>);
}

test('anonymous: shows public nav + demo CTA, hides protected items', () => {
  renderShell();
  expect(screen.getByRole('link', { name: /toll map/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /project/i })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /traffic analytics/i })).not.toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /explore live demo/i }).length).toBeGreaterThan(0);
});

test('demo session: shows all nav, a demo indicator, and a sign-out control', () => {
  localStorage.setItem('token', makeToken({ role: 'demo' }));
  renderShell();
  expect(screen.getByRole('link', { name: /overview/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /traffic forecast/i })).toBeInTheDocument();
  expect(screen.getByText(/demo visitor/i)).toBeInTheDocument();
  expect(screen.getByText(/read-only . sample data/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
});

test('sign out clears the token and navigates home', async () => {
  localStorage.setItem('token', makeToken({ role: 'demo' }));
  renderShell();
  await userEvent.click(screen.getByRole('button', { name: /sign out/i }));
  await waitFor(() => expect(localStorage.getItem('token')).toBeNull());
  expect(mockNavigate).toHaveBeenCalledWith('/');
});

test('mobile menu toggle exposes an expanded state and can be opened/closed', async () => {
  renderShell();
  const burger = screen.getByRole('button', { name: /open menu/i });
  expect(burger).toHaveAttribute('aria-expanded', 'false');
  await userEvent.click(burger);
  expect(screen.getByRole('button', { name: /close menu/i })).toHaveAttribute('aria-expanded', 'true');
});
