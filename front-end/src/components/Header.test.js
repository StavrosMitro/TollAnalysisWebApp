import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Header from './Header';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

beforeEach(() => {
  localStorage.clear();
  mockNavigate.mockReset();
  global.fetch = jest.fn();
  jest.spyOn(window, 'alert').mockImplementation(() => {});
});
afterEach(() => window.alert.mockRestore());

test('logout clears the token, flips state, and returns to "/"', async () => {
  localStorage.setItem('token', 'demo.jwt.token');
  const setIsLoggedIn = jest.fn();
  global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Logout Successful' }) });

  render(
    <MemoryRouter>
      <Header isLoggedIn setIsLoggedIn={setIsLoggedIn} />
    </MemoryRouter>
  );

  await userEvent.click(screen.getByRole('button', { name: /logout/i }));

  await waitFor(() => expect(localStorage.getItem('token')).toBeNull());
  expect(setIsLoggedIn).toHaveBeenCalledWith(false);
  expect(mockNavigate).toHaveBeenCalledWith('/');
  expect(global.fetch.mock.calls[0][0]).toMatch(/\/logout$/);
});

test('when logged out, the nav shows Login and hides the dashboards', () => {
  render(
    <MemoryRouter>
      <Header isLoggedIn={false} setIsLoggedIn={jest.fn()} />
    </MemoryRouter>
  );
  expect(screen.getByRole('link', { name: /login/i })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /logout/i })).not.toBeInTheDocument();
});
