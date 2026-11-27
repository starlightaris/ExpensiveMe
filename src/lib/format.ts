const nf = new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const nfCompact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

export function money(n: number, currency: string): string {
  const s = nf.format(Math.abs(n));
  const sign = n < 0 ? '−' : '';
  return currency ? `${sign}${currency} ${s}` : `${sign}${s}`;
}

export function num(n: number): string {
  return nf.format(n);
}

export function compact(n: number): string {
  return nfCompact.format(n);
}

export function pct(part: number, whole: number): string {
  if (!whole) return '0%';
  return `${Math.round((part / whole) * 100)}%`;
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
