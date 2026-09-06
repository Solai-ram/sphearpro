/** Minimal PDF 1.4 writer for clinic invoices/receipts (Helvetica, ASCII). */

function pdfEscape(value: string) {
  return value
    .replace(/₹/g, 'Rs ')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

export function buildTextPdf(title: string, lines: string[]): Buffer {
  const wrapped: string[] = [];
  for (const line of lines) {
    const text = line || ' ';
    for (let i = 0; i < text.length; i += 95) {
      wrapped.push(text.slice(i, i + 95));
    }
  }

  const chunks: string[] = [
    'BT',
    '/F1 16 Tf',
    '50 800 Td',
    `(${pdfEscape(title)}) Tj`,
    '/F1 10 Tf',
  ];
  let y = 800;
  for (const line of wrapped) {
    y -= 14;
    if (y < 50) break;
    chunks.push('0 -14 Td', `(${pdfEscape(line)}) Tj`);
  }
  chunks.push('ET');
  const stream = chunks.join('\n');
  const streamBytes = Buffer.byteLength(stream, 'latin1');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 5 0 R /Resources << /Font << /F1 4 0 R >> >> >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${streamBytes} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}
