import type { Invoice, InvoiceStatus } from '../../types/billing';
import { amountInWordsInr, formatPatientAddress } from '../../lib/invoice';
import { PRODUCT_NAME } from '../../lib/product';
import { LetterheadMark } from '../LetterheadMark';

export type InvoiceClinicProfile = {
  clinicName: string;
  clinicAddress?: string;
  clinicPhone?: string;
  clinicEmail?: string;
  clinicGstin?: string;
  clinicState?: string;
  clinicLogoText?: string;
  clinicLogoUrl?: string | null;
  invoiceTitle?: string;
  invoiceTerms?: string;
};

const TYPE_LABEL: Record<string, string> = {
  OP_VISIT: 'OP consultation',
  THERAPY_PACKAGE: 'Therapy package',
  THERAPY_SESSION: 'Therapy session',
  PRODUCT: 'Product',
  LAB_TEST: 'Audio test',
  OTHER: 'Service',
};

function rupees(value?: number | string) {
  const n = Number(value || 0);
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'HC';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function statusCopy(status: InvoiceStatus) {
  switch (status) {
    case 'PAID':
      return { label: 'Paid', tone: 'paid' as const };
    case 'PARTIALLY_PAID':
      return { label: 'Partially paid', tone: 'partial' as const };
    case 'PENDING':
      return { label: 'Amount due', tone: 'due' as const };
    case 'CANCELLED':
      return { label: 'Cancelled', tone: 'cancel' as const };
    case 'REFUNDED':
      return { label: 'Refunded', tone: 'refund' as const };
    default:
      return { label: String(status).replace('_', ' '), tone: 'due' as const };
  }
}

function paymentLabel(method?: string) {
  if (!method) return 'Credit';
  const labels: Record<string, string> = {
    CASH: 'Cash',
    CARD: 'Card',
    UPI: 'UPI',
    NET_BANKING: 'Net banking',
    WALLET: 'Wallet',
    OTHER: 'Other',
    Mixed: 'Mixed',
    Credit: 'Credit',
  };
  return labels[method] || method;
}

export function InvoiceDocument({ invoice, clinic }: { invoice: Invoice; clinic: InvoiceClinicProfile }) {
  const items = invoice.items || [];
  const qtyTotal = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const discountTotal = Number(invoice.discountTotal || 0);
  const taxTotal = Number(invoice.taxTotal || 0);
  const amountTotal = Number(invoice.grandTotal || 0);
  const received = Number(invoice.paidAmount || 0);
  const balance = Number(invoice.outstanding || 0);
  const lastPay = (invoice.payments || []).find((p) => p.status === 'SUCCESS');
  const paymentMode = lastPay?.method || (received > 0 ? 'Mixed' : 'Credit');
  const clinicName = clinic.clinicName?.trim() || PRODUCT_NAME;
  const mark = (clinic.clinicLogoText || initials(clinicName)).slice(0, 4);
  const title = clinic.invoiceTitle || 'Tax Invoice';
  const terms = (clinic.invoiceTerms || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const showProductCols = items.some((item) => item.model || item.serialNo || item.warranty || item.colour);
  const status = statusCopy(invoice.status);
  const issueDate = new Date(invoice.issueDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const dueDate = invoice.dueDate
    ? new Date(invoice.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  return (
    <article className="invoice-sheet">
      <header className="invoice-masthead">
        <div className="invoice-brand">
          <LetterheadMark logoUrl={clinic.clinicLogoUrl} mark={mark} />
          <div>
            <h1 className="invoice-clinic">{clinicName}</h1>
            {clinic.clinicAddress && <p className="invoice-muted">{clinic.clinicAddress}</p>}
            <p className="invoice-muted">
              {[
                clinic.clinicPhone && `Tel ${clinic.clinicPhone}`,
                clinic.clinicEmail,
              ].filter(Boolean).join('  ·  ')}
            </p>
            <p className="invoice-muted">
              {[
                clinic.clinicGstin && `GSTIN ${clinic.clinicGstin}`,
                clinic.clinicState && `State ${clinic.clinicState}`,
              ].filter(Boolean).join('  ·  ')}
            </p>
          </div>
        </div>
        <div className="invoice-title-block">
          <p className="invoice-kicker">Official billing document</p>
          <h2>{title}</h2>
          <span className={`invoice-status invoice-status--${status.tone}`}>{status.label}</span>
        </div>
      </header>

      <section className="invoice-parties">
        <div>
          <p className="invoice-label">Bill to</p>
          <p className="invoice-party-name">{invoice.patient?.name || 'Patient'}</p>
          {invoice.patient?.patientNumber && (
            <p className="invoice-muted">UHID {invoice.patient.patientNumber}</p>
          )}
          {formatPatientAddress(invoice.patient?.address) && (
            <p className="invoice-muted">{formatPatientAddress(invoice.patient?.address)}</p>
          )}
          {invoice.patient?.phone && <p className="invoice-muted">Mobile {invoice.patient.phone}</p>}
        </div>
        <dl className="invoice-meta">
          <div>
            <dt>Invoice no.</dt>
            <dd>{invoice.invoiceNumber}</dd>
          </div>
          <div>
            <dt>Issue date</dt>
            <dd>{issueDate}</dd>
          </div>
          {dueDate && (
            <div>
              <dt>Due date</dt>
              <dd>{dueDate}</dd>
            </div>
          )}
          <div>
            <dt>Payment</dt>
            <dd>{paymentLabel(paymentMode)}</dd>
          </div>
        </dl>
      </section>

      <table className="invoice-table">
        <thead>
          <tr>
            <th className="num">#</th>
            <th>Description</th>
            {showProductCols && <th>Model</th>}
            {showProductCols && <th>Serial</th>}
            {showProductCols && <th>Warranty</th>}
            {showProductCols && <th>Colour</th>}
            <th className="num">Qty</th>
            <th className="num">Rate</th>
            {discountTotal > 0 && <th className="num">Discount</th>}
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id}>
              <td className="num">{index + 1}</td>
              <td>
                <span className="invoice-item-name">{item.description}</span>
                <span className="invoice-item-type">{TYPE_LABEL[item.billableType] || item.billableType}</span>
              </td>
              {showProductCols && <td>{item.model || '—'}</td>}
              {showProductCols && <td>{item.serialNo || '—'}</td>}
              {showProductCols && <td>{item.warranty || '—'}</td>}
              {showProductCols && <td>{item.colour || '—'}</td>}
              <td className="num">{item.quantity}</td>
              <td className="num">{rupees(item.unitPrice)}</td>
              {discountTotal > 0 && <td className="num">{rupees(item.discount)}</td>}
              <td className="num strong">{rupees(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="invoice-bottom">
        <div className="invoice-words">
          <p className="invoice-label">Amount in words</p>
          <p>{amountInWordsInr(amountTotal)}</p>
          {invoice.notes && (
            <>
              <p className="invoice-label" style={{ marginTop: 16 }}>Notes</p>
              <p>{invoice.notes}</p>
            </>
          )}
          {terms.length > 0 && (
            <>
              <p className="invoice-label" style={{ marginTop: 16 }}>Terms</p>
              <ol>
                {terms.map((term) => <li key={term}>{term}</li>)}
              </ol>
            </>
          )}
        </div>
        <div className="invoice-totals">
          <div className="row"><span>Subtotal</span><span>{rupees(invoice.subtotal)}</span></div>
          {discountTotal > 0 && <div className="row"><span>Discount</span><span>− {rupees(discountTotal)}</span></div>}
          {taxTotal > 0 && <div className="row"><span>Tax</span><span>{rupees(taxTotal)}</span></div>}
          <div className="row grand"><span>Total</span><span>{rupees(amountTotal)}</span></div>
          <div className="row"><span>Received</span><span>{rupees(received)}</span></div>
          <div className={`row balance ${balance > 0 ? 'due' : 'clear'}`}>
            <span>{balance > 0 ? 'Balance due' : 'Balance'}</span>
            <span>{rupees(balance)}</span>
          </div>
          <p className="qty-note">Quantity {qtyTotal}</p>
        </div>
      </section>

      <footer className="invoice-signoff">
        <div>
          <p className="invoice-fine">This is a computer-generated invoice and does not require a physical stamp.</p>
        </div>
        <div className="invoice-sign">
          <p>For {clinicName}</p>
          <div className="sign-line" />
          <p>Authorised signatory</p>
        </div>
      </footer>
    </article>
  );
}
