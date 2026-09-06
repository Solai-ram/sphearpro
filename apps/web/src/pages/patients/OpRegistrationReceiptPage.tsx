import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import { clinicalApi } from '../../services/clinical';
import { patientsApi } from '../../services/patients';
import { billingApi } from '../../services/billing';
import { settingsApi } from '../../services/admin';
import type { OpCase } from '../../types/clinical';
import { PRODUCT_MARK, PRODUCT_NAME } from '../../lib/product';
import { ageFromDob, formatAddress } from '../../lib/age';

type ClinicInfo = {
  name: string;
  mark: string;
  address?: string;
  phone?: string;
  email?: string;
};

type PatientCard = {
  name?: string;
  patientNumber?: string;
  phone?: string;
  email?: string;
  gender?: string;
  dateOfBirth?: string;
  address?: Record<string, string>;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return PRODUCT_MARK;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function displayName(name?: string) {
  if (!name) return '—';
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function genderLabel(value?: string) {
  if (!value || value === 'UNKNOWN') return '';
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="op-receipt-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function OpRegistrationReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const isReview = params.get('type') === 'review';
  const [opCase, setOpCase] = useState<OpCase | null>(null);
  const [patient, setPatient] = useState<PatientCard | null>(null);
  const [clinic, setClinic] = useState<ClinicInfo>({ name: PRODUCT_NAME, mark: PRODUCT_MARK });
  const [consultation, setConsultation] = useState<{ fee: number; method?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const record = await clinicalApi.getById(id);
        setOpCase(record);
        const extra = await patientsApi.getById<PatientCard>(record.patientId).catch(() => record.patient);
        setPatient({
          name: extra?.name || record.patient?.name,
          patientNumber: extra?.patientNumber || record.patient?.patientNumber,
          phone: extra?.phone || record.patient?.phone,
          email: extra?.email || record.patient?.email,
          gender: extra?.gender || record.patient?.gender,
          dateOfBirth: extra?.dateOfBirth || record.patient?.dateOfBirth,
          address: extra?.address || record.patient?.address,
        });
        const invoices = await billingApi.getInvoices({ patientId: record.patientId, limit: 20 }).catch(() => null);
        const billed = invoices?.data?.find((inv) =>
          inv.items?.some((item) => item.billableType === 'OP_VISIT' && item.referenceId === record.id),
        );
        const feeItem = billed?.items?.find((item) => item.billableType === 'OP_VISIT' && item.referenceId === record.id);
        if (feeItem) {
          setConsultation({
            fee: Number(feeItem.lineTotal || feeItem.unitPrice || 0),
            method: billed?.payments?.[0]?.method,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load registration');
      }
    })();
    settingsApi.list().then((rows) => {
      const map: Record<string, string> = {};
      for (const row of rows) {
        map[row.key] = typeof row.value === 'string' || typeof row.value === 'number' ? String(row.value) : '';
      }
      const name = map['clinic.name'] || PRODUCT_NAME;
      setClinic({
        name,
        mark: (map['clinic.logoText'] || initials(name)).slice(0, 4),
        address: map['clinic.address'] || undefined,
        phone: map['clinic.phone'] || undefined,
        email: map['clinic.email'] || undefined,
      });
    }).catch(() => undefined);
  }, [id]);

  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!opCase || !patient) {
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const age = ageFromDob(patient.dateOfBirth);
  const when = new Date(opCase.createdAt);
  const title = isReview ? 'OP Review Receipt' : 'OP Registration Receipt';
  const visitLabel = isReview ? 'Review visit' : 'New registration';
  const address = formatAddress(patient.address);
  const gender = genderLabel(patient.gender);

  return (
    <div className="invoice-preview">
      <div className="invoice-toolbar print:hidden">
        <Link to="/patients" className="btn-secondary">
          <ArrowLeft className="w-4 h-4 mr-2" /> Patients
        </Link>
        <div className="invoice-toolbar-copy">
          <p>{title}</p>
          <span>{patient.patientNumber} · {displayName(patient.name)}</span>
        </div>
        <button className="btn-primary" type="button" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-2" /> Print receipt
        </button>
      </div>

      <article className="invoice-sheet op-receipt-sheet">
        <header className="invoice-masthead">
          <div className="invoice-brand">
            <div className="invoice-mark" aria-hidden="true">{clinic.mark}</div>
            <div>
              <h1 className="invoice-clinic">{clinic.name}</h1>
              {clinic.address && <p className="invoice-muted">{clinic.address}</p>}
              <p className="invoice-muted">
                {[clinic.phone && `Tel ${clinic.phone}`, clinic.email].filter(Boolean).join('  ·  ')}
              </p>
            </div>
          </div>
          <div className="invoice-title-block">
            <p className="invoice-kicker">Outpatient desk</p>
            <h2>{title}</h2>
            <span className={`op-receipt-badge ${isReview ? 'is-review' : 'is-new'}`}>{visitLabel}</span>
          </div>
        </header>

        <div className="op-receipt-idbar">
          <div>
            <span>Patient ID</span>
            <strong>{patient.patientNumber || '—'}</strong>
          </div>
          <div>
            <span>Registered</span>
            <strong>
              {when.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              {' · '}
              {when.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </strong>
          </div>
        </div>

        <div className="op-receipt-body">
          <section>
            <p className="invoice-label">Patient</p>
            <p className="op-receipt-name">{displayName(patient.name)}</p>
            <div className="op-receipt-fields">
              <Field label="Age" value={age == null ? null : `${age} years`} />
              <Field label="Gender" value={gender} />
              <Field label="Phone" value={patient.phone} />
              <Field label="Email" value={patient.email} />
              <Field label="Address" value={address} />
            </div>
          </section>
          <section>
            <p className="invoice-label">Visit</p>
            <div className="op-receipt-fields">
              <Field label="Type" value={isReview ? 'OP review' : 'New OP registration'} />
              {consultation && (
                <Field
                  label="Consultation fee"
                  value={`₹${consultation.fee.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${consultation.method ? ` · ${consultation.method}` : ''}`}
                />
              )}
            </div>
          </section>
        </div>

        <footer className="op-receipt-foot">
          <p>Please keep this receipt for your next visit.</p>
          <div className="invoice-sign">
            <div className="sign-line" />
            <span>Authorised signatory</span>
          </div>
        </footer>
      </article>
    </div>
  );
}
