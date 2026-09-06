import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import WelcomePage from './WelcomePage';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

function renderPage(props = {}) {
  return render(
    <MemoryRouter>
      <WelcomePage setIsLoggedIn={jest.fn()} {...props} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  mockNavigate.mockReset();
  global.fetch = jest.fn();
});

test('shows the Explore Live Demo action', () => {
  renderPage();
  expect(screen.getByRole('button', { name: /explore live demo/i })).toBeInTheDocument();
});

test('successful demo login stores the token and enters the app', async () => {
  const setIsLoggedIn = jest.fn();
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ token: 'demo.jwt.token', role: 'demo', expiresIn: '90m' }),
  });

  renderPage({ setIsLoggedIn });
  await userEvent.click(screen.getByRole('button', { name: /explore live demo/i }));

  await waitFor(() => expect(localStorage.getItem('token')).toBe('demo.jwt.token'));
  expect(setIsLoggedIn).toHaveBeenCalledWith(true);
  expect(mockNavigate).toHaveBeenCalledWith('/stats');
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch.mock.calls[0][0]).toMatch(/\/auth\/demo-login$/);
});

test('shows an error and does not navigate when demo login fails', async () => {
  global.fetch.mockResolvedValueOnce({
    ok: false,
    status: 503,
    json: async () => ({ error: { code: 'DEMO_UNAVAILABLE', message: 'The public demo is not available right now.' } }),
  });

  renderPage();
  await userEvent.click(screen.getByRole('button', { name: /explore live demo/i }));

  expect(await screen.findByRole('alert')).toHaveTextContent(/not available/i);
  expect(localStorage.getItem('token')).toBeNull();
  expect(mockNavigate).not.toHaveBeenCalled();
});

test('button is disabled while the request is in flight (no double submit)', async () => {
  let resolveFetch;
  global.fetch.mockImplementationOnce(
    () => new Promise((r) => { resolveFetch = () => r({ ok: true, json: async () => ({ token: 't' }) }); })
  );

  renderPage();
  const btn = screen.getByRole('button', { name: /explore live demo/i });
  await userEvent.click(btn);

  expect(btn).toBeDisabled();
  expect(btn).toHaveTextContent(/starting demo/i);

  resolveFetch();
  await waitFor(() => expect(localStorage.getItem('token')).toBe('t'));
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
