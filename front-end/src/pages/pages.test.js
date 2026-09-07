import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../testUtils';
import OverviewPage from './OverviewPage';
import AnalyticsPage from './AnalyticsPage';
import ForecastPage from './ForecastPage';
import DebtsPage from './DebtsPage';
import ProjectPage from './ProjectPage';

beforeEach(() => {
  localStorage.setItem('token', 'x.y.z');
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => ({}) }));
});
afterEach(() => localStorage.clear());

/* ---------------- Overview ---------------- */
describe('OverviewPage', () => {
  test('renders stat cards and a chart after data loads', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ([
        { operator: 'NAO', tollId: 'NAO01', latitude: 38, longitude: 23, prices: [1] },
        { operator: 'AM', tollId: 'AM01', latitude: 40, longitude: 22, prices: [1] },
      ]) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ csv: 'Debtor,Creditor,Amount\nNO,AM,120.5' }) });
    renderWithProviders(<OverviewPage />);
    expect(await screen.findByText('Toll stations')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Suggested demo journey')).toBeInTheDocument());
  });

  test('shows an error state with retry when the API fails', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    renderWithProviders(<OverviewPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/toll data|went wrong/i);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});

/* ---------------- Analytics ---------------- */
describe('AnalyticsPage', () => {
  test('auto-runs the default analysis and shows a result with CSV export', async () => {
    global.fetch.mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ tollOpID: 'NAO', vOpList: [{ visitingOpID: 'AM', nPasses: 13, passesCost: 32.5 }] }),
    });
    renderWithProviders(<AnalyticsPage />);
    expect(await screen.findByText(/Charges by visiting operator/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /csv/i })).toBeInTheDocument();
  });

  test('shows a no-data state on 204', async () => {
    global.fetch.mockResolvedValue({ ok: true, status: 204, json: async () => ({}) });
    renderWithProviders(<AnalyticsPage />);
    expect(await screen.findByText(/No results/i)).toBeInTheDocument();
  });

  test('shows an error state and a retry on failure', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'boom' }) });
    renderWithProviders(<AnalyticsPage />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});

/* ---------------- Forecast ---------------- */
describe('ForecastPage', () => {
  test('shows the educational-limitation note prominently', () => {
    renderWithProviders(<ForecastPage />);
    expect(screen.getByText(/educational model/i)).toBeInTheDocument();
    expect(screen.getByText(/not production-grade/i)).toBeInTheDocument();
  });

  test('volume forecast auto-runs and shows a result summary', async () => {
    global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ predictions: [1.2, 3.4, 2.1] }) });
    renderWithProviders(<ForecastPage />);
    expect(await screen.findByText(/Total forecast passages/i)).toBeInTheDocument();
  });

  test('peak-hour: explains the fractional-hour rounding', async () => {
    renderWithProviders(<ForecastPage />);
    global.fetch.mockResolvedValue({
      ok: true, status: 200,
      json: async () => ([{ passage_date: '2022-01-10 00:00:00', predicted_hour: 14.26 }]),
    });
    await userEvent.click(screen.getByRole('button', { name: /^predict$/i }));
    expect(await screen.findByText(/rounded to the nearest whole hour/i)).toBeInTheDocument();
  });
});

/* ---------------- Debts (demo-safe) ---------------- */
describe('DebtsPage', () => {
  test('is read-only: no mutation / cancel control is rendered', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ figures: { figure1: 'data:image/png;base64,AAA', figure2: 'data:image/png;base64,BBB' }, csv: 'Debtor,Creditor,Amount\nNO,AM,120.50\nEG,OO,45.00' }),
    });
    renderWithProviders(<DebtsPage />);
    expect(await screen.findByText(/Settlement instructions/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel debts|reset|optimi[sz]e|run/i })).not.toBeInTheDocument();
    expect(screen.getByText(/this page is read-only/i)).toBeInTheDocument();
  });
});

/* ---------------- Project ---------------- */
describe('ProjectPage', () => {
  test('attributes the original team and Stavros without over-claiming', () => {
    renderWithProviders(<ProjectPage />);
    ['Dimitris Thivaios', 'Dimitris Liakis', 'Vassilis Anastasiadis'].forEach((n) =>
      expect(screen.getByText(n)).toBeInTheDocument()
    );
    expect(screen.getByText(/REST API \/ backend development/i)).toBeInTheDocument();
    expect(screen.getByText(/not every feature was implemented by\s+one person/i)).toBeInTheDocument();
    expect(screen.getByText(/NTUA/i)).toBeInTheDocument();
    expect(screen.getByText(/educational demonstration/i)).toBeInTheDocument();
  });
});
