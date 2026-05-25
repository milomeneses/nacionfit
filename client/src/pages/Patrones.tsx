import { useEffect, useState } from 'react';
import type {
  CravingsHeatmap,
  SleepVsCravings,
  StressCravings,
  TopTriggersResult,
  VarianceTrend,
} from '@nacionfit/shared';
import {
  getCravingsHeatmap,
  getDays,
  getSleepVsCravings,
  getStressCravings,
  getTopTriggers,
  getVariance,
} from '../lib/api';
import { daysAgoStr, todayStr } from '../lib/date';
import { TRIGGER_LABELS } from '../lib/cravings';
import { Card } from '../components/Card';

const MIN_DAYS = 14;

// surface (#FBF7EC) -> terra (#B45A36)
function heatColor(t: number): string {
  const a = [251, 247, 236];
  const b = [180, 90, 54];
  const mix = a.map((c, i) => Math.round(c + (b[i] - c) * t));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
}

interface Data {
  loggedDays: number;
  heatmap: CravingsHeatmap;
  sleep: SleepVsCravings;
  variance: VarianceTrend;
  triggers: TopTriggersResult;
  stress: StressCravings;
}

export function Patrones() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [days, heatmap, sleep, variance, triggers, stress] = await Promise.all([
          getDays(daysAgoStr(60), todayStr()),
          getCravingsHeatmap(6),
          getSleepVsCravings(8),
          getVariance(6),
          getTopTriggers(8),
          getStressCravings(6),
        ]);
        if (!active) return;
        setData({
          loggedDays: days.filter((d) => d.savedAt).length,
          heatmap,
          sleep,
          variance,
          triggers,
          stress,
        });
      } catch {
        if (active) setError(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (error) return <p className="font-body text-ink/60">No se pudieron cargar los patrones.</p>;
  if (!data) return <p className="font-body text-ink/60">Cargando…</p>;

  const title = (
    <h1 className="font-display text-3xl leading-tight text-green">
      Tus <span className="italic text-terra">patrones</span>
    </h1>
  );

  if (data.loggedDays < MIN_DAYS) {
    const left = MIN_DAYS - data.loggedDays;
    return (
      <div className="space-y-5">
        {title}
        <Card pre="Todavía" em="no">
          <p className="font-display text-xl italic leading-relaxed text-green">
            Aún sin suficientes datos. Volvé en{' '}
            <span className="text-terra">{left}</span> {left === 1 ? 'día' : 'días'} — los
            patrones empiezan a ser visibles a partir del día 14.
          </p>
          <p className="mt-3 font-body text-sm text-ink/60">
            Llevás {data.loggedDays} {data.loggedDays === 1 ? 'día' : 'días'} registrados.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {title}
      <Heatmap data={data.heatmap} />
      <SleepCard data={data.sleep} />
      <VarianceCard data={data.variance} />
      <StressCard data={data.stress} triggers={data.triggers} />
    </div>
  );
}

function Heatmap({ data }: { data: CravingsHeatmap }) {
  const max = Math.max(1, ...data.grid.flat());
  return (
    <Card pre="Mapa de" em="antojos">
      <div className="overflow-x-auto">
        <div className="min-w-[320px]">
          <div className="grid grid-cols-[2.5rem_repeat(5,1fr)] gap-1">
            <span />
            {data.blockLabels.map((b) => (
              <span key={b} className="text-center font-body text-[10px] text-ink/50">
                {b}
              </span>
            ))}
            {data.grid.map((row, di) => (
              <Row key={di} label={data.dayLabels[di]} row={row} max={max} peak={data.peak} di={di} />
            ))}
          </div>
        </div>
      </div>
      {data.peak && data.peak.count > 0 && (
        <p className="mt-4 font-body text-sm text-ink/70">
          Tu <span className="font-medium text-terra">hora roja</span>:{' '}
          <span className="font-medium text-terra">
            {data.dayLabels[data.peak.dayIndex]} {data.blockLabels[data.peak.blockIndex]}
          </span>
          . {data.peak.count} de {data.total} antojos en ese bloque.
        </p>
      )}
    </Card>
  );
}

function Row({
  label,
  row,
  max,
  peak,
  di,
}: {
  label: string;
  row: number[];
  max: number;
  peak: CravingsHeatmap['peak'];
  di: number;
}) {
  return (
    <>
      <span className="flex items-center font-body text-xs text-ink/60">{label}</span>
      {row.map((count, bi) => {
        const t = count / max;
        const isPeak = peak?.dayIndex === di && peak?.blockIndex === bi;
        return (
          <div
            key={bi}
            className={`flex h-9 items-center justify-center rounded font-body text-xs ${
              isPeak ? 'ring-2 ring-terra ring-offset-1 ring-offset-surface' : ''
            }`}
            style={{ backgroundColor: heatColor(t), color: t > 0.5 ? 'var(--surface)' : 'var(--ink)' }}
            title={`${count} antojos`}
          >
            {count > 0 ? count : ''}
          </div>
        );
      })}
    </>
  );
}

function SleepCard({ data }: { data: SleepVsCravings }) {
  const maxV = 10;
  const trackH = 110;
  const lowAvg = weightedAvg(data.buckets.filter((b) => b.label === '<5h' || b.label === '5-6'));
  const midBucket = data.buckets.find((b) => b.label === '7-8');
  return (
    <Card pre="Sueño y" em="antojos">
      <div className="flex items-end gap-2" style={{ height: trackH + 34 }}>
        {data.buckets.map((b, i) => {
          const v = b.avgIntensity ?? 0;
          const color = i < 3 ? 'var(--terra)' : 'var(--green)';
          return (
            <div key={b.label} className="flex flex-1 flex-col items-center justify-end gap-1">
              <span className="font-body text-[10px] text-ink/50">
                {b.avgIntensity != null ? b.avgIntensity : ''}
              </span>
              <div
                className="w-full rounded-t-md"
                style={{ height: `${(v / maxV) * trackH}px`, minHeight: v > 0 ? 4 : 0, background: color }}
              />
              <span className="font-body text-[11px] text-ink/60">{b.label}</span>
            </div>
          );
        })}
      </div>
      {lowAvg != null && midBucket?.avgIntensity != null && (
        <p className="mt-4 font-body text-sm text-ink/70">
          Cuando dormís <span className="font-medium text-terra">&lt;6h</span>, la intensidad
          media de antojo es <span className="font-medium text-terra">{lowAvg}/10</span>. Cuando
          dormís 7-8h, baja a <span className="font-medium text-green">{midBucket.avgIntensity}/10</span>.
        </p>
      )}
    </Card>
  );
}

function weightedAvg(buckets: { count: number; avgIntensity: number | null }[]): number | null {
  let sum = 0;
  let n = 0;
  for (const b of buckets) {
    if (b.avgIntensity != null) {
      sum += b.avgIntensity * b.count;
      n += b.count;
    }
  }
  return n > 0 ? Math.round((sum / n) * 10) / 10 : null;
}

function VarianceCard({ data }: { data: VarianceTrend }) {
  const W = 300;
  const H = 120;
  const pad = 16;
  const maxY = Math.max(0.5, ...data.series.map((s) => s.variance ?? 0)) * 1.1;
  const n = data.series.length;
  const x = (i: number) => pad + (i / (n - 1 || 1)) * (W - 2 * pad);
  const y = (v: number) => H - pad - (v / maxY) * (H - 2 * pad);

  const pts = data.series
    .map((s, i) => ({ v: s.variance, i }))
    .filter((p): p is { v: number; i: number } => p.v != null);
  const path = pts.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.i)},${y(p.v)}`).join(' ');
  const last = pts[pts.length - 1] ?? null;
  const prev = pts[pts.length - 2] ?? null;
  const lastColor = last && last.v < 0.2 ? 'var(--green)' : 'var(--terra)';

  let commentary = 'Seguimos midiendo tu consistencia entre semana y fin de semana.';
  if (last && prev) {
    if (last.v < prev.v) commentary = 'Venís más parejo entre semana y fin de semana. Buen signo.';
    else if (last.v > prev.v) commentary = 'El fin de semana se te está dispersando más que los días de semana.';
    else commentary = 'Te mantenés estable entre semana y fin de semana.';
  }

  return (
    <Card pre="Varianza" em="semanal">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <line
          x1={pad}
          x2={W - pad}
          y1={y(data.goal)}
          y2={y(data.goal)}
          stroke="var(--line)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <text x={W - pad} y={y(data.goal) - 4} textAnchor="end" className="fill-ink/40" fontSize="9">
          meta {data.goal}
        </text>
        {path && <path d={path} fill="none" stroke="var(--green)" strokeWidth="2" strokeLinejoin="round" />}
        {pts.map((p) => (
          <circle
            key={p.i}
            cx={x(p.i)}
            cy={y(p.v)}
            r={last && p.i === last.i ? 4 : 2.5}
            fill={last && p.i === last.i ? lastColor : 'var(--ink)'}
            opacity={last && p.i === last.i ? 1 : 0.35}
          />
        ))}
      </svg>
      <p className="mt-3 font-body text-sm text-ink/70">
        Tu varianza reciente es{' '}
        <span className="font-medium" style={{ color: lastColor }}>
          {last ? last.v.toFixed(2) : '—'}
        </span>
        . {commentary}
      </p>
    </Card>
  );
}

function StressCard({
  data,
  triggers,
}: {
  data: StressCravings;
  triggers: TopTriggersResult;
}) {
  const top = triggers.triggers[0];
  return (
    <Card pre="Estrés y" em="antojos">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-line bg-bg p-4 text-center">
          <p className="font-display text-3xl text-green">{data.low.avgPerDay}</p>
          <p className="mt-1 font-body text-xs text-ink/60">
            antojos/día con estrés bajo o medio
          </p>
        </div>
        <div className="rounded-xl border border-terra/40 bg-terra-pale p-4 text-center">
          <p className="font-display text-3xl text-terra">{data.high.avgPerDay}</p>
          <p className="mt-1 font-body text-xs text-ink/70">
            antojos/día con estrés alto o crisis
          </p>
        </div>
      </div>
      <p className="mt-4 font-body text-sm text-ink/70">
        Tu cuerpo pide más comida cuando el proyecto aprieta. Eso es{' '}
        <span className="italic text-terra">biología</span>, no debilidad.
      </p>
      {top && (
        <p className="mt-2 font-body text-sm text-ink/60">
          Tu disparador más frecuente:{' '}
          <span className="font-medium text-ink">{TRIGGER_LABELS[top.trigger]}</span> ({top.count}).
        </p>
      )}
    </Card>
  );
}
