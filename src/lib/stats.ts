import type { Tag, Txn } from '../types';
import { addDays, daysBetween, fromISO, toISO } from './dates';
import { round2 } from './calc';

export interface Totals {
  lifestyle: number;
  mine: number;
  covered: number;
  count: number;
}

export function totals(txns: Txn[]): Totals {
  let mine = 0;
  let covered = 0;
  for (const t of txns) {
    if (t.covered) covered += t.amount;
    else mine += t.amount;
  }
  return { lifestyle: round2(mine + covered), mine: round2(mine), covered: round2(covered), count: txns.length };
}

export interface TagRow {
  tag: Tag | null;
  mine: number;
  covered: number;
  count: number;
}

/** Spend per tag. A record with several tags counts toward each of them. */
export function byTag(txns: Txn[], tags: Tag[]): TagRow[] {
  const map = new Map<string, TagRow>();
  const tagById = new Map(tags.map((t) => [t.id, t]));
  for (const t of txns) {
    const ids = t.tagIds.filter((id) => tagById.has(id));
    for (const id of ids.length ? ids : ['__none']) {
      const row = map.get(id) ?? { tag: tagById.get(id) ?? null, mine: 0, covered: 0, count: 0 };
      if (t.covered) row.covered += t.amount;
      else row.mine += t.amount;
      row.count++;
      map.set(id, row);
    }
  }
  return [...map.values()];
}

export function hasMultiTag(txns: Txn[]): boolean {
  return txns.some((t) => t.tagIds.length > 1);
}

export function byPayer(txns: Txn[]): { name: string; amount: number; count: number }[] {
  const map = new Map<string, { amount: number; count: number }>();
  for (const t of txns) {
    if (!t.covered) continue;
    const name = t.coveredBy || 'Unspecified';
    const row = map.get(name) ?? { amount: 0, count: 0 };
    row.amount += t.amount;
    row.count++;
    map.set(name, row);
  }
  return [...map.entries()].map(([name, r]) => ({ name, ...r })).sort((a, b) => b.amount - a.amount);
}

export interface Bucket {
  key: string;
  label: string;
  /** long label for tooltips / table */
  title: string;
  mine: number;
  covered: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Daily buckets for spans up to ~2 months, monthly beyond that. */
export function timeBuckets(txns: Txn[], from: string, to: string): { unit: 'day' | 'month'; buckets: Bucket[] } {
  // clamp "all time" to the data's actual range
  if (from < '1000') from = txns.reduce((m, t) => (t.date < m ? t.date : m), to);
  if (to > '9000') to = txns.reduce((m, t) => (t.date > m ? t.date : m), from);
  if (from > to) return { unit: 'day', buckets: [] };

  const days = daysBetween(from, to);
  const unit = days <= 62 ? 'day' : 'month';
  const buckets: Bucket[] = [];
  const index = new Map<string, Bucket>();

  if (unit === 'day') {
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const dt = fromISO(d);
      const b = {
        key: d,
        label: String(dt.getDate()),
        title: dt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
        mine: 0,
        covered: 0,
      };
      buckets.push(b);
      index.set(d, b);
    }
  } else {
    const start = fromISO(from);
    const end = fromISO(to);
    for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      const key = toISO(d).slice(0, 7);
      const b = { key, label: MONTHS[d.getMonth()], title: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, mine: 0, covered: 0 };
      buckets.push(b);
      index.set(key, b);
    }
  }

  for (const t of txns) {
    const b = index.get(unit === 'day' ? t.date : t.date.slice(0, 7));
    if (!b) continue;
    if (t.covered) b.covered += t.amount;
    else b.mine += t.amount;
  }
  return { unit, buckets };
}
