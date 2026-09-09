import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Building2,
  CheckCircle,
  Hash,
  ImagePlus,
  IndianRupee,
  Loader2,
  Trash2,
} from 'lucide-react';
import { settingsApi } from '../../services/admin';
import { useAuth } from '../../auth/AuthContext';
import { LetterheadMark } from '../../components/LetterheadMark';
import { PRODUCT_NAME } from '../../lib/product';

type FormState = Record<string, string>;

function previewNumber(opts: {
  prefix: string;
  includeYear: boolean;
  separator: string;
  digits: string;
}) {
  const prefix = (opts.prefix || 'X').trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'X';
  const digits = Math.min(12, Math.max(3, Number(opts.digits) || 6));
  const sep = (opts.separator || '').slice(0, 1);
  const seq = String(1).padStart(digits, '0');
  const year = new Date().getFullYear();
  if (opts.includeYear) return `${prefix}${sep}${year}${sep}${seq}`;
  return sep ? `${prefix}${sep}${seq}` : `${prefix}${seq}`;
}

function asBool(value: string | undefined) {
  return value === 'true' || value === '1';
}

/**
 * Post-subscription clinic setup — letterhead + patient/bill ID formats.
 * Required once for new clinics before using the HIS.
 */
export function ClinicSetupPage() {
  const navigate = useNavigate();
  const { refresh, user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>({
    'clinic.name': user?.clinic?.name || '',
    'clinic.logoText': '',
    'clinic.address': '',
    'clinic.phone': '',
    'clinic.email': '',
    'clinic.gstin': '',
    'clinic.state': '',
    'patient.idLabel': 'UHID',
    'patient.idPrefix': 'P',
    'patient.idIncludeYear': 'false',
    'patient.idSeparator': '',
    'patient.idDigits': '6',
    'billing.invoicePrefix': 'INV',
    'billing.invoiceIncludeYear': 'true',
    'billing.invoiceSeparator': '-',
    'billing.invoiceDigits': '6',
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const set = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    (async () => {
      try {
        const [rows, logo] = await Promise.all([
          settingsApi.list(),
          settingsApi.getLogo().catch(() => null),
        ]);
        const next = { ...form };
        for (const row of rows) {
          if (row.key === 'clinic.setupComplete') continue;
          if (row.key.startsWith('clinic.logo')) continue;
          if (typeof row.value === 'boolean') next[row.key] = row.value ? 'true' : 'false';
          else if (row.value != null && (typeof row.value === 'string' || typeof row.value === 'number')) {
            next[row.key] = String(row.value);
          }
        }
        if (!next['clinic.name'] && user?.clinic?.name) next['clinic.name'] = user.clinic.name;
        setForm(next);
        setLogoUrl(logo?.url || null);
      } catch {
        /* keep defaults */
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  const onPickLogo = async (file: File | undefined) => {
    if (!file) return;
    setLogoBusy(true);
    setError(null);
    try {
      const result = await settingsApi.uploadLogo(file);
      setLogoUrl(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logo upload failed');
    } finally {
      setLogoBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onRemoveLogo = async () => {
    setLogoBusy(true);
    try {
      await settingsApi.removeLogo();
      setLogoUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove logo');
    } finally {
      setLogoBusy(false);
    }
  };

  const finish = async (e: FormEvent) => {
    e.preventDefault();
    if (!form['clinic.name']?.trim()) {
      setError('Clinic name is required');
      setStep(0);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await settingsApi.save([
        { key: 'clinic.name', group: 'clinic', value: form['clinic.name'].trim() },
        { key: 'clinic.logoText', group: 'clinic', value: form['clinic.logoText'] },
        { key: 'clinic.address', group: 'clinic', value: form['clinic.address'] },
        { key: 'clinic.phone', group: 'clinic', value: form['clinic.phone'] },
        { key: 'clinic.email', group: 'clinic', value: form['clinic.email'] },
        { key: 'clinic.gstin', group: 'clinic', value: form['clinic.gstin'] },
        { key: 'clinic.state', group: 'clinic', value: form['clinic.state'] },
        { key: 'patient.idLabel', group: 'patient', value: form['patient.idLabel'] || 'UHID' },
        {
          key: 'patient.idPrefix',
          group: 'patient',
          value: (form['patient.idPrefix'] || 'P').trim().toUpperCase(),
        },
        { key: 'patient.idIncludeYear', group: 'patient', value: asBool(form['patient.idIncludeYear']) },
        { key: 'patient.idSeparator', group: 'patient', value: form['patient.idSeparator'] ?? '' },
        { key: 'patient.idDigits', group: 'patient', value: Number(form['patient.idDigits'] || 6) },
        {
          key: 'billing.invoicePrefix',
          group: 'billing',
          value: (form['billing.invoicePrefix'] || 'INV').trim().toUpperCase(),
        },
        {
          key: 'billing.invoiceIncludeYear',
          group: 'billing',
          value: asBool(form['billing.invoiceIncludeYear']),
        },
        { key: 'billing.invoiceSeparator', group: 'billing', value: form['billing.invoiceSeparator'] ?? '-' },
        { key: 'billing.invoiceDigits', group: 'billing', value: Number(form['billing.invoiceDigits'] || 6) },
        { key: 'clinic.setupComplete', group: 'clinic', value: true },
      ]);
      await refresh();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save setup');
    } finally {
      setSaving(false);
    }
  };

  const mark = (form['clinic.logoText'] || form['clinic.name'] || 'HC').slice(0, 4).toUpperCase();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 py-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Clinic setup</p>
        <h1 className="text-2xl font-bold text-[var(--text)]">Set up {PRODUCT_NAME} for your clinic</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Configure how bills and patient IDs look. You can change these anytime in Settings.
        </p>
      </div>

      <div className="flex gap-2">
        {['Clinic profile', 'Patient & bill IDs'].map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(i)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              step === i ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={finish} className="card space-y-4 p-4">
        {step === 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-semibold">Letterhead &amp; clinic details</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
              <LetterheadMark logoUrl={logoUrl} mark={mark} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Clinic logo</p>
                <p className="text-xs text-slate-500">Shown on invoices and OP receipts</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => onPickLogo(e.target.files?.[0])}
              />
              <button
                type="button"
                className="btn-secondary"
                disabled={logoBusy}
                onClick={() => fileRef.current?.click()}
              >
                {logoBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                {logoUrl ? 'Replace' : 'Attach'}
              </button>
              {logoUrl && (
                <button type="button" className="btn-secondary" disabled={logoBusy} onClick={onRemoveLogo}>
                  <Trash2 className="mr-2 h-4 w-4" /> Remove
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">Clinic / business name *</label>
                <input
                  className="input"
                  required
                  value={form['clinic.name']}
                  onChange={(e) => set('clinic.name', e.target.value)}
                />
              </div>
              <div>
                <label className="label">Logo text (fallback)</label>
                <input
                  className="input"
                  value={form['clinic.logoText']}
                  onChange={(e) => set('clinic.logoText', e.target.value)}
                  placeholder="e.g. SPHEAR"
                />
              </div>
              <div>
                <label className="label">Phone</label>
                <input
                  className="input"
                  value={form['clinic.phone']}
                  onChange={(e) => set('clinic.phone', e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Address</label>
                <input
                  className="input"
                  value={form['clinic.address']}
                  onChange={(e) => set('clinic.address', e.target.value)}
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  className="input"
                  type="email"
                  value={form['clinic.email']}
                  onChange={(e) => set('clinic.email', e.target.value)}
                />
              </div>
              <div>
                <label className="label">GSTIN</label>
                <input
                  className="input"
                  value={form['clinic.gstin']}
                  onChange={(e) => set('clinic.gstin', e.target.value)}
                />
              </div>
              <div>
                <label className="label">State (GST)</label>
                <input
                  className="input"
                  value={form['clinic.state']}
                  onChange={(e) => set('clinic.state', e.target.value)}
                  placeholder="e.g. 33-Tamil Nadu"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="button" className="btn-primary" onClick={() => setStep(1)}>
                Continue
              </button>
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-semibold">Patient ID format</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Label on bills</label>
                  <input
                    className="input"
                    value={form['patient.idLabel']}
                    onChange={(e) => set('patient.idLabel', e.target.value)}
                    placeholder="UHID / MRN"
                  />
                </div>
                <div>
                  <label className="label">Prefix</label>
                  <input
                    className="input font-mono"
                    value={form['patient.idPrefix']}
                    onChange={(e) => set('patient.idPrefix', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Separator</label>
                  <select
                    className="input"
                    value={form['patient.idSeparator']}
                    onChange={(e) => set('patient.idSeparator', e.target.value)}
                  >
                    <option value="">None</option>
                    <option value="-">Hyphen (-)</option>
                    <option value="/">Slash (/)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Digits</label>
                  <input
                    className="input"
                    type="number"
                    min={3}
                    max={12}
                    value={form['patient.idDigits']}
                    onChange={(e) => set('patient.idDigits', e.target.value)}
                  />
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={asBool(form['patient.idIncludeYear'])}
                  onChange={(e) => set('patient.idIncludeYear', e.target.checked ? 'true' : 'false')}
                />
                Include year
              </label>
              <p className="text-sm text-[var(--muted)]">
                Preview:{' '}
                <span className="font-mono font-semibold text-[var(--text)]">
                  {previewNumber({
                    prefix: form['patient.idPrefix'],
                    includeYear: asBool(form['patient.idIncludeYear']),
                    separator: form['patient.idSeparator'],
                    digits: form['patient.idDigits'],
                  })}
                </span>
              </p>
            </div>

            <div className="space-y-3 border-t border-[var(--border)] pt-4">
              <div className="flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-semibold">Bill / invoice number format</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Prefix</label>
                  <input
                    className="input font-mono"
                    value={form['billing.invoicePrefix']}
                    onChange={(e) => set('billing.invoicePrefix', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Separator</label>
                  <select
                    className="input"
                    value={form['billing.invoiceSeparator']}
                    onChange={(e) => set('billing.invoiceSeparator', e.target.value)}
                  >
                    <option value="">None</option>
                    <option value="-">Hyphen (-)</option>
                    <option value="/">Slash (/)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Digits</label>
                  <input
                    className="input"
                    type="number"
                    min={3}
                    max={12}
                    value={form['billing.invoiceDigits']}
                    onChange={(e) => set('billing.invoiceDigits', e.target.value)}
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={asBool(form['billing.invoiceIncludeYear'])}
                      onChange={(e) =>
                        set('billing.invoiceIncludeYear', e.target.checked ? 'true' : 'false')
                      }
                    />
                    Include year
                  </label>
                </div>
              </div>
              <p className="text-sm text-[var(--muted)]">
                Preview:{' '}
                <span className="font-mono font-semibold text-[var(--text)]">
                  {previewNumber({
                    prefix: form['billing.invoicePrefix'],
                    includeYear: asBool(form['billing.invoiceIncludeYear']),
                    separator: form['billing.invoiceSeparator'],
                    digits: form['billing.invoiceDigits'],
                  })}
                </span>
              </p>
            </div>

            <div className="flex flex-wrap justify-between gap-2 border-t border-[var(--border)] pt-4">
              <button type="button" className="btn-secondary" onClick={() => setStep(0)}>
                Back
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" /> Finish setup
                  </span>
                )}
              </button>
            </div>
          </section>
        )}
      </form>
    </div>
  );
}
