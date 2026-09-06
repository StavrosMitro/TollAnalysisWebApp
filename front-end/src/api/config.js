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
