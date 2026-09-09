import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertCircle, ImagePlus, Loader2, Save, Palette, Trash2 } from 'lucide-react';
import { settingsApi } from '../../services/admin';
import { useTheme } from '../../theme/ThemeProvider';
import { useAuth } from '../../auth/AuthContext';
import { DEFAULT_THEME, THEMES, isThemeId, type ThemeId } from '../../theme/themes';
import { LetterheadMark } from '../../components/LetterheadMark';

type FormState = Record<string, string>;

const EMPTY: FormState = {
  'clinic.name': '',
  'clinic.logoText': '',
  'clinic.address': '',
  'clinic.phone': '',
  'clinic.email': '',
  'clinic.gstin': '',
  'clinic.state': '',
  'invoice.title': 'Tax Invoice',
  'invoice.terms':
    'Exempted from Sales Tax.\nReceived the above goods in sound condition & correct quantity.\nGoods once sold cannot be taken back.',
  'billing.defaultTaxRate': '0',
  'billing.currency': 'INR',
  'billing.invoicePrefix': 'INV',
  'billing.invoiceIncludeYear': 'true',
  'billing.invoiceSeparator': '-',
  'billing.invoiceDigits': '6',
  'patient.idPrefix': 'P',
  'patient.idIncludeYear': 'false',
  'patient.idSeparator': '',
  'patient.idDigits': '6',
  'patient.idLabel': 'UHID',
  'receipt.opTitle': 'OP Registration Receipt',
  'receipt.reviewTitle': 'OP Review Receipt',
  'ui.theme': DEFAULT_THEME,
};

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

function asBoolString(value: string | undefined) {
  return value === 'true' || value === '1';
}

export function SettingsPage() {
  const { setTheme, reload } = useTheme();
  const { refresh } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFileName, setLogoFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);

  const stringify = (value: unknown) => {
    if (value == null) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    return JSON.stringify(value);
  };

  const set = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [rows, logo] = await Promise.all([
        settingsApi.list(),
        settingsApi.getLogo().catch(() => null),
      ]);
      const next = { ...EMPTY };
      for (const row of rows) {
        if (
          row.key === 'clinic.logoS3Key' ||
          row.key === 'clinic.logoMimeType' ||
          row.key === 'clinic.logoFileName'
        ) {
          continue;
        }
        if (typeof row.value === 'boolean') {
          next[row.key] = row.value ? 'true' : 'false';
        } else {
          next[row.key] = stringify(row.value);
        }
      }
      setForm(next);
      setLogoUrl(logo?.url || null);
      setLogoFileName(logo?.fileName || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await settingsApi.save([
        { key: 'clinic.name', group: 'clinic', value: form['clinic.name'] },
        { key: 'clinic.logoText', group: 'clinic', value: form['clinic.logoText'] },
        { key: 'clinic.address', group: 'clinic', value: form['clinic.address'] },
        { key: 'clinic.phone', group: 'clinic', value: form['clinic.phone'] },
        { key: 'clinic.email', group: 'clinic', value: form['clinic.email'] },
        { key: 'clinic.gstin', group: 'clinic', value: form['clinic.gstin'] },
        { key: 'clinic.state', group: 'clinic', value: form['clinic.state'] },
        { key: 'invoice.title', group: 'invoice', value: form['invoice.title'] || 'Tax Invoice' },
        { key: 'invoice.terms', group: 'invoice', value: form['invoice.terms'] },
        {
          key: 'billing.defaultTaxRate',
          group: 'billing',
          value: Number(form['billing.defaultTaxRate'] || 0),
        },
        { key: 'billing.currency', group: 'billing', value: form['billing.currency'] },
        {
          key: 'billing.invoicePrefix',
          group: 'billing',
          value: (form['billing.invoicePrefix'] || 'INV').trim().toUpperCase(),
        },
        {
          key: 'billing.invoiceIncludeYear',
          group: 'billing',
          value: asBoolString(form['billing.invoiceIncludeYear']),
        },
        {
          key: 'billing.invoiceSeparator',
          group: 'billing',
          value: form['billing.invoiceSeparator'] ?? '-',
        },
        {
          key: 'billing.invoiceDigits',
          group: 'billing',
          value: Number(form['billing.invoiceDigits'] || 6),
        },
        {
          key: 'patient.idPrefix',
          group: 'patient',
          value: (form['patient.idPrefix'] || 'P').trim().toUpperCase(),
        },
        {
          key: 'patient.idIncludeYear',
          group: 'patient',
          value: asBoolString(form['patient.idIncludeYear']),
        },
        {
          key: 'patient.idSeparator',
          group: 'patient',
          value: form['patient.idSeparator'] ?? '',
        },
        {
          key: 'patient.idDigits',
          group: 'patient',
          value: Number(form['patient.idDigits'] || 6),
        },
        {
          key: 'patient.idLabel',
          group: 'patient',
          value: form['patient.idLabel'] || 'UHID',
        },
        {
          key: 'receipt.opTitle',
          group: 'receipt',
          value: form['receipt.opTitle'] || 'OP Registration Receipt',
        },
        {
          key: 'receipt.reviewTitle',
          group: 'receipt',
          value: form['receipt.reviewTitle'] || 'OP Review Receipt',
        },
        { key: 'clinic.setupComplete', group: 'clinic', value: true },
        { key: 'ui.theme', group: 'ui', value: form['ui.theme'] || DEFAULT_THEME },
      ]);
      if (isThemeId(form['ui.theme'])) setTheme(form['ui.theme'] as ThemeId);
      await reload();
      setSaved(true);
      // Keep auth.setupComplete in sync if they completed via Settings
      await refresh?.().catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const onPickLogo = async (file: File | undefined) => {
    if (!file) return;
    setLogoBusy(true);
    setError(null);
    try {
      const result = await settingsApi.uploadLogo(file);
      setLogoUrl(result.url);
      setLogoFileName(result.fileName || file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logo upload failed');
    } finally {
      setLogoBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onRemoveLogo = async () => {
    setLogoBusy(true);
    setError(null);
    try {
      await settingsApi.removeLogo();
      setLogoUrl(null);
      setLogoFileName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove logo');
    } finally {
      setLogoBusy(false);
    }
  };

  const previewMark = (form['clinic.logoText'] || form['clinic.name'] || 'HC')
    .slice(0, 4)
    .toUpperCase();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <form className="space-y-3 max-w-6xl" onSubmit={save}>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Settings</h1>
        <button className="btn-primary" disabled={saving} type="submit">
          <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 flex gap-2 text-sm">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}
      {saved && (
        <div className="p-3 rounded-lg bg-green-50 text-green-700 text-sm">
          Settings saved. The theme is now live for everyone.
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-3">
        <div className="card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4" style={{ color: 'var(--primary)' }} />
            <h2 className="text-sm font-semibold">Application theme</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {THEMES.map((theme) => {
              const selected = (form['ui.theme'] || DEFAULT_THEME) === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => {
                    set('ui.theme', theme.id);
                    setTheme(theme.id);
                  }}
                  className={`text-left rounded-lg border p-2 transition-shadow ${selected ? 'ring-2' : 'hover:shadow-md'}`}
                  style={
                    selected
                      ? { borderColor: 'var(--primary)', boxShadow: '0 0 0 2px var(--ring)' }
                      : undefined
                  }
                >
                  <div className="flex gap-1 mb-1">
                    {theme.swatches.map((color) => (
                      <span
                        key={color}
                        className="h-4 flex-1 rounded border"
                        style={{ background: color }}
                      />
                    ))}
                  </div>
                  <p className="text-sm font-semibold">{theme.name}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="card p-3 space-y-2">
          <h2 className="text-sm font-semibold">Invoice letterhead</h2>
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 flex flex-wrap items-center gap-3">
            <LetterheadMark logoUrl={logoUrl} mark={previewMark} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800">Clinic logo</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Shown on invoices, bills, OP receipts, and reports. PNG/JPG/WebP, max 2 MB.
              </p>
              {logoFileName ? (
                <p className="text-xs text-slate-600 mt-1 truncate">{logoFileName}</p>
              ) : (
                <p className="text-xs text-slate-400 mt-1">No logo attached — text mark is used.</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
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
                {logoBusy ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ImagePlus className="w-4 h-4 mr-2" />
                )}
                {logoUrl ? 'Replace logo' : 'Attach logo'}
              </button>
              {logoUrl && (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={logoBusy}
                  onClick={onRemoveLogo}
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Remove
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Business name</label>
              <input
                className="input"
                value={form['clinic.name'] || ''}
                onChange={(e) => set('clinic.name', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Logo text (fallback)</label>
              <input
                className="input"
                value={form['clinic.logoText'] || ''}
                onChange={(e) => set('clinic.logoText', e.target.value)}
                placeholder="e.g. RAJ HC"
              />
            </div>
            <div className="col-span-2">
              <label className="label">Address</label>
              <input
                className="input"
                value={form['clinic.address'] || ''}
                onChange={(e) => set('clinic.address', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Phone</label>
              <input
                className="input"
                value={form['clinic.phone'] || ''}
                onChange={(e) => set('clinic.phone', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={form['clinic.email'] || ''}
                onChange={(e) => set('clinic.email', e.target.value)}
              />
            </div>
            <div>
              <label className="label">GSTIN</label>
              <input
                className="input"
                value={form['clinic.gstin'] || ''}
                onChange={(e) => set('clinic.gstin', e.target.value)}
              />
            </div>
            <div>
              <label className="label">State (GST code)</label>
              <input
                className="input"
                value={form['clinic.state'] || ''}
                onChange={(e) => set('clinic.state', e.target.value)}
                placeholder="e.g. 33-Tamil Nadu"
              />
            </div>
          </div>
        </div>

        <div className="card p-3 space-y-2">
          <h2 className="text-sm font-semibold">Invoice wording</h2>
          <div>
            <label className="label">Document title</label>
            <input
              className="input"
              value={form['invoice.title'] || ''}
              onChange={(e) => set('invoice.title', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Terms (one per line)</label>
            <textarea
              className="input"
              rows={3}
              value={form['invoice.terms'] || ''}
              onChange={(e) => set('invoice.terms', e.target.value)}
            />
          </div>
        </div>

        <div className="card p-3 space-y-2">
          <h2 className="text-sm font-semibold">Billing</h2>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Default tax rate (%)</label>
              <input
                className="input"
                type="number"
                min={0}
                value={form['billing.defaultTaxRate'] || '0'}
                onChange={(e) => set('billing.defaultTaxRate', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Currency</label>
              <input
                className="input"
                value={form['billing.currency'] || ''}
                onChange={(e) => set('billing.currency', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="card p-3 space-y-2 lg:col-span-2">
          <h2 className="text-sm font-semibold">Patient ID format</h2>
          <p className="text-xs text-[var(--muted)]">
            Used when registering new patients. Existing IDs are not changed.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <label className="label">Label on bills</label>
              <input
                className="input"
                value={form['patient.idLabel'] || ''}
                onChange={(e) => set('patient.idLabel', e.target.value)}
                placeholder="UHID / MRN / Patient ID"
              />
            </div>
            <div>
              <label className="label">Prefix</label>
              <input
                className="input font-mono"
                value={form['patient.idPrefix'] || ''}
                onChange={(e) => set('patient.idPrefix', e.target.value)}
                placeholder="P"
              />
            </div>
            <div>
              <label className="label">Separator</label>
              <select
                className="input"
                value={form['patient.idSeparator'] ?? ''}
                onChange={(e) => set('patient.idSeparator', e.target.value)}
              >
                <option value="">None</option>
                <option value="-">Hyphen (-)</option>
                <option value="/">Slash (/)</option>
                <option value="_">Underscore (_)</option>
              </select>
            </div>
            <div>
              <label className="label">Sequence digits</label>
              <input
                className="input"
                type="number"
                min={3}
                max={12}
                value={form['patient.idDigits'] || '6'}
                onChange={(e) => set('patient.idDigits', e.target.value)}
              />
            </div>
            <div className="col-span-2 md:col-span-4 flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={asBoolString(form['patient.idIncludeYear'])}
                  onChange={(e) => set('patient.idIncludeYear', e.target.checked ? 'true' : 'false')}
                />
                Include year
              </label>
              <p className="text-sm text-[var(--muted)]">
                Preview:{' '}
                <span className="font-mono font-semibold text-[var(--text)]">
                  {previewNumber({
                    prefix: form['patient.idPrefix'] || 'P',
                    includeYear: asBoolString(form['patient.idIncludeYear']),
                    separator: form['patient.idSeparator'] || '',
                    digits: form['patient.idDigits'] || '6',
                  })}
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="card p-3 space-y-2 lg:col-span-2">
          <h2 className="text-sm font-semibold">Bill / invoice number format</h2>
          <p className="text-xs text-[var(--muted)]">
            Applied to new invoices only. Changing format starts a new sequence under that prefix.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <label className="label">Prefix</label>
              <input
                className="input font-mono"
                value={form['billing.invoicePrefix'] || ''}
                onChange={(e) => set('billing.invoicePrefix', e.target.value)}
                placeholder="INV"
              />
            </div>
            <div>
              <label className="label">Separator</label>
              <select
                className="input"
                value={form['billing.invoiceSeparator'] ?? '-'}
                onChange={(e) => set('billing.invoiceSeparator', e.target.value)}
              >
                <option value="">None</option>
                <option value="-">Hyphen (-)</option>
                <option value="/">Slash (/)</option>
                <option value="_">Underscore (_)</option>
              </select>
            </div>
            <div>
              <label className="label">Sequence digits</label>
              <input
                className="input"
                type="number"
                min={3}
                max={12}
                value={form['billing.invoiceDigits'] || '6'}
                onChange={(e) => set('billing.invoiceDigits', e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm pb-2">
                <input
                  type="checkbox"
                  checked={asBoolString(form['billing.invoiceIncludeYear'])}
                  onChange={(e) =>
                    set('billing.invoiceIncludeYear', e.target.checked ? 'true' : 'false')
                  }
                />
                Include year
              </label>
            </div>
            <div className="col-span-2 md:col-span-4">
              <p className="text-sm text-[var(--muted)]">
                Preview:{' '}
                <span className="font-mono font-semibold text-[var(--text)]">
                  {previewNumber({
                    prefix: form['billing.invoicePrefix'] || 'INV',
                    includeYear: asBoolString(form['billing.invoiceIncludeYear']),
                    separator: form['billing.invoiceSeparator'] || '',
                    digits: form['billing.invoiceDigits'] || '6',
                  })}
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="card p-3 space-y-2 lg:col-span-2">
          <h2 className="text-sm font-semibold">OP receipt titles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <label className="label">New OP receipt title</label>
              <input
                className="input"
                value={form['receipt.opTitle'] || ''}
                onChange={(e) => set('receipt.opTitle', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Review receipt title</label>
              <input
                className="input"
                value={form['receipt.reviewTitle'] || ''}
                onChange={(e) => set('receipt.reviewTitle', e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
