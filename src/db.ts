import Dexie, { type Table } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { DEFAULT_SETTINGS, INCOME_SOURCES, THEMES, type Income, type IncomeSource, type Settings, type Tag, type Theme, type Txn } from './types';
import { round2 } from './lib/calc';
import { uid } from './lib/format';
import { DEFAULT_TAG_ICON, TAG_ICON_KEYS } from './lib/icons';

interface SettingRow {
  key: 'settings';
  value: Settings;
}

class ExpensiveDB extends Dexie {
  transactions!: Table<Txn, string>;
  tags!: Table<Tag, string>;
  settings!: Table<SettingRow, string>;
  income!: Table<Income, string>;

  constructor() {
    super('expensiveme');
    this.version(1).stores({
      transactions: 'id, date, covered, *tagIds, createdAt',
      tags: 'id, order',
      settings: 'key',
    });
    // v2: money coming in, kept in its own table
    this.version(2).stores({ income: 'id, date' });
    this.on('populate', (tx) => {
      tx.table('tags').bulkAdd(defaultTags());
      tx.table('settings').add({ key: 'settings', value: DEFAULT_SETTINGS });
    });
  }
}

export const db = new ExpensiveDB();

function defaultTags(): Tag[] {
  const list: [string, string, boolean][] = [
    ['Food', 'utensils', true],
    ['Snacks', 'cookie', false],
    ['Transport', 'bus', false],
    ['Clothes', 'shirt', false],
    ['Bills', 'receipt', false],
    ['Health', 'pill', false],
    ['Fun', 'film', false],
    ['Other', 'package', false],
  ];
  return list.map(([name, icon, serviceCharge], order) => ({ id: uid(), name, icon, serviceCharge, order }));
}

/* ---------- hooks ---------- */

export function useSettings(): Settings {
  const row = useLiveQuery(() => db.settings.get('settings'), []);
  return { ...DEFAULT_SETTINGS, ...(row?.value ?? {}) };
}

/** The saved theme, or undefined while the database is still loading */
export function useThemeSetting(): Theme | undefined {
  const row = useLiveQuery(() => db.settings.get('settings').then((r) => r ?? null), []);
  if (row === undefined) return undefined;
  return row?.value.theme ?? DEFAULT_SETTINGS.theme;
}

export function useTags(): Tag[] {
  return useLiveQuery(() => db.tags.orderBy('order').toArray(), []) ?? [];
}

export function useTxns(from: string, to: string): Txn[] | undefined {
  return useLiveQuery(() => db.transactions.where('date').between(from, to, true, true).toArray(), [from, to]);
}

export function useAllTxns(): Txn[] | undefined {
  return useLiveQuery(() => db.transactions.toArray(), []);
}

export function useIncome(from: string, to: string): Income[] | undefined {
  return useLiveQuery(() => db.income.where('date').between(from, to, true, true).toArray(), [from, to]);
}

/* ---------- writes ---------- */

export async function saveSettings(patch: Partial<Settings>) {
  const cur = (await db.settings.get('settings'))?.value ?? DEFAULT_SETTINGS;
  await db.settings.put({ key: 'settings', value: { ...cur, ...patch } });
}

export function computeAmount(base: number, serviceCharge: boolean, rate: number): number {
  return serviceCharge ? round2(base * (1 + rate / 100)) : round2(base);
}

export async function saveTxn(t: Txn) {
  await db.transactions.put({ ...t, updatedAt: Date.now() });
}

export async function deleteTxn(id: string) {
  await db.transactions.delete(id);
}

export async function saveIncome(i: Income) {
  await db.income.put({ ...i, updatedAt: Date.now() });
}

export async function deleteIncome(id: string) {
  await db.income.delete(id);
}

export async function saveTag(tag: Tag) {
  await db.tags.put(tag);
}

/** Delete a tag and remove it from every record that uses it */
export async function deleteTag(id: string) {
  await db.transaction('rw', db.tags, db.transactions, async () => {
    await db.tags.delete(id);
    await db.transactions
      .where('tagIds')
      .equals(id)
      .modify((t) => {
        t.tagIds = t.tagIds.filter((x) => x !== id);
      });
  });
}

export async function eraseAll() {
  await db.transaction('rw', [db.tags, db.transactions, db.settings, db.income], async () => {
    await db.transactions.clear();
    await db.income.clear();
    await db.tags.clear();
    await db.settings.clear();
    await db.tags.bulkAdd(defaultTags());
    await db.settings.add({ key: 'settings', value: DEFAULT_SETTINGS });
  });
}

/* ---------- backup ---------- */

export interface Backup {
  app: 'expensiveme';
  version: 1;
  exportedAt: string;
  settings: Settings;
  tags: Tag[];
  transactions: Txn[];
  /** absent in backups made before income existed */
  income: Income[];
}

export async function exportBackup(): Promise<Backup> {
  const [settings, tags, transactions, income] = await Promise.all([
    db.settings.get('settings'),
    db.tags.toArray(),
    db.transactions.toArray(),
    db.income.toArray(),
  ]);
  return {
    app: 'expensiveme',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: settings?.value ?? DEFAULT_SETTINGS,
    tags,
    transactions,
    income,
  };
}

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');
const numOr = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Validate untrusted JSON field by field; anything malformed is dropped, never stored as-is. */
export function parseBackup(raw: unknown): Backup {
  if (!raw || typeof raw !== 'object') throw new Error('Not a valid backup file.');
  const r = raw as Record<string, unknown>;
  if (r.app !== 'expensiveme') throw new Error('This file is not an ExpensiveMe backup.');
  if (!Array.isArray(r.tags) || !Array.isArray(r.transactions)) throw new Error('Backup is missing data.');

  const tags: Tag[] = (r.tags as unknown[])
    .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
    .map((t, i) => ({
      id: str(t.id, 64),
      name: str(t.name, 40).trim(),
      icon: TAG_ICON_KEYS.includes(t.icon as string) ? (t.icon as string) : DEFAULT_TAG_ICON,
      serviceCharge: t.serviceCharge === true,
      order: numOr(t.order, i),
    }))
    .filter((t) => t.id && t.name);

  const transactions: Txn[] = (r.transactions as unknown[])
    .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
    .map((t) => {
      const baseAmount = round2(numOr(t.baseAmount, numOr(t.amount, 0)));
      const serviceCharge = t.serviceCharge === true;
      const serviceRate = numOr(t.serviceRate, 10);
      return {
        id: str(t.id, 64),
        date: str(t.date, 10),
        note: str(t.note, 300),
        tagIds: Array.isArray(t.tagIds) ? t.tagIds.map((x) => str(x, 64)).filter(Boolean) : [],
        baseAmount,
        serviceCharge,
        serviceRate,
        amount: computeAmount(baseAmount, serviceCharge, serviceRate),
        covered: t.covered === true,
        coveredBy: str(t.coveredBy, 60),
        createdAt: numOr(t.createdAt, Date.now()),
        updatedAt: numOr(t.updatedAt, Date.now()),
      };
    })
    .filter((t) => t.id && ISO_DATE.test(t.date) && t.baseAmount >= 0);

  const sourceIds = INCOME_SOURCES.map((x) => x.id) as string[];
  const income: Income[] = (Array.isArray(r.income) ? (r.income as unknown[]) : [])
    .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
    .map((t) => ({
      id: str(t.id, 64),
      date: str(t.date, 10),
      amount: round2(numOr(t.amount, 0)),
      source: (sourceIds.includes(t.source as string) ? t.source : 'other') as IncomeSource,
      note: str(t.note, 300),
      createdAt: numOr(t.createdAt, Date.now()),
      updatedAt: numOr(t.updatedAt, Date.now()),
    }))
    .filter((t) => t.id && ISO_DATE.test(t.date) && t.amount > 0);

  const s = (r.settings ?? {}) as Record<string, unknown>;
  const settings: Settings = {
    currency: str(s.currency, 6) || DEFAULT_SETTINGS.currency,
    serviceRate: Math.min(100, Math.max(0, numOr(s.serviceRate, DEFAULT_SETTINGS.serviceRate))),
    theme: THEMES.includes(s.theme as Theme) ? (s.theme as Theme) : DEFAULT_SETTINGS.theme,
  };

  return { app: 'expensiveme', version: 1, exportedAt: str(r.exportedAt, 40), settings, tags, transactions, income };
}

/** Merge a backup into the current data: records with the same id are replaced, others added. */
export async function importBackup(b: Backup) {
  await db.transaction('rw', [db.tags, db.transactions, db.settings, db.income], async () => {
    // A tag with the same name but a different id (e.g. default tags created on another
    // device) is mapped onto the existing tag instead of creating a duplicate.
    const existing = await db.tags.toArray();
    const byName = new Map(existing.map((t) => [t.name.toLowerCase(), t.id]));
    const remap = new Map<string, string>();
    const newTags: Tag[] = [];
    for (const t of b.tags) {
      const match = byName.get(t.name.toLowerCase());
      if (match && match !== t.id) remap.set(t.id, match);
      else newTags.push(t);
    }
    await db.tags.bulkPut(newTags);
    await db.transactions.bulkPut(
      b.transactions.map((t) => ({ ...t, tagIds: [...new Set(t.tagIds.map((id) => remap.get(id) ?? id))] })),
    );
    await db.income.bulkPut(b.income);
    await db.settings.put({ key: 'settings', value: b.settings });
  });
}
