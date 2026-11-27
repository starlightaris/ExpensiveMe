import { useCallback, useRef, useState } from 'react';
import { evaluate, hasOperator } from '../lib/calc';
import { num } from '../lib/format';
import { applyKey, Keypad, type KeyValue } from './Keypad';
import { Sheet } from './Sheet';
import { toast } from './Toast';

const HISTORY_KEY = 'expensiveme.calc-history';

function loadHistory(): { expr: string; result: number }[] {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((h) => typeof h?.expr === 'string' && typeof h?.result === 'number').slice(0, 10) : [];
  } catch {
    return [];
  }
}

interface Props {
  onClose: () => void;
  onUseAmount: (amount: number) => void;
}

export function CalculatorSheet({ onClose, onUseAmount }: Props) {
  const [expr, setExpr] = useState('');
  const [history, setHistory] = useState(loadHistory);
  const result = evaluate(expr);

  const exprRef = useRef(expr);
  exprRef.current = expr;

  const onKey = useCallback((k: KeyValue) => {
    const e = exprRef.current;
    const r = evaluate(e);
    if (k === '=' && r !== null && hasOperator(e)) {
      setHistory((h) => {
        const next = [{ expr: e, result: r }, ...h].slice(0, 10);
        try {
          localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        } catch {
          /* storage unavailable: history just won't persist */
        }
        return next;
      });
    }
    const next = applyKey(e, k, r);
    exprRef.current = next;
    setExpr(next);
  }, []);

  async function copy() {
    if (result === null) return;
    try {
      await navigator.clipboard.writeText(String(result));
      toast('Copied');
    } catch {
      toast('Couldn’t copy');
    }
  }

  return (
    <Sheet
      title="Calculator"
      onClose={onClose}
      action={
        <button
          disabled={result === null || result <= 0}
          onClick={() => result !== null && onUseAmount(result)}
          className="min-h-11 rounded-full bg-accent px-3 text-sm font-semibold text-accent-ink disabled:opacity-40"
        >
          Add expense
        </button>
      }
      footer={<Keypad onKey={onKey} />}
    >
      <div className="mt-2 rounded-2xl bg-surface-2 px-4 py-4 text-right">
        <div className="tabular min-h-6 truncate text-ink-2">{hasOperator(expr) ? expr : ' '}</div>
        <button onClick={copy} className="tabular block w-full truncate text-right text-4xl font-semibold" aria-label="Result, tap to copy">
          {result !== null ? num(result) : expr || '0'}
        </button>
        <div className="mt-1 text-xs text-muted">Tap the result to copy</div>
      </div>

      {history.length > 0 && (
        <section className="mt-4">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Recent</h3>
            <button
              onClick={() => {
                setHistory([]);
                try {
                  localStorage.removeItem(HISTORY_KEY);
                } catch {
                  /* ignore */
                }
              }}
              className="min-h-9 px-2 text-xs text-accent"
            >
              Clear
            </button>
          </div>
          <ul className="divide-y divide-line">
            {history.map((h, i) => (
              <li key={i}>
                <button onClick={() => setExpr(String(h.result))} className="tabular flex min-h-10 w-full justify-between gap-3 text-sm">
                  <span className="truncate text-ink-2">{h.expr}</span>
                  <span className="font-medium">= {num(h.result)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Sheet>
  );
}
