import { periodAround, periodLabel, shiftPeriod, today, type Period, type PeriodKind } from '../lib/dates';

const KINDS: { kind: PeriodKind; label: string }[] = [
  { kind: 'week', label: 'Week' },
  { kind: 'month', label: 'Month' },
  { kind: 'year', label: 'Year' },
  { kind: 'all', label: 'All' },
  { kind: 'custom', label: 'Custom' },
];

interface Props {
  period: Period;
  onChange: (p: Period) => void;
  /** which period types to offer (default: all) */
  kinds?: PeriodKind[];
}

export function PeriodPicker({ period, onChange, kinds }: Props) {
  const options = kinds ? KINDS.filter((k) => kinds.includes(k.kind)) : KINDS;
  const shiftable = period.kind === 'week' || period.kind === 'month' || period.kind === 'year';
  const current = shiftable && periodAround(period.kind, today()).from === period.from;

  function pick(kind: PeriodKind) {
    if (kind === 'custom') {
      const base = period.kind === 'all' ? periodAround('month', today()) : period;
      onChange({ kind: 'custom', from: base.from, to: base.to });
    } else {
      onChange(periodAround(kind, today()));
    }
  }

  return (
    <div className="space-y-2">
      <div
        className="grid rounded-xl bg-surface-2 p-1"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
        role="tablist"
        aria-label="Period"
      >
        {options.map(({ kind, label }) => (
          <button
            key={kind}
            role="tab"
            aria-selected={period.kind === kind}
            onClick={() => pick(kind)}
            className={`min-h-9 rounded-lg text-sm transition ${
              period.kind === kind ? 'bg-surface font-semibold text-ink shadow-sm' : 'text-ink-2'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {period.kind === 'custom' ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted">
            From
            <input
              type="date"
              value={period.from}
              max={period.to}
              onChange={(e) => e.target.value && onChange({ ...period, from: e.target.value })}
              className="mt-1 w-full rounded-xl border border-line bg-surface px-3 text-ink outline-none focus:border-accent"
            />
          </label>
          <label className="text-xs text-muted">
            To
            <input
              type="date"
              value={period.to}
              min={period.from}
              onChange={(e) => e.target.value && onChange({ ...period, to: e.target.value })}
              className="mt-1 w-full rounded-xl border border-line bg-surface px-3 text-ink outline-none focus:border-accent"
            />
          </label>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <button
            onClick={() => onChange(shiftPeriod(period, -1))}
            disabled={!shiftable}
            aria-label="Previous period"
            className="grid size-11 place-items-center rounded-full text-xl text-ink-2 disabled:invisible"
          >
            ‹
          </button>
          <button
            onClick={() => shiftable && onChange(periodAround(period.kind, today()))}
            className="min-h-11 px-2 text-base font-semibold"
            title={current ? undefined : 'Back to current'}
          >
            {periodLabel(period)}
            {shiftable && !current && <span className="ml-2 text-xs font-normal text-accent">Today ↺</span>}
          </button>
          <button
            onClick={() => onChange(shiftPeriod(period, 1))}
            disabled={!shiftable}
            aria-label="Next period"
            className="grid size-11 place-items-center rounded-full text-xl text-ink-2 disabled:invisible"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
