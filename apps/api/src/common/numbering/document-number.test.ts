import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INVOICE_NUMBER,
  DEFAULT_PATIENT_NUMBER,
  documentNumberStem,
  formatDocumentNumber,
  invoiceNumberConfigFromSettings,
  parseSequenceFromNumber,
  patientNumberConfigFromSettings,
} from './document-number';

describe('document-number', () => {
  it('formats default patient numbers', () => {
    expect(formatDocumentNumber(DEFAULT_PATIENT_NUMBER, 1)).toBe('P000001');
    expect(formatDocumentNumber(DEFAULT_PATIENT_NUMBER, 42)).toBe('P000042');
  });

  it('formats default invoice numbers with year', () => {
    const year = 2026;
    expect(formatDocumentNumber(DEFAULT_INVOICE_NUMBER, 1, year)).toBe('INV-2026-000001');
    expect(documentNumberStem(DEFAULT_INVOICE_NUMBER, year)).toBe('INV-2026-');
  });

  it('supports custom patient format with year', () => {
    const cfg = {
      prefix: 'UHID',
      includeYear: true,
      separator: '-',
      digits: 5,
    };
    expect(formatDocumentNumber(cfg, 7, 2026)).toBe('UHID-2026-00007');
  });

  it('parses sequence from last number', () => {
    expect(parseSequenceFromNumber('INV-2026-000012', 'INV-2026-')).toBe(12);
  });

  it('reads configs from setting rows', () => {
    const patient = patientNumberConfigFromSettings([
      { key: 'patient.idPrefix', value: 'MRN' },
      { key: 'patient.idIncludeYear', value: true },
      { key: 'patient.idSeparator', value: '/' },
      { key: 'patient.idDigits', value: 4 },
    ]);
    expect(formatDocumentNumber(patient, 3, 2026)).toBe('MRN/2026/0003');

    const invoice = invoiceNumberConfigFromSettings([
      { key: 'billing.invoicePrefix', value: 'BILL' },
      { key: 'billing.invoiceIncludeYear', value: false },
      { key: 'billing.invoiceSeparator', value: '' },
      { key: 'billing.invoiceDigits', value: 5 },
    ]);
    expect(formatDocumentNumber(invoice, 9)).toBe('BILL00009');
  });
});
