import { useCallback, useEffect, useState } from 'react';
import { isTokenValid } from '../api/config';

function readToken() {
  try {
    return localStorage.getItem('token');
  } catch (e) {
    return null;
  }
}

export function decodeToken(token) {
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
  }
}

export function currentSession() {
  const token = readToken();
  if (!isTokenValid(token)) return { authenticated: false, role: null, email: null, isDemo: false, isAdmin: false };
  const claims = decodeToken(token) || {};
  return {
    authenticated: true,
    role: claims.user_role || null,
    email: claims.user_email || null,
    isDemo: claims.user_role === 'demo',
    isAdmin: claims.user_email === 'admin@yme.gov.gr' || claims.user_role === 'admin',
  };
}

export function clearSession() {
  try {
    localStorage.removeItem('token');
  } catch (e) {
    /* ignore */
  }
}

/**
 * Reactive session. Re-reads on mount, on `storage` events (other tabs), and
 * whenever `bump()` is called after a login/logout in this tab.
 */
export function useSession() {
  const [session, setSession] = useState(currentSession);
  const refresh = useCallback(() => setSession(currentSession()), []);

  useEffect(() => {
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);

  return { ...session, refresh };
}
