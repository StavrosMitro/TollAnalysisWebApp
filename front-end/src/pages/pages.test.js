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
  test('frames the feature as a replaceable integration, not a predictor', () => {
    renderWithProviders(<ForecastPage />);
    expect(screen.getByText(/integration demo/i)).toBeInTheDocument();
    expect(screen.getByText(/complete, replaceable ML integration/i)).toBeInTheDocument();
    expect(screen.getByText(/sanity checks/i)).toBeInTheDocument();
    expect(screen.getByText(/replacement bundle/i)).toBeInTheDocument();
  });

  test('volume forecast auto-runs and shows the held-out result + sanity-check baseline', async () => {
    global.fetch.mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        empty: false,
        predictions: [1.2, 3.4, 2.1],
        stations: [
          { tollID: 'NAO01', predicted_passages: 1.2 },
          { tollID: 'NAO02', predicted_passages: 3.4 },
          { tollID: 'NAO03', predicted_passages: 2.1 },
        ],
        model: {
          artifact_version: 'v2',
          train_date_range: { min: '2021-12-31', max: '2022-01-10' },
          provenance: { code_sha256: 'abcdef1234567890', data_sha256: {} },
        },
        evaluation: { test_mae: 0.3, test_rmse: 0.5, sanity_check_baseline: { name: 'per_station_mean', test_mae: 0.28 } },
        date_context: { extrapolation: false },
      }),
    });
    renderWithProviders(<ForecastPage />);
    expect(await screen.findByText(/Total forecast passages/i)).toBeInTheDocument();
    expect(await screen.findByText(/held-out test mae/i)).toBeInTheDocument();
    expect(screen.getByText(/a "per_station_mean" scores MAE 0\.28/i)).toBeInTheDocument();
  });

  test('peak-hour: integer hour, circular note, and an extrapolation warning for far dates', async () => {
    renderWithProviders(<ForecastPage />);
    global.fetch.mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        empty: false,
        predictions: [{ passage_date: '2025-06-01', company: 'NAO', predicted_hour: 14 }],
        model: { artifact_version: 'v2' },
        evaluation: { exact_hour_accuracy: 0, within_1_hour_accuracy: 0, mean_circular_abs_error_hours: 5, sanity_check_baseline: { name: 'global_peak_hour_mode' } },
        date_context: { extrapolation: true, dates_outside_observed_window: ['2025-06-01'] },
      }),
    });
    await userEvent.click(screen.getByRole('button', { name: /^predict$/i }));
    expect(await screen.findByText(/highest predicted passage volume/i)).toBeInTheDocument();
    expect(screen.getByText(/within one hour/i)).toBeInTheDocument();
    expect(screen.getByText(/unvalidated extrapolation/i)).toBeInTheDocument();
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
    expect(screen.getByText(/integration demonstration/i)).toBeInTheDocument();
  });
});
