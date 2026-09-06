const API = 'http://localhost:4000/api/v1';
const WEB = 'http://localhost:3000';
const EMAIL = 'admin@hislite.local';
const PASSWORD = 'Admin@12345';

const results = [];

function record(step, ok, detail) {
  results.push({ step, ok, detail });
  const mark = ok ? 'OK' : 'FAIL';
  console.log(`[${mark}] ${step}${detail ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`);
}

async function req(method, path, token, body, timeoutMs = 30000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    if (!res.ok) {
      const msg = json?.message || json?.error || text || res.statusText;
      throw new Error(`${method} ${path} -> ${res.status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
    }
    return json;
  } finally {
    clearTimeout(t);
  }
}

function nextWeekdayAt(hour, minute) {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}

async function main() {
  const login = await req('POST', '/auth/login', null, { email: EMAIL, password: PASSWORD });
  const token = login.accessToken;
  if (!token) throw new Error('No accessToken from login');
  record('Login API', true, login.user?.email || EMAIL);

  try {
    const webLogin = await fetch(`${WEB}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    record('Login via Vite proxy', webLogin.ok, `status ${webLogin.status}`);
  } catch (e) {
    record('Login via Vite proxy', false, e.message);
  }

  const staffList = await req('GET', '/staff?limit=50', token);
  let staff = (staffList.data || staffList || []).find((s) => s.isProvider) || (staffList.data || [])[0];
  if (!staff) {
    staff = await req('POST', '/staff', token, {
      name: 'Dr Walkthrough',
      staffType: 'DOCTOR',
      specialization: 'General',
      isProvider: true,
    });
    record('Create staff/provider', true, staff.id);
  } else {
    record('Reuse staff/provider', true, `${staff.name} ${staff.id}`);
  }

  const schedules = Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    startTime: '00:00',
    endTime: '23:59',
    isAvailable: true,
  }));
  await req('PATCH', `/staff/${staff.id}/schedule`, token, { schedules });
  record('Set provider schedule', true, 'all days 00:00-23:59');

  const suffix = Date.now().toString().slice(-6);
  const patient = await req('POST', '/patients', token, {
    name: `Walkthrough Patient ${suffix}`,
    dateOfBirth: '1990-01-15',
    gender: 'FEMALE',
    phone: `90000${suffix}`,
  });
  record('Create patient', true, `${patient.patientNumber || ''} ${patient.id}`);

  const appointmentAt = nextWeekdayAt(10, 30).toISOString();
  const appointment = await req('POST', '/appointments', token, {
    patientId: patient.id,
    providerId: staff.id,
    appointmentAt,
    durationMin: 30,
    reason: 'Speech difficulty follow-up',
  });
  record('Book appointment', true, appointment.id);

  const op = await req('POST', `/clinical/from-appointment/${appointment.id}`, token, {});
  record('OP from appointment', true, op.id);

  await req('POST', `/clinical/${op.id}/diagnoses`, token, {
    code: 'R47.1',
    description: 'Dysarthria and anarthria',
    type: 'PRIMARY',
  });
  record('Add diagnosis', true, 'R47.1');

  await req('POST', `/clinical/${op.id}/notes`, token, {
    content: 'Patient reports reduced speech clarity. Referred to speech therapy.',
  });
  record('Add clinical note', true);

  const opInvoice = await req('POST', `/clinical/${op.id}/invoice`, token, { unitPrice: 800 });
  record('Invoice OP visit', true, opInvoice.invoiceNumber || opInvoice.id);

  const packages = await req('GET', '/therapy/packages?limit=20', token);
  const pkgList = packages.data || packages;
  const speechPkg = pkgList.find((p) => p.name?.includes('Speech')) || pkgList[0];
  if (!speechPkg) throw new Error('No therapy packages seeded');
  record('Therapy catalog', true, speechPkg.name);

  const therapyCase = await req('POST', '/therapy/cases', token, {
    patientId: patient.id,
    therapistId: staff.id,
    title: 'Speech therapy for dysarthria',
    assessment: 'Reduced intelligibility; weekly therapy indicated.',
    goals: ['Improve articulation', 'Increase intelligibility'],
  });
  record('Create therapy case', true, therapyCase.id);

  const assigned = await req('POST', `/therapy/cases/${therapyCase.id}/packages`, token, {
    packageId: speechPkg.id,
    startDate: new Date().toISOString(),
  });
  record('Assign package + generate sessions', true, `${assigned.sessionsGenerated} sessions`);

  const invoices = await req('GET', `/billing/invoices?patientId=${patient.id}&limit=20`, token);
  const invoiceRows = invoices.data || invoices;
  const packageInvoice = invoiceRows.find((inv) =>
    (inv.items || []).some((it) => it.billableType === 'THERAPY_PACKAGE'),
  ) || invoiceRows.find((inv) => inv.id !== opInvoice.id) || invoiceRows[0];
  if (!packageInvoice) throw new Error('Package invoice not found');
  record('Package invoice', true, packageInvoice.invoiceNumber || packageInvoice.id);

  const session = (assigned.sessions || [])[0];
  if (!session) throw new Error('No sessions generated');
  await req('PATCH', `/therapy/sessions/${session.id}/attendance`, token, { status: 'PRESENT' });
  record('Mark session PRESENT', true, session.id);

  await req('POST', `/therapy/sessions/${session.id}/notes`, token, {
    subjective: 'Patient reports speaking more slowly at home.',
    objective: 'Intelligibility ~60% in conversation.',
    activities: 'Oral-motor warm-up, /k/ and /g/ drills.',
    observations: 'Fatigue after 20 minutes.',
    progress: 'Slight improvement on single-word accuracy.',
    challenges: 'Cluster reduction persists.',
    nextPlan: 'Continue articulatory placement cues; home practice sheet.',
  });
  record('Add SOAP note', true);

  const payment = await req('POST', '/billing/payments', token, {
    invoiceId: packageInvoice.id,
    amount: Number(packageInvoice.grandTotal ?? speechPkg.price ?? 15000),
    method: 'UPI',
    reference: `UPI-WALK-${suffix}`,
  });
  record('Record payment', true, payment.id || payment.receiptNumber);

  let summary;
  try {
    summary = await req('POST', `/therapy/cases/${therapyCase.id}/summary`, token, undefined, 120000);
    record('Gemini therapy summary', true, `draft length ${(summary.content || '').length}`);
  } catch (e) {
    record('Gemini therapy summary', false, e.message);
    throw e;
  }

  const reviewed = await req('POST', `/therapy/summaries/${summary.id}/review`, token, { approved: true });
  record('Review/approve AI summary', true, `isReviewed=${reviewed.isReviewed}`);

  const pages = ['/login', '/dashboard', '/patients', '/clinical', '/therapy', '/billing'];
  for (const page of pages) {
    const res = await fetch(`${WEB}${page}`);
    record(`Web ${page}`, res.ok, `status ${res.status}`);
  }

  console.log('\n--- Clinic flow complete ---');
  console.log(JSON.stringify({
    patientId: patient.id,
    appointmentId: appointment.id,
    opCaseId: op.id,
    therapyCaseId: therapyCase.id,
    sessionId: session.id,
    packageInvoiceId: packageInvoice.id,
    paymentId: payment.id,
    summaryId: summary.id,
    web: WEB,
    api: API,
  }, null, 2));
}

main().catch((err) => {
  record('Aborted', false, err.message);
  console.error(err);
  process.exit(1);
});
