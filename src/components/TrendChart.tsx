import { useEffect, useRef, useState } from 'react';
import type { Bucket } from '../lib/stats';
import { compact, money } from '../lib/format';

function niceMax(v: number): { max: number; step: number } {
  if (v <= 0) return { max: 1, step: 1 };
  const raw = v / 3;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  return { max: step * Math.ceil(v / step), step };
}

interface Props {
  buckets: Bucket[];
  currency: string;
  showCovered: boolean;
}

/** Stacked bars over time: your money (bottom) + covered by others (top). */
export function TrendChart({ buckets, currency, showCovered }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(200, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => setActive(null), [buckets]);

  const H = 150;
  const padL = 34;
  const padB = 20;
  const padT = 6;
  const plotW = width - padL;
  const plotH = H - padB - padT;
  const val = (b: Bucket) => b.mine + (showCovered ? b.covered : 0);
  const { max, step } = niceMax(Math.max(0, ...buckets.map(val)));
  const n = buckets.length;
  const slot = plotW / Math.max(1, n);
  const barW = Math.max(2, Math.min(22, slot * 0.66));
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const labelEvery = Math.ceil(n / Math.floor(plotW / 26));

  const ticks: number[] = [];
  for (let t = 0; t <= max + 1e-9; t += step) ticks.push(t);

  const a = active !== null ? buckets[active] : null;

  return (
    <div ref={ref} className="w-full">
      <div className="tabular mb-1 min-h-10 text-sm" aria-live="polite">
        {a ? (
          <>
            <div className="font-semibold">
              {a.title} · {money(val(a), currency)}
            </div>
            <div className="text-xs text-ink-2">
              <Dot c="mine" /> You {money(a.mine, currency)}
              {showCovered && (
                <>
                  {'  '}
                  <Dot c="covered" /> Covered {money(a.covered, currency)}
                </>
              )}
            </div>
          </>
        ) : (
          <span className="text-xs text-muted">Tap a bar for details</span>
        )}
      </div>
      <svg
        width={width}
        height={H}
        role="img"
        aria-label="Spending over time"
        className="block touch-pan-y select-none"
        onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={width} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={padL - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill="var(--muted)" className="tabular">
              {compact(t)}
            </text>
          </g>
        ))}
        {buckets.map((b, i) => {
          const cx = padL + slot * i + slot / 2;
          const x = cx - barW / 2;
          const mineH = (b.mine / max) * plotH;
          const covH = showCovered ? (b.covered / max) * plotH : 0;
          const gap = mineH > 0 && covH > 0 ? 2 : 0;
          const dim = active !== null && active !== i;
          const r = Math.min(4, barW / 2);
          return (
            <g key={b.key} opacity={dim ? 0.45 : 1}>
              {mineH > 0 && <Bar x={x} y={y(b.mine)} w={barW} h={mineH} r={covH > 0 ? 0 : r} fill="var(--mine)" />}
              {covH > 0 && (
                <Bar x={x} y={y(b.mine) - gap - Math.max(0, covH - gap)} w={barW} h={Math.max(1, covH - gap)} r={r} fill="var(--covered)" />
              )}
              {i % labelEvery === 0 && (
                <text x={cx} y={H - 5} textAnchor="middle" fontSize={10} fill="var(--muted)" className="tabular">
                  {b.label}
                </text>
              )}
              {/* hit target: full column, larger than the mark */}
              <rect
                x={padL + slot * i}
                y={0}
                width={slot}
                height={H}
                fill="transparent"
                onPointerEnter={(e) => e.pointerType === 'mouse' && setActive(i)}
                onClick={() => setActive((cur) => (cur === i ? null : i))}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Bar with rounded top corners only, anchored flat on the baseline */
function Bar({ x, y, w, h, r, fill }: { x: number; y: number; w: number; h: number; r: number; fill: string }) {
  const rr = Math.min(r, h);
  const d = `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
  return <path d={d} fill={fill} />;
}

export function Dot({ c }: { c: 'mine' | 'covered' }) {
  return <span aria-hidden className={`mr-1 inline-block size-2 rounded-full ${c === 'mine' ? 'bg-mine' : 'bg-covered'}`} />;
}
