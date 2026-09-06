/**
 * In-memory access token + httpOnly refresh cookie.
 * Refresh is never stored in localStorage/sessionStorage.
 */

const API_BASE = '/api';

let accessTokenMemory: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  accessTokenMemory = token;
  // Clear legacy localStorage keys from older builds
  try {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  } catch {
    /* ignore */
  }
}

export function getAccessToken() {
  return accessTokenMemory;
}

function clearSession() {
  accessTokenMemory = null;
  try {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  } catch {
    /* ignore */
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Nest --watch restarts briefly leave the proxy returning HTML/502 — retry a few times. */
async function fetchWithRetry(input: string, init?: RequestInit, attempts = 4): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(input, {
        ...init,
        credentials: init?.credentials ?? 'include',
      });
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok && (response.status === 502 || response.status === 503 || response.status === 504)) {
        if (attempt < attempts - 1) {
          await sleep(400 * (attempt + 1));
          continue;
        }
      }
      if (response.ok && contentType.includes('text/html') && input.includes('/api/')) {
        if (attempt < attempts - 1) {
          await sleep(400 * (attempt + 1));
          continue;
        }
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await sleep(400 * (attempt + 1));
        continue;
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('Cannot reach the API. Make sure the server is running on port 4000.');
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const response = await fetchWithRetry(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      clearSession();
      return null;
    }
    const data = await response.json().catch(() => ({}));
    if (!data.accessToken) {
      clearSession();
      return null;
    }
    setAccessToken(data.accessToken);
    return data.accessToken as string;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

function redirectToLogin() {
  if (window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
}

export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const exec = (token: string | null) =>
    fetchWithRetry(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
      credentials: 'include',
    });

  let token = getAccessToken();
  if (!token && endpoint !== '/auth/login' && endpoint !== '/auth/refresh') {
    token = await refreshAccessToken();
  }

  let response = await exec(token);

  if (response.status === 401 && endpoint !== '/auth/refresh' && endpoint !== '/auth/login') {
    token = await refreshAccessToken();
    if (token) {
      response = await exec(token);
    } else {
      redirectToLogin();
      throw new Error('Unauthorized');
    }
  }

  if (response.status === 401) {
    clearSession();
    redirectToLogin();
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    const nested = error?.error?.message;
    const msg = Array.isArray(error.message)
      ? error.message.join(', ')
      : nested || error.message || error.detail || `HTTP error ${response.status}`;
    throw new Error(typeof msg === 'string' ? msg : 'Request failed');
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Server returned an invalid response. Is the API running?');
  }
}

export async function logoutApi() {
  try {
    await fetchWithRetry(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}),
      },
    });
  } catch {
    /* best-effort */
  } finally {
    clearSession();
  }
}

export { API_BASE, fetchWithRetry, clearSession };
