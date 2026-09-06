export function dobFromAgeYears(age: number): string {
  const year = new Date().getFullYear() - Math.max(0, Math.floor(age));
  return `${year}-01-01`;
}

export function ageFromDob(dob?: string | Date | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const month = now.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age < 0 ? 0 : age;
}

export function formatAddress(address?: Record<string, string | undefined> | null): string {
  if (!address) return '';
  if (address.line?.trim()) return address.line.trim();
  return [address.street, address.city, address.state, address.pincode, address.country]
    .filter(Boolean)
    .join(', ');
}
