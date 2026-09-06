/**
 * Optional AI summary load — costs provider quota and is slow.
 * Keep VUs low. Off unless you explicitly run this file.
 *
 *   k6 run -e VUS=5 -e DURATION=1m load-tests/ai-summary.js
 */

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate } from 'k6/metrics';
import { API } from './config.js';
import { login, jsonHeaders, get } from './helpers.js';

const aiFail = new Rate('ai_failures');

export const options = {
  vus: Number(__ENV.VUS || 3),
  duration: __ENV.DURATION || '1m',
  thresholds: {
    http_req_duration: ['p(95)<120000'],
    ai_failures: ['rate<0.5'],
  },
};

export function setup() {
  const token = login('doctor');
  if (!token) throw new Error('Doctor login failed');

  const sessions = get('/therapy/doctor/sessions', token, 'doctor_sessions');
  let caseId = __ENV.CASE_ID || null;
  if (!caseId && sessions.status === 200) {
    try {
      const body = sessions.json();
      const row = Array.isArray(body) ? body[0] : body?.data?.[0];
      caseId = row?.therapyCaseId || row?.therapyCase?.id || null;
    } catch {
      /* ignore */
    }
  }
  if (!caseId) {
    // Fall back: list cases
    const cases = get('/therapy/cases?page=1&limit=5', token, 'cases_list');
    if (cases.status === 200) {
      try {
        const body = cases.json();
        caseId = body?.data?.[0]?.id || null;
      } catch {
        /* ignore */
      }
    }
  }
  if (!caseId) {
    throw new Error('No therapy case found for AI summary. Pass -e CASE_ID=<uuid>.');
  }
  return { token, caseId };
}

export default function (data) {
  const res = http.post(`${API}/therapy/cases/${data.caseId}/summary`, null, {
    headers: jsonHeaders(data.token),
    timeout: '180s',
    tags: { name: 'ai_summary' },
  });

  const ok = check(res, {
    'AI summary accepted (2xx)': (r) => r.status >= 200 && r.status < 300,
  });
  aiFail.add(!ok);
  sleep(5 + Math.random() * 10);
}
