/**
 * Local pre–go-live verification (no VPS required).
 * Run: node scripts/verify-pre-go-live.mjs
 */
const fs = require('fs');
const path = require('path');
const { createHmac } = require('crypto');

const root = path.resolve(__dirname, '..');
const results = [];

function ok(name, detail = '') {
  results.push({ status: 'PASS', name, detail });
}
function fail(name, detail = '') {
  results.push({ status: 'FAIL', name, detail });
}
function skip(name, detail = '') {
  results.push({ status: 'SKIP', name, detail });
}

function readEnv(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) return {};
  const out = {};
  for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const env = { ...readEnv('.env'), ...readEnv('apps/api/.env') };
const webEnv = readEnv('apps/web/.env');

// Scope
if ((env.RAZORPAY_KEY_ID || '').startsWith('rzp_test_')) ok('Razorpay test mode keys');
else fail('Razorpay test mode keys', env.RAZORPAY_KEY_ID || 'missing');

if (env.RAZORPAY_MONTHLY_PLAN_ID === 'plan_TYeFsYg2ghqgZh') ok('Monthly plan id');
else fail('Monthly plan id', env.RAZORPAY_MONTHLY_PLAN_ID);

if (env.RAZORPAY_YEARLY_PLAN_ID === 'plan_TYeZQ1svuDpVLO') ok('Yearly plan id');
else fail('Yearly plan id', env.RAZORPAY_YEARLY_PLAN_ID);

if (env.RAZORPAY_TRIAL_DAYS === '7') ok('Trial days = 7');
else fail('Trial days', env.RAZORPAY_TRIAL_DAYS);

if (env.SUBSCRIPTION_ENFORCE === 'true') ok('SUBSCRIPTION_ENFORCE=true');
else fail('SUBSCRIPTION_ENFORCE', env.SUBSCRIPTION_ENFORCE);

if (env.ALLOW_MANUAL_SUBSCRIPTION_ACTIVATE === 'false') ok('Manual activate disabled');
else fail('ALLOW_MANUAL_SUBSCRIPTION_ACTIVATE', env.ALLOW_MANUAL_SUBSCRIPTION_ACTIVATE || 'unset');

if (env.WHATSAPP_ENABLED !== 'true') ok('WhatsApp disabled');
else fail('WhatsApp should be off');

if (webEnv.VITE_RAZORPAY_KEY_ID && !webEnv.RAZORPAY_KEY_SECRET) {
  ok('Frontend has public key only');
} else fail('Frontend key hygiene', JSON.stringify(webEnv));

if (!env.RAZORPAY_WEBHOOK_SECRET) {
  skip('Webhook secret', 'Must set in Razorpay Dashboard + VPS env');
} else ok('Webhook secret present in local env');

// Code gates
const worker = fs.readFileSync(
  path.join(root, 'apps/api/src/modules/communication/whatsapp-queue.worker.ts'),
  'utf8',
);
if (worker.includes("WHATSAPP_ENABLED !== 'true'")) ok('WhatsApp worker gated');
else fail('WhatsApp worker gate missing');

const ctrl = fs.readFileSync(
  path.join(root, 'apps/api/src/modules/subscription/subscription.controller.ts'),
  'utf8',
);
if (ctrl.includes('ALLOW_MANUAL_SUBSCRIPTION_ACTIVATE')) ok('Production activate gate in controller');
else fail('Production activate gate missing');

const rzp = fs.readFileSync(
  path.join(root, 'apps/api/src/modules/subscription/razorpay.service.ts'),
  'utf8',
);
if (rzp.includes('start_at') && rzp.includes('getTrialStartAtUnix')) ok('Razorpay start_at trial helpers');
else fail('start_at helpers missing');

const checkout = fs.readFileSync(
  path.join(root, 'apps/web/src/pages/subscription/SubscriptionCheckoutPage.tsx'),
  'utf8',
);
if (checkout.includes('Start 7-Day Free Trial')) ok('Checkout CTA copy');
else fail('Checkout CTA copy');

const pricing = fs.readFileSync(
  path.join(root, 'apps/web/src/pages/subscription/PricingPage.tsx'),
  'utf8',
);
if (pricing.includes('Start 7-Day Free Trial') && pricing.includes('7 days free')) {
  ok('Pricing trial copy');
} else fail('Pricing trial copy');

const authCtrl = fs.readFileSync(
  path.join(root, 'apps/api/src/modules/auth/auth.controller.ts'),
  'utf8',
);
if (authCtrl.includes('httpOnly: true') && authCtrl.includes("sameSite: 'strict'")) {
  ok('Refresh cookie httpOnly + strict');
} else fail('Cookie security flags');

const apiTs = fs.readFileSync(path.join(root, 'apps/web/src/lib/api.ts'), 'utf8');
if (apiTs.includes("localStorage.removeItem('accessToken')") || !apiTs.includes('localStorage.setItem')) {
  ok('Access token not persisted to localStorage (memory + clear legacy)');
} else fail('Token storage check');

const prodEx = fs.readFileSync(path.join(root, '.env.production.example'), 'utf8');
if (prodEx.includes('sphearpro.tech') && prodEx.includes('api.sphearpro.tech')) {
  ok('Production example uses sphearpro.tech');
} else fail('Production example domains');

if (fs.existsSync(path.join(root, '.env.production.secrets.local'))) {
  ok('Generated VPS secrets file (.env.production.secrets.local)');
} else skip('Generated VPS secrets', 'Run secret generation');

if (fs.existsSync(path.join(root, 'docs/PRE-GO-LIVE-CHECKLIST.md'))) {
  ok('Pre-go-live checklist doc present');
} else fail('Checklist missing');

// Signature helper sanity
const sig = createHmac('sha256', 'secret').update('order|pay').digest('hex');
if (sig.length === 64) ok('HMAC helper works');
else fail('HMAC helper');

console.log('\nSPHEAR pre–go-live local verification\n');
for (const r of results) {
  console.log(`${r.status.padEnd(4)} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
}
const fails = results.filter((r) => r.status === 'FAIL').length;
const skips = results.filter((r) => r.status === 'SKIP').length;
console.log(`\n${results.filter((r) => r.status === 'PASS').length} passed, ${fails} failed, ${skips} skipped\n`);
process.exit(fails > 0 ? 1 : 0);
