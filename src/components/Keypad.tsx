import { Delete } from 'lucide-react';
import { useEffect } from 'react';

export type KeyValue = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | '+' | '−' | '×' | '÷' | '(' | ')' | '⌫' | 'C' | '=';

const ROWS: KeyValue[][] = [
  ['C', '(', ')', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '+'],
  ['.', '0', '⌫', '='],
];

const OPS = new Set(['+', '−', '×', '÷']);

/** Apply a key press to an expression string. */
export function applyKey(expr: string, key: KeyValue, result: number | null): string {
  if (key === 'C') return '';
  if (key === '⌫') return expr.slice(0, -1);
  if (key === '=') return result === null ? expr : String(result);
  if (OPS.has(key)) {
    if (expr === '' && key !== '−') return expr;
    // replace a trailing operator instead of stacking them
    if (OPS.has(expr.slice(-1))) return expr.slice(0, -1) + key;
    return expr + key;
  }
  if (key === '.') {
    const lastNum = expr.split(/[+−×÷()]/).pop() ?? '';
    if (lastNum.includes('.')) return expr;
    return expr + (lastNum === '' ? '0.' : '.');
  }
  if (expr.length >= 60) return expr;
  return expr + key;
}

interface Props {
  onKey: (k: KeyValue) => void;
  /** Listen to the physical keyboard too (desktop) */
  keyboard?: boolean;
}

export function Keypad({ onKey, keyboard = true }: Props) {
  useEffect(() => {
    if (!keyboard) return;
    const map: Record<string, KeyValue> = {
      '+': '+',
      '-': '−',
      '*': '×',
      x: '×',
      '/': '÷',
      '.': '.',
      ',': '.',
      '(': '(',
      ')': ')',
      Backspace: '⌫',
      Delete: 'C',
      Enter: '=',
      '=': '=',
    };
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = /^[0-9]$/.test(e.key) ? (e.key as KeyValue) : map[e.key];
      if (k) {
        e.preventDefault();
        onKey(k);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onKey, keyboard]);

  return (
    <div className="grid select-none grid-cols-4 gap-1.5 p-2">
      {ROWS.flat().map((k) => {
        const isOp = OPS.has(k) || k === '=';
        const isFn = k === 'C' || k === '(' || k === ')' || k === '⌫';
        return (
          <button
            key={k}
            type="button"
            onClick={() => onKey(k)}
            aria-label={k === '⌫' ? 'Backspace' : k === 'C' ? 'Clear' : k}
            className={`tabular grid h-11 place-items-center rounded-xl text-xl font-medium transition active:scale-95 ${
              k === '='
                ? 'bg-accent text-accent-ink'
                : isOp
                  ? 'bg-surface text-accent'
                  : isFn
                    ? 'bg-surface text-ink-2'
                    : 'bg-surface text-ink'
            } shadow-[0_1px_0_var(--border)]`}
          >
            {k === '⌫' ? <Delete size={22} strokeWidth={1.8} aria-hidden /> : k}
          </button>
        );
      })}
    </div>
  );
}
