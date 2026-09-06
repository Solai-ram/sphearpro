/**
 * Clinic browse load test — simulates already-logged-in staff hitting common APIs.
 *
 * Run (API must be up; disable throttle first — see README):
 *   k6 run load-tests/clinic-browse.js
 *   k6 run -e PROFILE=smoke load-tests/clinic-browse.js
 *   k6 run -e PROFILE=spike load-tests/clinic-browse.js
 *   k6 run -e BASE_URL=http://localhost:4000 -e PROFILE=clinic load-tests/clinic-browse.js
 *
 * Default PROFILE=clinic ramps to 200 VUs.
 */

import { sleep, group } from 'k6';
import { Rate } from 'k6/metrics';
import { selectedProfile, thresholds } from './config.js';
import { loginAllRoles, get, expectOk } from './helpers.js';

const errorRate = new Rate('clinic_errors');

export const options = {
  stages: selectedProfile().stages,
  thresholds: {
    ...thresholds,
    clinic_errors: ['rate<0.05'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

export function setup() {
  const health = get('/health/live', null, 'health_live');
  if (health.status !== 200) {
    throw new Error(
      `API not reachable at health check (status ${health.status}). Start the API first.`,
    );
  }

  const tokens = loginAllRoles();
  const missing = Object.entries(tokens)
    .filter(([, t]) => !t)
    .map(([role]) => role);
  if (missing.length) {
    throw new Error(`Login failed for roles: ${missing.join(', ')}. Check seed data / LOGIN.md.`);
  }

  // Warm patient + session ids for detail views (best-effort)
  let patientId = null;
  let sessionId = null;
  let caseId = null;

  const patients = get('/patients?page=1&limit=5', tokens.reception, 'patients_list');
  if (patients.status === 200) {
    try {
      const body = patients.json();
      const row = body?.data?.[0] || body?.[0];
      patientId = row?.id || null;
    } catch {
      /* ignore */
    }
  }

  const sessions = get('/therapy/doctor/sessions', tokens.doctor, 'doctor_sessions');
  if (sessions.status === 200) {
    try {
      const body = sessions.json();
      const row = Array.isArray(body) ? body[0] : body?.data?.[0];
      sessionId = row?.id || null;
      caseId = row?.therapyCaseId || row?.therapyCase?.id || null;
    } catch {
      /* ignore */
    }
  }

  return { tokens, patientId, sessionId, caseId };
}

export default function (data) {
  const { tokens, patientId, sessionId, caseId } = data;
  // Weighted role mix roughly like a busy clinic day
  const roll = Math.random();
  let role = 'doctor';
  if (roll < 0.35) role = 'reception';
  else if (roll < 0.55) role = 'billing';
  else if (roll < 0.7) role = 'admin';
  else role = 'doctor';

  const token = tokens[role];
  let failed = false;

  group(`${role}_browse`, () => {
    if (!expectOk(get('/auth/me', token, 'auth_me'), 'auth/me')) failed = true;

    if (role === 'doctor') {
      if (!expectOk(get('/therapy/doctor/sessions', token, 'doctor_sessions'), 'doctor sessions')) {
        failed = true;
      }
      if (sessionId) {
        if (
          !expectOk(
            get(`/therapy/doctor/sessions/${sessionId}`, token, 'doctor_workspace'),
            'doctor workspace',
          )
        ) {
          failed = true;
        }
      }
      if (caseId) {
        if (!expectOk(get(`/therapy/cases/${caseId}`, token, 'therapy_case'), 'therapy case')) {
          failed = true;
        }
      }
    }

    if (role === 'reception' || role === 'admin') {
      if (!expectOk(get('/patients?page=1&limit=20', token, 'patients_list'), 'patients')) {
        failed = true;
      }
      if (!expectOk(get('/patients/search?q=a&limit=10', token, 'patients_search'), 'search')) {
        failed = true;
      }
      // day-board may 403 for some roles — only count hard failures
      const board = get('/appointments/day-board', token, 'day_board');
      if (board.status >= 500) failed = true;

      if (patientId) {
        if (!expectOk(get(`/patients/${patientId}`, token, 'patient_detail'), 'patient detail')) {
          failed = true;
        }
      }
    }

    if (role === 'billing' || role === 'admin') {
      const inv = get('/billing/invoices?page=1&limit=20', token, 'invoices_list');
      if (inv.status >= 500) failed = true;
      else if (inv.status >= 200 && inv.status < 300) {
        expectOk(inv, 'invoices');
      }
    }

    if (role === 'admin') {
      const dash = get('/dashboard/today', token, 'dashboard_today');
      if (dash.status >= 500) failed = true;
      const stats = get('/dashboard/stats', token, 'dashboard_stats');
      if (stats.status >= 500) failed = true;
    }
  });

  errorRate.add(failed);
  // Think time: users don't click every millisecond
  sleep(0.5 + Math.random() * 1.5);
}

export function teardown() {
  // no-op — tokens expire; avoid mass logout thrashing refresh hashes
}
