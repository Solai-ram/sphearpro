const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function chunk(n: number): string {
  if (n === 0) return '';
  if (n < 20) return ONES[n];
  if (n < 100) return `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`.trim();
  return `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ' and ' + chunk(n % 100) : ''}`;
}

export function amountInWordsInr(amount: number): string {
  const rupees = Math.floor(Math.abs(amount) + 1e-9);
  const paise = Math.round((Math.abs(amount) - rupees) * 100);
  if (rupees === 0 && paise === 0) return 'Zero Rupees only';
  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const rest = rupees % 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${chunk(crore)} Crore`);
  if (lakh) parts.push(`${chunk(lakh)} Lakh`);
  if (thousand) parts.push(`${chunk(thousand)} Thousand`);
  if (rest) parts.push(chunk(rest));
  let text = `${parts.join(' ')} Rupees`.replace(/\s+/g, ' ').trim();
  if (paise) text += ` and ${chunk(paise)} Paisa`;
  return `${text} only`;
}

export function formatPatientAddress(address: unknown): string {
  if (!address) return '';
  if (typeof address === 'string') return address;
  if (typeof address === 'object') {
    const a = address as Record<string, string>;
    return [a.street, a.area, a.city, a.state, a.pincode, a.country].filter(Boolean).join(', ');
  }
  return '';
}
