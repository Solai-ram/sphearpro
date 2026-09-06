/**
 * Login storm — many concurrent authentications (Argon2 + JWT + audit).
 * Heavier on CPU than browse; use a smaller VU count by default.
 *
 *   k6 run load-tests/login-storm.js
 *   k6 run -e VUS=100 -e DURATION=1m load-tests/login-storm.js
 */

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate } from 'k6/metrics';
import { API, USERS } from './config.js';
import { jsonHeaders } from './helpers.js';

http.setResponseCallback(http.expectedStatuses(200));

const loginFail = new Rate('login_failures');

const roles = Object.keys(USERS);

export const options = {
  stages: [
    { duration: '15s', target: Number(__ENV.VUS || 50) },
    { duration: __ENV.DURATION || '45s', target: Number(__ENV.VUS || 50) },
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.1'],
    http_req_duration: ['p(95)<3000'],
    login_failures: ['rate<0.05'],
    checks: ['rate>0.9'],
  },
};

export default function () {
  const role = roles[Math.floor(Math.random() * roles.length)];
  const creds = USERS[role];

  const res = http.post(
    `${API}/auth/login`,
    JSON.stringify({ email: creds.email, password: creds.password }),
    { headers: jsonHeaders(), tags: { name: 'auth_login_storm', role } },
  );

  const ok = check(res, {
    'login 200': (r) => r.status === 200,
    'has token': (r) => {
      try {
        return Boolean(r.json('accessToken'));
      } catch {
        return false;
      }
    },
  });

  loginFail.add(!ok);
  sleep(0.2 + Math.random() * 0.5);
}
