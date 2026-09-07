// Central API configuration.
//
// Production: the React build is served by the backend on the SAME origin, so
// the API lives at "/api" and no host needs to be configured.
//
// Local non-container development: set REACT_APP_API_BASE_URL (see
// front-end/.env.example), e.g. http://localhost:9115/api, because the CRA dev
// server (:3000) and the backend (:9115) are different origins.
//
// No component should ever hard-code an API origin - import from here instead.

const RAW_BASE_URL = process.env.REACT_APP_API_BASE_URL;

export const API_BASE_URL =
  RAW_BASE_URL && RAW_BASE_URL.trim()
    ? RAW_BASE_URL.trim().replace(/\/+$/, '')
    : '/api';

/**
 * Build a full API URL from a path fragment.
 *   apiUrl('/login')            -> '/api/login'
 *   apiUrl('tolls')             -> '/api/tolls'
 */
export function apiUrl(path = '') {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${suffix}`;
}

/**
 * Auth header for the custom scheme this API uses. Returns {} when there is no
 * token so it can always be spread into a headers object.
 */
export function authHeaders() {
  let token = null;
  try {
    token = localStorage.getItem('token');
  } catch (e) {
    token = null;
  }
  return token ? { 'x-observatory-auth': token } : {};
}

/**
 * True if `token` is a JWT that is present and not expired. Used to keep an
 * expired session (e.g. an expired demo token) from reaching protected routes.
 */
export function isTokenValid(token) {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return !payload.exp || payload.exp * 1000 > Date.now();
  } catch (e) {
    return false;
  }
}

/** Remove a stored token (used when it is missing/expired/invalid). */
export function clearInvalidToken() {
  try {
    localStorage.removeItem('token');
  } catch (e) {
    /* ignore */
  }
}

/**
 * Start a public demo session. No credentials. Resolves to the short-lived
 * demo token or throws with a user-facing message.
 */
export async function requestDemoSession() {
  let res;
  try {
    res = await fetch(apiUrl('/auth/demo-login'), { method: 'POST' });
  } catch (e) {
    throw new Error('Could not reach the server. Please try again.');
  }
  let body = {};
  try {
    body = await res.json();
  } catch (e) {
    /* ignore */
  }
  if (!res.ok || !body.token) {
    const msg =
      (body.error && body.error.message) ||
      (res.status === 429
        ? 'Too many demo sessions from your network. Please wait a few minutes.'
        : 'The live demo is unavailable right now. Please try again later.');
    throw new Error(msg);
  }
  return body.token;
}
