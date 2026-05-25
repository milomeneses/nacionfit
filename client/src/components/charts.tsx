interface BarDatum {
  label: string;
  value: number;
  caption?: string;
}

/** Vertical bar chart with value captions; heights scaled to the max. */
export function BarChart({
  data,
  color = 'var(--green)',
}: {
  data: BarDatum[];
  color?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const trackHeight = 110;
  return (
    <div className="flex items-end gap-2" style={{ height: trackHeight + 34 }}>
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
          <span className="font-body text-[10px] leading-none text-ink/50">
            {d.caption ?? ''}
          </span>
          <div
            className="w-full rounded-t-md"
            style={{
              height: `${(d.value / max) * trackHeight}px`,
              minHeight: d.value > 0 ? 4 : 0,
              background: color,
            }}
          />
          <span className="font-body text-[11px] leading-none text-ink/60">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Line trend (sparkline) over a series that may contain gaps (nulls). */
export function Trend({
  values,
  color = 'var(--terra)',
}: {
  values: (number | null)[];
  color?: string;
}) {
  const W = 300;
  const H = 90;
  const pad = 10;
  const pts = values
    .map((v, i) => ({ v, i }))
    .filter((p): p is { v: number; i: number } => p.v != null);

  if (pts.length === 0) {
    return <p className="font-body text-sm text-ink/40">Sin datos</p>;
  }

  const min = Math.min(...pts.map((p) => p.v));
  const max = Math.max(...pts.map((p) => p.v));
  const range = max - min || 1;
  const lastIndex = values.length - 1 || 1;
  const x = (i: number) => pad + (i / lastIndex) * (W - 2 * pad);
  const y = (v: number) => H - pad - ((v - min) / range) * (H - 2 * pad);
  const path = pts.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.i)},${y(p.v)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {pts.map((p) => (
        <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r="2.6" fill={color} />
      ))}
    </svg>
  );
}

interface Segment {
  label: string;
  minutes: number;
  color: string;
}

/** Stacked horizontal bar showing sleep-stage proportions. */
export function StageBar({
  segments,
  format,
}: {
  segments: Segment[];
  format: (min: number) => string;
}) {
  const total = segments.reduce((s, x) => s + x.minutes, 0) || 1;
  return (
    <div>
      <div className="flex h-7 w-full overflow-hidden rounded-full border border-line">
        {segments.map(
          (s, i) =>
            s.minutes > 0 && (
              <div
                key={i}
                style={{ width: `${(s.minutes / total) * 100}%`, background: s.color }}
                title={`${s.label}: ${format(s.minutes)}`}
              />
            ),
        )}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2">
        {segments.map((s, i) => (
          <li key={i} className="flex items-center justify-between font-body text-sm">
            <span className="flex items-center gap-2 text-ink/70">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: s.color }}
              />
              {s.label}
            </span>
            <span className="text-ink">{format(s.minutes)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
