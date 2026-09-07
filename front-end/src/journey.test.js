/**
 * End-to-end visitor journey (jsdom). Renders the whole <App/> and walks the
 * route a first-time visitor takes, waiting on observable UI/network state at
 * every step - no fixed delays. Leaflet is mocked (it needs real layout).
 */
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

jest.mock('leaflet', () => {
  const chain = () => stub;
  const stub = {
    setView: chain, addTo: chain, addLayer: chain, removeLayer: chain,
    remove: chain, on: chain, fitBounds: chain, invalidateSize: chain,
    clearLayers: chain, closePopup: chain,
  };
  return {
    __esModule: true,
    default: {
      map: () => stub,
      tileLayer: () => stub,
      control: { zoom: () => stub },
      markerClusterGroup: () => stub,
      marker: () => stub,
      divIcon: () => ({}),
      latLngBounds: () => ({ pad: () => ({}) }),
      Icon: { Default: { prototype: {}, mergeOptions: () => {} } },
    },
  };
});
jest.mock('leaflet.markercluster', () => ({}));
jest.mock('leaflet/dist/leaflet.css', () => ({}), { virtual: true });
jest.mock('leaflet.markercluster/dist/MarkerCluster.css', () => ({}), { virtual: true });
jest.mock('leaflet.markercluster/dist/MarkerCluster.Default.css', () => ({}), { virtual: true });

const TOLLS = [
  { operator: 'aegeanmotorway', tollId: 'AM01', name: 'x', latitude: 40.5, longitude: 22.5, email: 'a@b.example', prices: ['1.40'] },
  { operator: 'naodos', tollId: 'NAO01', name: 'y', latitude: 38, longitude: 23, email: 'c@d.example', prices: ['2.80'] },
];

function routeFetch(url, opts) {
  const u = String(url);
  const json = (body, status = 200) =>
    Promise.resolve({ ok: status < 400, status, json: async () => body, text: async () => '' });
  if (u.endsWith('/auth/demo-login')) return json({ token: makeDemoToken(), role: 'demo', expiresIn: '90m' });
  if (u.endsWith('/api/tolls')) return json(TOLLS);
  if (u.includes('/get_debts_optimization')) return json({
    figures: { figure1: 'data:image/png;base64,AAA', figure2: 'data:image/png;base64,BBB' },
    csv: 'Debtor,Creditor,Amount\nNO,AM,120.50\nEG,OO,38.35',
  });
  if (u.includes('/chargesBy/')) return json({ tollOpID: 'NAO', vOpList: [{ visitingOpID: 'AM', nPasses: 13, passesCost: 32.5 }] });
  if (u.includes('/forecast/')) return json({
    empty: false,
    predictions: [1.2, 3.5, 2.1],
    stations: [
      { tollID: 'NAO01', predicted_passages: 1.2, station_seen_in_training: true },
      { tollID: 'NAO02', predicted_passages: 3.5, station_seen_in_training: true },
      { tollID: 'NAO03', predicted_passages: 2.1, station_seen_in_training: true },
    ],
    model: { artifact_version: 'v2', train_date_range: { min: '2021-12-31', max: '2022-01-10' }, provenance: { code_sha256: 'deadbeef00000000', data_sha256: {} } },
    evaluation: { test_mae: 0.3, test_rmse: 0.5, sanity_check_baseline: { name: 'per_station_mean', test_mae: 0.28 } },
    date_context: { extrapolation: false },
  });
  if (u.includes('/peak_hour/')) return json({
    empty: false,
    predictions: [{ passage_date: '2022-01-13', company: 'NAO', predicted_hour: 14 }],
    model: { artifact_version: 'v2' },
    evaluation: { exact_hour_accuracy: 0, within_1_hour_accuracy: 0, mean_circular_abs_error_hours: 5, sanity_check_baseline: { name: 'global_peak_hour_mode' } },
    date_context: { extrapolation: false },
  });
  if (u.endsWith('/logout')) return json({ message: 'Logout Successful' });
  return json({}, 200);
}

function makeDemoToken() {
  const now = Math.floor(Date.now() / 1000);
  const b = (o) => btoa(JSON.stringify(o));
  return `${b({ alg: 'HS256' })}.${b({ user_role: 'demo', user_email: 'demo@toll-analysis.example', iat: now, exp: now + 5400 })}.s`;
}

beforeEach(() => {
  window.history.pushState({}, '', '/');
  localStorage.clear();
  global.fetch = jest.fn(routeFetch);
});

test('visitor: landing -> demo -> overview -> map -> analytics -> forecast -> debts -> project -> sign out', async () => {

  render(<App />);

  // 1. Landing
  expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();

  // 2. Enter the live demo
  await userEvent.click(screen.getByRole('button', { name: /explore live demo/i }));

  // 3. Overview
  expect(await screen.findByRole('heading', { name: /^overview$/i })).toBeInTheDocument();
  await screen.findByText(/Suggested demo journey/i);
  // The demo state is shown compactly in the app shell, not as a per-page banner.
  expect(screen.getByText(/demo visitor/i)).toBeInTheDocument();

  const mainNav = () => screen.getByRole('navigation', { name: /main/i });

  // 4. Toll Map
  await userEvent.click(within(mainNav()).getByRole('link', { name: /toll map/i }));
  expect(await screen.findByRole('heading', { name: /toll map/i })).toBeInTheDocument();

  // 5. Traffic Analytics (auto-runs the default analysis)
  await userEvent.click(within(mainNav()).getByRole('link', { name: /traffic analytics/i }));
  await screen.findByRole('heading', { name: /traffic analytics/i });
  expect(await screen.findByText(/Charges by visiting operator/i, {}, { timeout: 4000 })).toBeInTheDocument();

  // 6. Traffic Forecast (volume forecast auto-runs on mount)
  await userEvent.click(within(mainNav()).getByRole('link', { name: /traffic forecast/i }));
  expect(await screen.findByText(/integration demo/i)).toBeInTheDocument();
  expect(await screen.findByText(/Total forecast passages/i)).toBeInTheDocument();

  // 7. Debt Optimization (read-only)
  await userEvent.click(within(mainNav()).getByRole('link', { name: /debt optimization/i }));
  expect(await screen.findByText(/Settlement instructions/i)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /cancel debts/i })).not.toBeInTheDocument();

  // 8. Project
  await userEvent.click(within(mainNav()).getByRole('link', { name: /^project$/i }));
  expect(await screen.findByText(/Dimitris Thivaios/i)).toBeInTheDocument();

  // 9. Sign out -> back to landing, token cleared
  await userEvent.click(screen.getByRole('button', { name: /sign out/i }));
  await waitFor(() => expect(localStorage.getItem('token')).toBeNull());
  expect(await screen.findByRole('button', { name: /explore live demo/i })).toBeInTheDocument();
});
