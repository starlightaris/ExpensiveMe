import { useMemo } from 'react';
import { useIncome, useSettings, useTxns } from '../db';
import { dayHeading, fromISO, periodAround, type Period } from '../lib/dates';
import { money, pct } from '../lib/format';
import { round2 } from '../lib/calc';
import { INCOME_SOURCES, type Income, type Txn } from '../types';
import { PeriodPicker } from './PeriodPicker';
import { TriangleAlert } from 'lucide-react';
import { IncomeIcon } from '../lib/icons';

interface Props {
  period: Period;
  onPeriod: (p: Period) => void;
  onAdd: () => void;
  onEdit: (i: Income) => void;
}

const sourceInfo = (id: Income['source']) => INCOME_SOURCES.find((s) => s.id === id) ?? INCOME_SOURCES[2];

/** What you paid yourself: covered expenses never left your pocket */
const spentBy = (txns: Txn[]) => round2(txns.reduce((sum, t) => (t.covered ? sum : sum + t.amount), 0));
const sum = (items: Income[]) => round2(items.reduce((s, i) => s + i.amount, 0));

export function IncomeTab({ period, onPeriod, onAdd, onEdit }: Props) {
  const { currency: cur } = useSettings();
  const income = useIncome(period.from, period.to);
  const txns = useTxns(period.from, period.to);

  const cameIn = sum(income ?? []);
  const spent = spentBy(txns ?? []);
  const bySource = INCOME_SOURCES.map((s) => ({ ...s, amount: sum((income ?? []).filter((i) => i.source === s.id)) })).filter(
    (s) => s.amount > 0,
  );

  const months = useMemo(() => (period.kind === 'year' ? monthRows(income ?? [], txns ?? [], period.from) : []), [income, txns, period]);
  const sorted = useMemo(
    () => [...(income ?? [])].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1)),
    [income],
  );

  const loaded = income !== undefined && txns !== undefined;
  const periodWord = period.kind === 'year' ? 'this year' : 'this month';

  return (
    <div className="space-y-4">
      <PeriodPicker period={period} onChange={onPeriod} kinds={['month', 'year']} />

      <section className="hero rounded-3xl p-5">
        <Line label="Came in" value={money(cameIn, cur)} strong />
        {bySource.length > 0 && (
          <ul className="tabular mt-1 mb-1 space-y-0.5 pl-1 text-sm text-ink-2">
            {bySource.map((s) => (
              <li key={s.id} className="flex justify-between">
                <span className="flex items-center gap-2">
                  <IncomeIcon source={s.id} size={15} />
                  {s.label}
                </span>
                <span>{money(s.amount, cur)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2">
          <Line label="Spent" hint="What you paid yourself" value={money(spent, cur)} strong />
        </div>

        <div className="my-4 border-t border-line" />
        <Balance cameIn={cameIn} spent={spent} currency={cur} />
      </section>

      {period.kind === 'year' ? (
        <section className="rounded-3xl border border-line bg-surface p-5">
          <h2 className="mb-2 font-semibold">Month by month</h2>
          {months.length === 0 ? (
            <p className="text-sm text-muted">Nothing recorded {periodWord}.</p>
          ) : (
            <table className="tabular w-full text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="py-1 text-left font-normal">Month</th>
                  <th className="py-1 text-right font-normal">In</th>
                  <th className="py-1 text-right font-normal">Spent</th>
                  <th className="py-1 text-right font-normal">Left</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr
                    key={m.key}
                    className="cursor-pointer border-t border-line active:bg-surface-2"
                    onClick={() => onPeriod(periodAround('month', `${m.key}-01`))}
                  >
                    <td className="py-2 font-medium">{m.label}</td>
                    <td className="py-2 text-right">{plain(m.cameIn)}</td>
                    <td className="py-2 text-right">{plain(m.spent)}</td>
                    <td className={`py-2 text-right font-semibold ${m.cameIn - m.spent < 0 ? 'text-danger' : ''}`}>
                      {m.cameIn - m.spent < 0 ? '−' : ''}
                      {plain(Math.abs(m.cameIn - m.spent))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {months.length > 0 && <p className="mt-2 text-xs text-muted">Tap a month to open it.</p>}
        </section>
      ) : (
        loaded &&
        (sorted.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-line p-8 text-center">
            <p className="font-medium">No income recorded {periodWord}</p>
            <p className="mt-1 text-sm text-ink-2">Add your salary and any money from home to see what’s left over.</p>
            <button onClick={onAdd} className="mt-4 min-h-11 rounded-full bg-accent px-5 font-semibold text-accent-ink">
              Add income
            </button>
          </section>
        ) : (
          <section>
            <h2 className="mb-1.5 px-1 text-xs font-semibold tracking-wide text-ink-2 uppercase">Income {periodWord}</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {sorted.map((i) => {
                const s = sourceInfo(i.source);
                return (
                  <li key={i.id}>
                    <button onClick={() => onEdit(i)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2">
                        <IncomeIcon source={i.source} size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{i.note || s.label}</span>
                        <span className="block truncate text-xs text-muted">
                          {i.note ? `${s.label} · ` : ''}
                          {dayHeading(i.date)}
                        </span>
                      </span>
                      <span className="tabular shrink-0 font-semibold">+ {money(i.amount, cur)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function Line({ label, hint, value, strong }: { label: string; hint?: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div>
        <div className={strong ? 'font-medium' : ''}>{label}</div>
        {hint && <div className="text-xs text-muted">{hint}</div>}
      </div>
      <div className={`tabular ${strong ? 'text-lg font-semibold' : ''}`}>{value}</div>
    </div>
  );
}

function Balance({ cameIn, spent, currency }: { cameIn: number; spent: number; currency: string }) {
  const left = round2(cameIn - spent);
  const over = left < 0;
  const share = cameIn > 0 ? Math.min(1, spent / cameIn) : 0;

  if (cameIn === 0) {
    return (
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">Left over</span>
        <span className="text-sm text-muted">Add income to see this</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">{over ? 'Overspent' : 'Left over'}</span>
        <span className={`tabular text-3xl font-bold tracking-tight ${over ? 'text-covered' : ''}`}>{money(Math.abs(left), currency)}</span>
      </div>
      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div className={`h-full rounded-full ${over ? 'bg-covered' : 'bg-positive'}`} style={{ width: `${share * 100}%` }} />
      </div>
      <p className="mt-2 text-xs text-ink-2">
        {over ? (
          <span className="inline-flex items-center gap-1.5">
            <TriangleAlert size={14} aria-hidden />
            You spent {money(-left, currency)} more than came in.
          </span>
        ) : (
          `You’ve spent ${pct(spent, cameIn)} of what came in.`
        )}
      </p>
    </div>
  );
}

const plainFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const plain = (n: number) => plainFmt.format(n);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** One row per month that has any income or spending, newest first */
function monthRows(income: Income[], txns: Txn[], yearFrom: string) {
  const year = fromISO(yearFrom).getFullYear();
  const rows = MONTHS.map((label, m) => ({ key: `${year}-${String(m + 1).padStart(2, '0')}`, label, cameIn: 0, spent: 0 }));
  for (const i of income) rows[Number(i.date.slice(5, 7)) - 1].cameIn += i.amount;
  for (const t of txns) if (!t.covered) rows[Number(t.date.slice(5, 7)) - 1].spent += t.amount;
  return rows.filter((r) => r.cameIn > 0 || r.spent > 0).reverse();
}
