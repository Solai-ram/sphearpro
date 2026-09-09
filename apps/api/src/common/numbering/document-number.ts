/** Clinic-configurable patient / invoice document numbers. */

export type DocumentNumberConfig = {
  prefix: string;
  includeYear: boolean;
  separator: string;
  digits: number;
};

export const DEFAULT_PATIENT_NUMBER: DocumentNumberConfig = {
  prefix: 'P',
  includeYear: false,
  separator: '',
  digits: 6,
};

export const DEFAULT_INVOICE_NUMBER: DocumentNumberConfig = {
  prefix: 'INV',
  includeYear: true,
  separator: '-',
  digits: 6,
};

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(v)) return true;
    if (['false', '0', 'no', 'n', ''].includes(v)) return false;
  }
  return fallback;
}

function asInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function asString(value: unknown, fallback: string): string {
  if (value == null) return fallback;
  if (typeof value === 'string') return value.replace(/^"|"$/g, '');
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

export function sanitizePrefix(raw: string, fallback: string): string {
  const cleaned = (raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
  return cleaned || fallback;
}

export function sanitizeSeparator(raw: string): string {
  const s = String(raw ?? '').slice(0, 3);
  // Allow empty, hyphen, slash, underscore, or space
  if (!s) return '';
  if (/^[-_/ ]+$/.test(s)) return s[0];
  return '-';
}

export function normalizeDocumentNumberConfig(
  partial: Partial<DocumentNumberConfig> | undefined,
  defaults: DocumentNumberConfig,
): DocumentNumberConfig {
  return {
    prefix: sanitizePrefix(partial?.prefix ?? defaults.prefix, defaults.prefix),
    includeYear: partial?.includeYear ?? defaults.includeYear,
    separator: sanitizeSeparator(
      partial?.separator === undefined ? defaults.separator : partial.separator,
    ),
    digits: asInt(partial?.digits ?? defaults.digits, defaults.digits, 3, 12),
  };
}

/** Stem used for startsWith queries when allocating the next sequence. */
export function documentNumberStem(
  cfg: DocumentNumberConfig,
  year: number = new Date().getFullYear(),
): string {
  const sep = cfg.separator;
  if (cfg.includeYear) {
    return `${cfg.prefix}${sep}${year}${sep}`;
  }
  return sep ? `${cfg.prefix}${sep}` : cfg.prefix;
}

export function formatDocumentNumber(
  cfg: DocumentNumberConfig,
  seq: number,
  year: number = new Date().getFullYear(),
): string {
  const n = Math.max(1, Math.floor(seq));
  const seqPart = String(n).padStart(cfg.digits, '0');
  return `${documentNumberStem(cfg, year)}${seqPart}`;
}

export function parseSequenceFromNumber(number: string, stem: string): number {
  if (!number.toUpperCase().startsWith(stem.toUpperCase())) return 0;
  const rest = number.slice(stem.length);
  const n = parseInt(rest, 10);
  return Number.isFinite(n) ? n : 0;
}

type SettingRow = { key: string; value: unknown };

export function patientNumberConfigFromSettings(rows: SettingRow[]): DocumentNumberConfig {
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return normalizeDocumentNumberConfig(
    {
      prefix: asString(map['patient.idPrefix'], DEFAULT_PATIENT_NUMBER.prefix),
      includeYear: asBool(map['patient.idIncludeYear'], DEFAULT_PATIENT_NUMBER.includeYear),
      separator: asString(map['patient.idSeparator'], DEFAULT_PATIENT_NUMBER.separator),
      digits: asInt(map['patient.idDigits'], DEFAULT_PATIENT_NUMBER.digits, 3, 12),
    },
    DEFAULT_PATIENT_NUMBER,
  );
}

export function invoiceNumberConfigFromSettings(rows: SettingRow[]): DocumentNumberConfig {
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return normalizeDocumentNumberConfig(
    {
      prefix: asString(map['billing.invoicePrefix'], DEFAULT_INVOICE_NUMBER.prefix),
      includeYear: asBool(map['billing.invoiceIncludeYear'], DEFAULT_INVOICE_NUMBER.includeYear),
      separator: asString(map['billing.invoiceSeparator'], DEFAULT_INVOICE_NUMBER.separator),
      digits: asInt(map['billing.invoiceDigits'], DEFAULT_INVOICE_NUMBER.digits, 3, 12),
    },
    DEFAULT_INVOICE_NUMBER,
  );
}

export async function loadPatientNumberConfig(
  prisma: { setting: { findMany: (args: any) => Promise<SettingRow[]> } },
  clinicId: string,
): Promise<DocumentNumberConfig> {
  const rows = await prisma.setting.findMany({
    where: {
      clinicId,
      key: {
        in: ['patient.idPrefix', 'patient.idIncludeYear', 'patient.idSeparator', 'patient.idDigits'],
      },
    },
  });
  return patientNumberConfigFromSettings(rows);
}

export async function loadInvoiceNumberConfig(
  prisma: { setting: { findMany: (args: any) => Promise<SettingRow[]> } },
  clinicId: string,
): Promise<DocumentNumberConfig> {
  const rows = await prisma.setting.findMany({
    where: {
      clinicId,
      key: {
        in: [
          'billing.invoicePrefix',
          'billing.invoiceIncludeYear',
          'billing.invoiceSeparator',
          'billing.invoiceDigits',
        ],
      },
    },
  });
  return invoiceNumberConfigFromSettings(rows);
}

export async function nextDocumentNumber(
  prisma: {
    setting: { findMany: (args: any) => Promise<SettingRow[]> };
  },
  clinicId: string,
  kind: 'patient' | 'invoice',
  findLast: (stem: string) => Promise<string | null | undefined>,
): Promise<string> {
  const cfg =
    kind === 'patient'
      ? await loadPatientNumberConfig(prisma, clinicId)
      : await loadInvoiceNumberConfig(prisma, clinicId);
  const year = new Date().getFullYear();
  const stem = documentNumberStem(cfg, year);
  const last = await findLast(stem);
  const seq = last ? parseSequenceFromNumber(last, stem) + 1 : 1;
  return formatDocumentNumber(cfg, seq, year);
}
