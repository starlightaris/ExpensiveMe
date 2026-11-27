import { useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { deleteTxn, saveTxn, useSettings, useTags, useTxns } from '../db';
import { dayHeading, type Period } from '../lib/dates';
import { money } from '../lib/format';
import { totals } from '../lib/stats';
import type { Tag, Txn } from '../types';
import { PeriodPicker } from './PeriodPicker';
import { toast } from './Toast';
import { Dot } from './TrendChart';
import { Banknote } from 'lucide-react';
import { TagIcon } from '../lib/icons';

export type WhoFilter = 'all' | 'mine' | 'covered';
export interface ListFilter {
  who: WhoFilter;
  /** tag id, '__none' for untagged, or null for any */
  tag: string | null;
  q: string;
}

interface Props {
  period: Period;
  onPeriod: (p: Period) => void;
  filter: ListFilter;
  onFilter: (f: ListFilter) => void;
  onEdit: (t: Txn) => void;
}

export function TxnList({ period, onPeriod, filter, onFilter, onEdit }: Props) {
  const settings = useSettings();
  const tags = useTags();
  const txns = useTxns(period.from, period.to);
  const tagById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const cur = settings.currency;

  const filtered = useMemo(() => {
    const q = filter.q.trim().toLowerCase();
    return (txns ?? [])
      .filter((t) => (filter.who === 'mine' ? !t.covered : filter.who === 'covered' ? t.covered : true))
      .filter((t) => {
        if (!filter.tag) return true;
        if (filter.tag === '__none') return !t.tagIds.some((id) => tagById.has(id));
        return t.tagIds.includes(filter.tag);
      })
      .filter((t) => {
        if (!q) return true;
        const hay = [t.note, t.coveredBy, ...t.tagIds.map((id) => tagById.get(id)?.name ?? '')].join(' ').toLowerCase();
        return hay.includes(q) || String(t.amount).includes(q);
      })
      .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
  }, [txns, filter, tagById]);

  const groups = useMemo(() => {
    const out: { date: string; items: Txn[] }[] = [];
    for (const t of filtered) {
      const last = out[out.length - 1];
      if (last && last.date === t.date) last.items.push(t);
      else out.push({ date: t.date, items: [t] });
    }
    return out;
  }, [filtered]);

  const sum = totals(filtered);
  const set = (patch: Partial<ListFilter>) => onFilter({ ...filter, ...patch });

  return (
    <div className="space-y-3">
      <PeriodPicker period={period} onChange={onPeriod} />

      <input
        type="search"
        value={filter.q}
        onChange={(e) => set({ q: e.target.value })}
        placeholder="Search notes, people, tags…"
        enterKeyHint="search"
        className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 outline-none focus:border-accent"
      />

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {(
          [
            ['all', 'Everything'],
            ['mine', 'Paid by me'],
            ['covered', 'Covered'],
          ] as const
        ).map(([w, label]) => (
          <Chip key={w} on={filter.who === w} onClick={() => set({ who: w })}>
            {w !== 'all' && <Dot c={w === 'mine' ? 'mine' : 'covered'} />}
            {label}
          </Chip>
        ))}
        <span className="mx-1 w-px shrink-0 bg-line" />
        {tags.map((t) => (
          <Chip key={t.id} on={filter.tag === t.id} onClick={() => set({ tag: filter.tag === t.id ? null : t.id })}>
            <TagIcon name={t.icon} size={15} />
            {t.name}
          </Chip>
        ))}
        <Chip on={filter.tag === '__none'} onClick={() => set({ tag: filter.tag === '__none' ? null : '__none' })}>
          Untagged
        </Chip>
      </div>

      <p className="tabular text-sm text-ink-2">
        {sum.count} {sum.count === 1 ? 'record' : 'records'} · <strong className="text-ink">{money(sum.lifestyle, cur)}</strong>
        {sum.covered > 0 && filter.who === 'all' && (
          <span className="text-muted">
            {' '}
            ({money(sum.mine, cur)} yours)
          </span>
        )}
      </p>

      {txns && groups.length === 0 && (
        <div className="rounded-3xl border border-dashed border-line p-8 text-center text-ink-2">
          {txns.length === 0 ? 'No expenses in this period yet.' : 'Nothing matches these filters.'}
        </div>
      )}

      <div className="space-y-4">
        {groups.map((g) => {
          const gt = totals(g.items);
          return (
            <section key={g.date}>
              <div className="tabular mb-1.5 flex items-baseline justify-between px-1 text-xs">
                <h3 className="font-semibold tracking-wide text-ink-2 uppercase">{dayHeading(g.date)}</h3>
                <span className="text-muted">{money(gt.lifestyle, cur)}</span>
              </div>
              <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
                {g.items.map((t) => (
                  <SwipeRow key={t.id} onDelete={() => remove(t)} onOpen={() => onEdit(t)}>
                    <Row t={t} tags={t.tagIds.map((id) => tagById.get(id)).filter((x): x is Tag => !!x)} currency={cur} />
                  </SwipeRow>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      {groups.length > 0 && <p className="pt-2 text-center text-xs text-muted">Swipe left on a row to delete · tap to edit</p>}
    </div>
  );
}

async function remove(t: Txn) {
  await deleteTxn(t.id);
  toast('Deleted', { label: 'Undo', run: () => saveTxn(t) });
}

function Row({ t, tags, currency }: { t: Txn; tags: Tag[]; currency: string }) {
  const title = t.note || tags.map((x) => x.name).join(', ') || 'Expense';
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <div className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2" aria-hidden>
        {tags[0] ? <TagIcon name={tags[0].icon} size={18} /> : <Banknote size={18} strokeWidth={1.8} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{title}</p>
        <p className="truncate text-xs text-muted">
          {t.note && tags.length > 0 && tags.map((x) => x.name).join(' · ')}
          {t.serviceCharge && <span className="ml-1 rounded bg-surface-2 px-1">+{t.serviceRate}%</span>}
        </p>
      </div>
      <div className="tabular shrink-0 text-right">
        <p className={`font-semibold ${t.covered ? 'text-ink-2' : ''}`}>{money(t.amount, currency)}</p>
        {t.covered && (
          <p className="max-w-28 truncate text-xs text-ink-2">
            <Dot c="covered" />
            {t.coveredBy || 'Covered'}
          </p>
        )}
      </div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm whitespace-nowrap transition ${
        on ? 'border-pick bg-pick font-medium text-pick-ink' : 'border-line bg-surface text-ink-2'
      }`}
    >
      {children}
    </button>
  );
}

const REVEAL = 88;

/** Row that reveals a Delete button when swiped left; tap opens it. */
function SwipeRow({ children, onDelete, onOpen }: { children: React.ReactNode; onDelete: () => void; onOpen: () => void }) {
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; base: number; locked: 'h' | 'v' | null } | null>(null);
  const moved = useRef(false);

  const down = (e: RPointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY, base: x, locked: null };
    moved.current = false;
  };
  const move = (e: RPointerEvent) => {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!s.locked) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      s.locked = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      if (s.locked === 'h') {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        setDragging(true);
      }
    }
    if (s.locked !== 'h') return;
    moved.current = true;
    setX(Math.max(-REVEAL - 30, Math.min(0, s.base + dx)));
  };
  const up = () => {
    const s = start.current;
    start.current = null;
    setDragging(false);
    if (s?.locked === 'h') setX((cur) => (cur < -REVEAL / 2 ? -REVEAL : 0));
  };

  return (
    <li className="relative border-b border-line last:border-b-0">
      <button
        onClick={onDelete}
        tabIndex={x === 0 ? -1 : 0}
        className="absolute inset-y-0 right-0 bg-danger font-semibold text-white"
        style={{ width: REVEAL }}
        aria-hidden={x === 0}
      >
        Delete
      </button>
      <div
        role="button"
        tabIndex={0}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={() => {
          if (moved.current) return;
          if (x !== 0) setX(0);
          else onOpen();
        }}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen())}
        className={`relative touch-pan-y bg-surface outline-none select-none focus-visible:ring-2 focus-visible:ring-accent ${
          dragging ? '' : 'transition-transform duration-200'
        }`}
        style={{ transform: `translateX(${x}px)` }}
      >
        {children}
      </div>
    </li>
  );
}
