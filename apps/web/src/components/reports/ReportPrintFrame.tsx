import { useEffect, useState, type ReactNode } from 'react';
import { Download, Loader2, Printer } from 'lucide-react';
import { settingsApi } from '../../services/admin';
import { PRODUCT_MARK, PRODUCT_NAME } from '../../lib/product';
import { LetterheadMark } from '../LetterheadMark';

type ClinicLetterhead = {
  name: string;
  mark: string;
  logoUrl?: string | null;
  address?: string;
  phone?: string;
  email?: string;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return PRODUCT_MARK;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function useClinicLetterhead() {
  const [clinic, setClinic] = useState<ClinicLetterhead>({ name: PRODUCT_NAME, mark: PRODUCT_MARK });
  useEffect(() => {
    Promise.all([
      settingsApi.list(),
      settingsApi.getLogo().catch(() => ({ url: null as string | null })),
    ])
      .then(([rows, logo]) => {
        const map: Record<string, string> = {};
        for (const row of rows) {
          map[row.key] =
            typeof row.value === 'string' || typeof row.value === 'number' ? String(row.value) : '';
        }
        const name = map['clinic.name'] || PRODUCT_NAME;
        setClinic({
          name,
          mark: map['clinic.logoText'] || initials(name),
          logoUrl: logo.url,
          address: map['clinic.address'],
          phone: map['clinic.phone'],
          email: map['clinic.email'],
        });
      })
      .catch(() => undefined);
  }, []);
  return clinic;
}

export function ReportPrintFrame({
  title,
  subtitle,
  periodLabel,
  filters,
  loading,
  error,
  onExport,
  children,
}: {
  title: string;
  subtitle?: string;
  periodLabel?: string;
  filters?: ReactNode;
  loading?: boolean;
  error?: string | null;
  onExport?: () => void;
  children: ReactNode;
}) {
  const clinic = useClinicLetterhead();
  const printedAt = new Date().toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="invoice-preview -m-4 lg:-m-6 min-h-[calc(100vh-3.5rem)]">
      <div className="invoice-toolbar print:hidden">
        <div className="invoice-toolbar-copy">
          <p>{title}</p>
          <span>{periodLabel || subtitle}</span>
        </div>
        {onExport && (
          <button type="button" className="btn-secondary" onClick={onExport}>
            <Download className="w-4 h-4 mr-2" /> CSV
          </button>
        )}
        <button type="button" className="btn-primary" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-2" /> Print / Save PDF
        </button>
      </div>
      {filters && (
        <div className="max-w-[210mm] mx-auto mb-4 print:hidden">{filters}</div>
      )}
      {error && (
        <div className="max-w-[210mm] mx-auto mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm print:hidden">
          {error}
        </div>
      )}
      {loading ? (
        <div className="flex justify-center py-16 print:hidden">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <article className="invoice-sheet">
          <header className="invoice-masthead">
            <div className="invoice-brand">
              <LetterheadMark logoUrl={clinic.logoUrl} mark={clinic.mark} />
              <div>
                <p className="invoice-clinic">{clinic.name}</p>
                {clinic.address && <p className="invoice-muted">{clinic.address}</p>}
                <p className="invoice-muted">{[clinic.phone, clinic.email].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
            <div className="invoice-title-block">
              <p className="invoice-kicker">Clinic report</p>
              <h2>{title}</h2>
              {periodLabel && <p className="invoice-muted">{periodLabel}</p>}
            </div>
          </header>
          {children}
          <footer className="report-sheet-foot">
            <span>Generated {printedAt}</span>
            <span>{PRODUCT_NAME}</span>
          </footer>
        </article>
      )}
    </div>
  );
}

export function ReportKpis({ items }: { items: { label: string; value: string | number }[] }) {
  const cols = Math.min(Math.max(items.length, 1), 4);
  return (
    <div className="report-kpis" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {items.map((item) => (
        <div key={item.label} className="report-kpi">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}
