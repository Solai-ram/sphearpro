import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import { billingApi } from '../../services/billing';
import { settingsApi } from '../../services/admin';
import type { Invoice } from '../../types/billing';
import { InvoiceDocument, type InvoiceClinicProfile } from '../../components/billing/InvoiceDocument';
import { PRODUCT_NAME } from '../../lib/product';

const FALLBACK_TERMS =
  'Exempted from Sales Tax.\nReceived the above goods in sound condition & correct quantity.\nGoods once sold cannot be taken back.';

function profileFromSettings(rows: Array<{ key: string; value: unknown }>): InvoiceClinicProfile {
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] =
      typeof row.value === 'string' || typeof row.value === 'number'
        ? String(row.value)
        : row.value == null
          ? ''
          : JSON.stringify(row.value);
  }
  return {
    clinicName: map['clinic.name'] || PRODUCT_NAME,
    clinicAddress: map['clinic.address'],
    clinicPhone: map['clinic.phone'],
    clinicEmail: map['clinic.email'],
    clinicGstin: map['clinic.gstin'],
    clinicState: map['clinic.state'],
    clinicLogoText: map['clinic.logoText'],
    invoiceTitle: map['invoice.title'] || 'Tax Invoice',
    invoiceTerms: map['invoice.terms'] || FALLBACK_TERMS,
  };
}

export function InvoicePrintPage() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [clinic, setClinic] = useState<InvoiceClinicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const inv = await billingApi.getInvoice(id);
        setInvoice(inv);
        try {
          const rows = await settingsApi.list();
          setClinic(profileFromSettings(rows));
        } catch {
          const appearance = await fetch('/api/settings/appearance', { credentials: 'include' }).then((r) => r.json());
          setClinic({
            clinicName: appearance.clinicName || PRODUCT_NAME,
            clinicAddress: appearance.clinicAddress,
            clinicPhone: appearance.clinicPhone,
            clinicEmail: appearance.clinicEmail,
            clinicGstin: appearance.clinicGstin,
            clinicState: appearance.clinicState,
            clinicLogoText: appearance.clinicLogoText,
            invoiceTitle: appearance.invoiceTitle || 'Tax Invoice',
            invoiceTerms: appearance.invoiceTerms || FALLBACK_TERMS,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load invoice');
      }
    };
    load();
  }, [id]);

  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!invoice || !clinic) {
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="invoice-preview">
      <div className="invoice-toolbar print:hidden">
        <Link to={`/billing/${invoice.id}`} className="btn-secondary">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Link>
        <div className="invoice-toolbar-copy">
          <p>Invoice preview</p>
          <span>{invoice.invoiceNumber} · {invoice.patient?.name}</span>
        </div>
        <Link to="/settings" className="btn-secondary">Letterhead</Link>
        <button className="btn-primary" type="button" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-2" /> Print / Save PDF
        </button>
      </div>
      <InvoiceDocument invoice={invoice} clinic={clinic} />
    </div>
  );
}
