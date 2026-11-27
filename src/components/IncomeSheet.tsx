import { useCallback, useState } from 'react';
import { deleteIncome, saveIncome, useSettings } from '../db';
import { evaluate, hasOperator } from '../lib/calc';
import { today } from '../lib/dates';
import { money, num, uid } from '../lib/format';
import { INCOME_SOURCES, type Income, type IncomeSource } from '../types';
import { applyKey, Keypad, type KeyValue } from './Keypad';
import { Sheet } from './Sheet';
import { toast } from './Toast';

interface Props {
  /** existing entry being edited; undefined for a new one */
  income?: Income;
  onClose: () => void;
}

export function IncomeSheet({ income, onClose }: Props) {
  const settings = useSettings();
  const editing = !!income;

  const [expr, setExpr] = useState(income ? String(income.amount) : '');
  const [source, setSource] = useState<IncomeSource>(income?.source ?? 'salary');
  const [date, setDate] = useState(income?.date ?? today());
  const [note, setNote] = useState(income?.note ?? '');
  const [padOpen, setPadOpen] = useState(!editing);
  const [error, setError] = useState('');

  const amount = evaluate(expr);

  const onKey = useCallback((k: KeyValue) => {
    setError('');
    setExpr((e) => applyKey(e, k, evaluate(e)));
  }, []);

  async function save() {
    if (amount === null || amount <= 0) {
      setError(expr ? 'That sum doesn’t work out — check the amount.' : 'Enter an amount.');
      setPadOpen(true);
      return;
    }
    if (!date) {
      setError('Pick a date.');
      return;
    }
    const now = Date.now();
    await saveIncome({
      id: income?.id ?? uid(),
      date,
      amount,
      source,
      note: note.trim().slice(0, 300),
      createdAt: income?.createdAt ?? now,
      updatedAt: now,
    });
    toast(editing ? 'Saved' : `Added ${money(amount, settings.currency)} income`);
    onClose();
  }

  async function remove() {
    if (!income) return;
    await deleteIncome(income.id);
    onClose();
    toast('Deleted', { label: 'Undo', run: () => saveIncome(income) });
  }

  return (
    <Sheet
      title={editing ? 'Edit income' : 'Add income'}
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
              {amount !== null && hasOperator(expr) && <>= {num(amount)}</>}
              {expr && amount === null && <span className="text-muted">…</span>}
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
      <section className="mt-2">
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Where it came from</h3>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Source">
          {INCOME_SOURCES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={source === s.id}
              onClick={() => setSource(s.id)}
              className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-xl border text-sm transition ${
                source === s.id ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink'
              }`}
            >
              <span className="text-lg" aria-hidden>
                {s.emoji}
              </span>
              {s.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
        <label htmlFor="inc-date" className="text-sm text-ink-2">
          Date
        </label>
        <div className="flex gap-2">
          <input
            id="inc-date"
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
        <label htmlFor="inc-note" className="text-sm text-ink-2">
          Note
        </label>
        <input
          id="inc-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onFocus={() => setPadOpen(false)}
          placeholder={source === 'salary' ? 'e.g. November salary' : source === 'home' ? 'e.g. Pocket money' : 'e.g. Freelance job'}
          maxLength={300}
          enterKeyHint="done"
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 outline-none focus:border-accent"
        />
      </section>

      {editing && (
        <button type="button" onClick={remove} className="mt-6 min-h-11 w-full rounded-xl border border-danger/40 text-sm font-medium text-danger">
          Delete
        </button>
      )}
    </Sheet>
  );
}
