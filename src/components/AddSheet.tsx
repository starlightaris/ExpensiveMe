import { useCallback, useMemo, useState } from 'react';
import { computeAmount, deleteTxn, saveTxn, useAllTxns, useSettings, useTags } from '../db';
import { evaluate, hasOperator } from '../lib/calc';
import { today } from '../lib/dates';
import { money, num, uid } from '../lib/format';
import type { Txn } from '../types';
import { applyKey, Keypad, type KeyValue } from './Keypad';
import { Sheet } from './Sheet';
import { toast } from './Toast';

export interface Draft {
  /** existing record being edited, if any */
  txn?: Txn;
  /** prefill for a new record (duplicate, calculator hand-off) */
  prefill?: Partial<Txn>;
}

interface Props {
  draft: Draft;
  onClose: () => void;
  onDuplicate: (t: Txn) => void;
}

export function AddSheet({ draft, onClose, onDuplicate }: Props) {
  const settings = useSettings();
  const tags = useTags();
  const all = useAllTxns();
  const src = draft.txn ?? draft.prefill;
  const editing = !!draft.txn;

  const [expr, setExpr] = useState(src?.baseAmount ? String(src.baseAmount) : '');
  const [tagIds, setTagIds] = useState<string[]>(src?.tagIds ?? []);
  const [serviceCharge, setServiceCharge] = useState(src?.serviceCharge ?? false);
  const [covered, setCovered] = useState(src?.covered ?? false);
  const [coveredBy, setCoveredBy] = useState(src?.coveredBy ?? '');
  const [date, setDate] = useState(src?.date ?? today());
  const [note, setNote] = useState(src?.note ?? '');
  const [padOpen, setPadOpen] = useState(!editing);
  const [error, setError] = useState('');

  // keep the rate a record was saved with; new records use the current setting
  const rate = draft.txn?.serviceRate ?? settings.serviceRate;
  const base = evaluate(expr);
  const scAvailable = tags.some((t) => t.serviceCharge && tagIds.includes(t.id));
  const scOn = scAvailable && serviceCharge;
  const total = base !== null ? computeAmount(base, scOn, rate) : null;

  const payers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of all ?? []) if (t.covered && t.coveredBy) counts.set(t.coveredBy, (counts.get(t.coveredBy) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n]) => n);
  }, [all]);

  const onKey = useCallback(
    (k: KeyValue) => {
      setError('');
      setExpr((e) => applyKey(e, k, evaluate(e)));
    },
    [],
  );

  const toggleTag = (id: string) => setTagIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  async function save() {
    if (base === null || base <= 0) {
      setError(expr ? 'That sum doesn’t work out — check the amount.' : 'Enter an amount.');
      setPadOpen(true);
      return;
    }
    if (!date) {
      setError('Pick a date.');
      return;
    }
    const now = Date.now();
    const t: Txn = {
      id: draft.txn?.id ?? uid(),
      date,
      note: note.trim().slice(0, 300),
      tagIds,
      baseAmount: base,
      serviceCharge: scOn,
      serviceRate: rate,
      amount: computeAmount(base, scOn, rate),
      covered,
      coveredBy: covered ? coveredBy.trim().slice(0, 60) : '',
      createdAt: draft.txn?.createdAt ?? now,
      updatedAt: now,
    };
    await saveTxn(t);
    toast(editing ? 'Saved' : `Added ${money(t.amount, settings.currency)}`);
    onClose();
  }

  async function remove() {
    if (!draft.txn) return;
    const t = draft.txn;
    await deleteTxn(t.id);
    onClose();
    toast('Deleted', { label: 'Undo', run: () => saveTxn(t) });
  }

  const showFormula = base !== null && (hasOperator(expr) || scOn);

  return (
    <Sheet
      title={editing ? 'Edit expense' : 'New expense'}
      onClose={onClose}
      action={
        <button onClick={save} className="min-h-11 rounded-full bg-accent px-4 font-semibold text-accent-ink active:opacity-80">
          Save
        </button>
      }
      footer={padOpen ? <Keypad onKey={onKey} /> : undefined}
      top={
        <>
      <button
        type="button"
        onClick={() => {
          (document.activeElement as HTMLElement | null)?.blur();
          setPadOpen(true);
        }}
        className={`mt-1 w-full rounded-2xl border-2 px-4 py-3 text-right transition ${
          padOpen ? 'border-accent bg-surface' : 'border-line bg-surface-2'
        }`}
        aria-label="Amount"
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-muted">{settings.currency}</span>
          <span className={`tabular min-w-0 truncate text-3xl font-semibold ${expr ? 'text-ink' : 'text-muted'}`}>
            {expr || '0'}
            {padOpen && <span className="ml-0.5 inline-block h-7 w-0.5 translate-y-1 animate-pulse bg-accent" />}
          </span>
        </span>
        <span className="tabular mt-1 block min-h-5 text-sm text-ink-2">
          {showFormula && base !== null && (
            <>
              {scOn ? (
                <>
                  {num(base)} + {rate}% service = <strong className="text-ink">{money(total!, settings.currency)}</strong>
                </>
              ) : (
                <>= {num(base)}</>
              )}
            </>
          )}
          {expr && base === null && <span className="text-muted">…</span>}
        </span>
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}

        </>
      }
    >
      {/* Tags */}
      <section className="mt-2">
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Tags</h3>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => {
            const on = tagIds.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTag(t.id)}
                aria-pressed={on}
                className={`min-h-10 rounded-full border px-3 text-sm transition ${
                  on ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink'
                }`}
              >
                <span className="mr-1">{t.emoji}</span>
                {t.name}
              </button>
            );
          })}
        </div>
        {scAvailable && (
          <button
            type="button"
            onClick={() => setServiceCharge((v) => !v)}
            aria-pressed={scOn}
            className={`mt-3 flex min-h-11 w-full items-center justify-between rounded-xl border px-3 text-sm transition ${
              scOn ? 'border-accent bg-accent/10' : 'border-dashed border-line'
            }`}
          >
            <span>
              <span className="mr-1.5">🧾</span>Add {rate}% service charge
            </span>
            <Switch on={scOn} />
          </button>
        )}
      </section>

      {/* Covered */}
      <section className="mt-4 rounded-2xl bg-surface-2 p-1">
        <button
          type="button"
          onClick={() => setCovered((v) => !v)}
          aria-pressed={covered}
          className="flex min-h-12 w-full items-center justify-between rounded-xl px-3 text-left"
        >
          <span>
            <span className="block font-medium">Covered by someone else</span>
            <span className="block text-xs text-muted">Counts toward how expensive you are, not what you paid</span>
          </span>
          <Switch on={covered} color="covered" />
        </button>
        {covered && (
          <div className="px-3 pt-1 pb-3">
            <input
              value={coveredBy}
              onChange={(e) => setCoveredBy(e.target.value)}
              onFocus={() => setPadOpen(false)}
              placeholder="Who covered it? (optional)"
              maxLength={60}
              className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 outline-none focus:border-accent"
            />
            {payers.length > 0 && (
              <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
                {payers.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCoveredBy(p)}
                    className={`min-h-9 shrink-0 rounded-full border px-3 text-sm ${
                      coveredBy === p ? 'border-covered text-ink' : 'border-line text-ink-2'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Date + note */}
      <section className="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
        <label htmlFor="txn-date" className="text-sm text-ink-2">
          Date
        </label>
        <div className="flex gap-2">
          <input
            id="txn-date"
            type="date"
            value={date}
            max="9999-12-31"
            onChange={(e) => setDate(e.target.value)}
            onFocus={() => setPadOpen(false)}
            className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 outline-none focus:border-accent"
          />
          {date !== today() && (
            <button type="button" onClick={() => setDate(today())} className="min-h-11 rounded-xl px-2 text-sm text-accent">
              Today
            </button>
          )}
        </div>
        <label htmlFor="txn-note" className="text-sm text-ink-2">
          Note
        </label>
        <input
          id="txn-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onFocus={() => setPadOpen(false)}
          placeholder="e.g. Lunch at Café"
          maxLength={300}
          enterKeyHint="done"
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 outline-none focus:border-accent"
        />
      </section>

      {editing && (
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              onDuplicate(draft.txn!);
            }}
            className="min-h-11 rounded-xl border border-line text-sm font-medium"
          >
            Duplicate for today
          </button>
          <button type="button" onClick={remove} className="min-h-11 rounded-xl border border-danger/40 text-sm font-medium text-danger">
            Delete
          </button>
        </div>
      )}
    </Sheet>
  );
}

export function Switch({ on, color = 'accent' }: { on: boolean; color?: 'accent' | 'covered' }) {
  return (
    <span
      aria-hidden
      className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition ${
        on ? (color === 'covered' ? 'bg-covered' : 'bg-accent') : 'bg-line'
      }`}
    >
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </span>
  );
}
