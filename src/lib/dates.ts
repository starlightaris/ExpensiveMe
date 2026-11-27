export type PeriodKind = 'week' | 'month' | 'year' | 'all' | 'custom';

export interface Period {
  kind: PeriodKind;
  /** inclusive YYYY-MM-DD */
  from: string;
  /** inclusive YYYY-MM-DD */
  to: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const today = () => toISO(new Date());

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Period of `kind` containing the date `anchor` */
export function periodAround(kind: PeriodKind, anchor: string): Period {
  const d = fromISO(anchor);
  if (kind === 'week') {
    const dow = (d.getDay() + 6) % 7; // Monday = 0
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    return { kind, from: toISO(start), to: toISO(end) };
  }
  if (kind === 'month') {
    return {
      kind,
      from: toISO(new Date(d.getFullYear(), d.getMonth(), 1)),
      to: toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
    };
  }
  if (kind === 'year') {
    return { kind, from: `${d.getFullYear()}-01-01`, to: `${d.getFullYear()}-12-31` };
  }
  if (kind === 'all') return { kind, from: '0000-01-01', to: '9999-12-31' };
  return { kind, from: anchor, to: anchor };
}

/** Move a week/month/year period back (-1) or forward (+1) */
export function shiftPeriod(p: Period, dir: -1 | 1): Period {
  const d = fromISO(p.from);
  if (p.kind === 'week') return periodAround('week', addDays(p.from, 7 * dir));
  if (p.kind === 'month') return periodAround('month', toISO(new Date(d.getFullYear(), d.getMonth() + dir, 1)));
  if (p.kind === 'year') return periodAround('year', `${d.getFullYear() + dir}-01-01`);
  return p;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function shortDate(iso: string, withYear = false): string {
  const d = fromISO(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${withYear ? ' ' + d.getFullYear() : ''}`;
}

export function periodLabel(p: Period): string {
  const f = fromISO(p.from);
  if (p.kind === 'all') return 'All time';
  if (p.kind === 'year') return String(f.getFullYear());
  if (p.kind === 'month') return `${MONTHS[f.getMonth()]} ${f.getFullYear()}`;
  const sameYear = p.from.slice(0, 4) === p.to.slice(0, 4);
  return `${shortDate(p.from, !sameYear)} – ${shortDate(p.to, true)}`;
}

export function dayHeading(iso: string): string {
  const t = today();
  if (iso === t) return 'Today';
  if (iso === addDays(t, -1)) return 'Yesterday';
  const d = fromISO(iso);
  const wd = d.toLocaleDateString(undefined, { weekday: 'short' });
  return `${wd}, ${shortDate(iso, iso.slice(0, 4) !== t.slice(0, 4))}`;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((fromISO(to).getTime() - fromISO(from).getTime()) / 86400000) + 1;
}
