/**
 * Shared k6 config for HIS-Lite / MediOne API load tests.
 * Override with env: BASE_URL, PROFILE (smoke|clinic|spike), INCLUDE_AI=true
 */

export const BASE_URL = (__ENV.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
export const API = `${BASE_URL}/api/v1`;

export const USERS = {
  admin: {
    email: __ENV.ADMIN_EMAIL || 'admin@hislite.local',
    password: __ENV.ADMIN_PASSWORD || 'Admin@12345',
  },
  doctor: {
    email: __ENV.DOCTOR_EMAIL || 'ananya.reddy@hislite.local',
    password: __ENV.DOCTOR_PASSWORD || 'Staff@12345',
  },
  reception: {
    email: __ENV.RECEPTION_EMAIL || 'priya.sharma@hislite.local',
    password: __ENV.RECEPTION_PASSWORD || 'Staff@12345',
  },
  billing: {
    email: __ENV.BILLING_EMAIL || 'kavya.menon@hislite.local',
    password: __ENV.BILLING_PASSWORD || 'Staff@12345',
  },
};

/** Profiles: concurrent virtual users browsing the clinic API */
export const PROFILES = {
  smoke: {
    stages: [
      { duration: '10s', target: 5 },
      { duration: '20s', target: 5 },
      { duration: '10s', target: 0 },
    ],
  },
  /** ~200 concurrent users — main answer to “what if 200 users hit at once” */
  clinic: {
    stages: [
      { duration: '30s', target: 50 },
      { duration: '30s', target: 100 },
      { duration: '45s', target: 200 },
      { duration: '2m', target: 200 },
      { duration: '30s', target: 0 },
    ],
  },
  spike: {
    stages: [
      { duration: '10s', target: 20 },
      { duration: '10s', target: 200 },
      { duration: '1m', target: 200 },
      { duration: '20s', target: 0 },
    ],
  },
};

export function selectedProfile() {
  const name = (__ENV.PROFILE || 'clinic').toLowerCase();
  return PROFILES[name] || PROFILES.clinic;
}

export const thresholds = {
  http_req_failed: ['rate<0.05'],
  http_req_duration: ['p(95)<2000', 'p(99)<5000'],
  checks: ['rate>0.95'],
};
