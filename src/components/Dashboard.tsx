import { useMemo, useState } from 'react';
import { useSettings, useTags, useTxns } from '../db';
import type { Period } from '../lib/dates';
import { daysBetween, today } from '../lib/dates';
import { money, pct } from '../lib/format';
import { byPayer, byTag, hasMultiTag, timeBuckets, totals } from '../lib/stats';
import { PeriodPicker } from './PeriodPicker';
import { Dot, TrendChart } from './TrendChart';

interface Props {
  period: Period;
  onPeriod: (p: Period) => void;
  onAdd: () => void;
  onOpenTag: (tagId: string | null) => void;
}

type View = 'lifestyle' | 'mine';

export function Dashboard({ period, onPeriod, onAdd, onOpenTag }: Props) {
  const settings = useSettings();
  const tags = useTags();
  const txns = useTxns(period.from, period.to);
  const [view, setView] = useState<View>('lifestyle');
  const [showPayers, setShowPayers] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const cur = settings.currency;

  const t = useMemo(() => totals(txns ?? []), [txns]);
  const tagRows = useMemo(() => {
    const rows = byTag(txns ?? [], tags);
    const v = (r: (typeof rows)[number]) => r.mine + (view === 'lifestyle' ? r.covered : 0);
    return rows.filter((r) => v(r) > 0).sort((a, b) => v(b) - v(a));
  }, [txns, tags, view]);
  const payers = useMemo(() => byPayer(txns ?? []), [txns]);
  const trend = useMemo(() => timeBuckets(txns ?? [], period.from, period.to), [txns, period]);

  const showCovered = view === 'lifestyle';
  const headline = view === 'lifestyle' ? t.lifestyle : t.mine;
  const tagMax = Math.max(1, ...tagRows.map((r) => r.mine + (showCovered ? r.covered : 0)));

  // daily average over elapsed days of the period (don't count future days)
  const avgTo = period.to > today() ? today() : period.to;
  const firstDate = (txns ?? []).reduce((m, x) => (x.date < m ? x.date : m), avgTo);
  const avgFrom = period.kind === 'all' ? firstDate : period.from;
  const days = avgTo >= avgFrom ? daysBetween(avgFrom, avgTo) : 0;

  return (
    <div className="space-y-4">
      <PeriodPicker period={period} onChange={onPeriod} />

      {/* Hero */}
      <section className="rounded-3xl bg-surface p-5 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm text-ink-2">{view === 'lifestyle' ? 'Lifestyle cost' : 'Out of pocket'}</p>
            <p className="tabular mt-1 text-4xl font-bold tracking-tight">{money(headline, cur)}</p>
          </div>
          <ViewToggle view={view} onChange={setView} />
        </div>

        {t.lifestyle > 0 && (
          <>
            <div className="mt-4 flex h-3 w-full gap-[2px] overflow-hidden rounded-full" aria-hidden>
              {t.mine > 0 && <div className="h-full rounded-l-full bg-mine" style={{ width: `${(t.mine / t.lifestyle) * 100}%` }} />}
              {t.covered > 0 && (
                <div
                  className={`h-full rounded-r-full bg-covered transition-opacity ${view === 'mine' ? 'opacity-25' : ''}`}
                  style={{ width: `${(t.covered / t.lifestyle) * 100}%` }}
                />
              )}
            </div>
            <div className="tabular mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-ink-2">
                  <Dot c="mine" />
                  Out of pocket
                </div>
                <div className="font-semibold">
                  {money(t.mine, cur)} <span className="font-normal text-muted">{pct(t.mine, t.lifestyle)}</span>
                </div>
              </div>
              <button className="text-left" onClick={() => setShowPayers((s) => !s)} disabled={t.covered === 0} aria-expanded={showPayers}>
                <div className="text-ink-2">
                  <Dot c="covered" />
                  Covered by others {t.covered > 0 && <span className="text-xs text-accent">{showPayers ? '▴' : '▾'}</span>}
                </div>
                <div className="font-semibold">
                  {money(t.covered, cur)} <span className="font-normal text-muted">{pct(t.covered, t.lifestyle)}</span>
                </div>
              </button>
            </div>
            {showPayers && payers.length > 0 && (
              <ul className="tabular mt-3 space-y-1 border-t border-line pt-3 text-sm">
                {payers.map((p) => (
                  <li key={p.name} className="flex justify-between">
                    <span className={p.name === 'Unspecified' ? 'text-muted italic' : ''}>
                      {p.name} <span className="text-xs text-muted">×{p.count}</span>
                    </span>
                    <span>{money(p.amount, cur)}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <p className="tabular mt-4 text-xs text-muted">
          {t.count} {t.count === 1 ? 'record' : 'records'}
          {days > 0 && t.count > 0 && <> · about {money(Math.round(headline / days), cur)} a day</>}
        </p>
      </section>

      {txns && txns.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-line p-8 text-center">
          <p className="text-3xl">🌱</p>
          <p className="mt-2 font-medium">Nothing recorded in this period</p>
          <button onClick={onAdd} className="mt-4 min-h-11 rounded-full bg-accent px-5 font-semibold text-accent-ink">
            Add an expense
          </button>
        </section>
      ) : (
        <>
          {/* By tag */}
          <section className="rounded-3xl bg-surface p-5 shadow-sm">
            <h2 className="mb-3 font-semibold">Where it goes</h2>
            <ul className="space-y-3">
              {tagRows.map((r) => {
                const v = r.mine + (showCovered ? r.covered : 0);
                return (
                  <li key={r.tag?.id ?? 'none'}>
                    <button className="w-full text-left" onClick={() => onOpenTag(r.tag?.id ?? null)}>
                      <div className="tabular flex items-baseline justify-between gap-2 text-sm">
                        <span className="truncate">
                          <span className="mr-1.5">{r.tag?.emoji ?? '·'}</span>
                          {r.tag?.name ?? 'Untagged'}
                          <span className="ml-1.5 text-xs text-muted">×{r.count}</span>
                        </span>
                        <span className="shrink-0">
                          <span className="font-semibold">{money(v, cur)}</span>{' '}
                          <span className="text-xs text-muted">{pct(v, headline)}</span>
                        </span>
                      </div>
                      <div className="mt-1.5 flex h-2 gap-[2px]" style={{ width: `${(v / tagMax) * 100}%` }}>
                        {r.mine > 0 && <div className="h-full rounded-l bg-mine last:rounded-r" style={{ flexGrow: r.mine }} />}
                        {showCovered && r.covered > 0 && (
                          <div className="h-full rounded-r bg-covered first:rounded-l" style={{ flexGrow: r.covered }} />
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
            {hasMultiTag(txns ?? []) && (
              <p className="mt-3 text-xs text-muted">Records with several tags count toward each, so tags can add up to more than the total.</p>
            )}
          </section>

          {/* Over time */}
          {trend.buckets.length > 1 && (
            <section className="rounded-3xl bg-surface p-5 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-semibold">{trend.unit === 'day' ? 'Day by day' : 'Month by month'}</h2>
                <button onClick={() => setShowTable((s) => !s)} className="min-h-9 px-2 text-sm text-accent">
                  {showTable ? 'Chart' : 'Table'}
                </button>
              </div>
              {showTable ? (
                <table className="tabular w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted">
                      <th className="py-1 font-normal">{trend.unit === 'day' ? 'Day' : 'Month'}</th>
                      <th className="py-1 text-right font-normal">You</th>
                      {showCovered && <th className="py-1 text-right font-normal">Covered</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {trend.buckets
                      .filter((b) => b.mine + b.covered > 0)
                      .map((b) => (
                        <tr key={b.key} className="border-t border-line">
                          <td className="py-1.5">{b.title}</td>
                          <td className="py-1.5 text-right">{money(b.mine, cur)}</td>
                          {showCovered && <td className="py-1.5 text-right">{money(b.covered, cur)}</td>}
                        </tr>
                      ))}
                  </tbody>
                </table>
              ) : (
                <TrendChart buckets={trend.buckets} currency={cur} showCovered={showCovered} />
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div className="flex shrink-0 rounded-full bg-surface-2 p-0.5 text-xs" role="group" aria-label="Measure">
      {(
        [
          ['lifestyle', 'All'],
          ['mine', 'Mine'],
        ] as const
      ).map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          aria-pressed={view === v}
          className={`min-h-8 rounded-full px-3 ${view === v ? 'bg-surface font-semibold shadow-sm' : 'text-ink-2'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
