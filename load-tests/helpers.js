import http from 'k6/http';
import { check } from 'k6';
import { API, USERS } from './config.js';

// RBAC soft misses (403) and empty resources must not fail the run;
// only network errors and 5xx should count as http_req_failed.
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 499 }));

export function jsonHeaders(token) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * Login and return accessToken. Fails the VU iteration if login fails.
 */
export function login(role = 'doctor') {
  const creds = USERS[role] || USERS.doctor;
  const res = http.post(
    `${API}/auth/login`,
    JSON.stringify({ email: creds.email, password: creds.password }),
    { headers: jsonHeaders(), tags: { name: 'auth_login', role } },
  );

  const ok = check(res, {
    'login status 200': (r) => r.status === 200,
    'login has accessToken': (r) => {
      try {
        return Boolean(r.json('accessToken'));
      } catch {
        return false;
      }
    },
  });

  if (!ok) {
    return null;
  }
  return res.json('accessToken');
}

/** Login all clinic roles once (for setup()). */
export function loginAllRoles() {
  const tokens = {};
  for (const role of Object.keys(USERS)) {
    tokens[role] = login(role);
  }
  return tokens;
}

export function get(path, token, tag) {
  return http.get(`${API}${path}`, {
    headers: jsonHeaders(token),
    tags: { name: tag || path },
  });
}

export function expectOk(res, label) {
  return check(res, {
    [`${label} status 2xx`]: (r) => r.status >= 200 && r.status < 300,
  });
}
