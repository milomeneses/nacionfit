import { useEffect, useState } from 'react';
import type { AdminMetrics as Metrics } from '@nacionfit/shared';
import { getAdminMetrics } from '../../lib/api';
import { TRIGGER_LABELS } from '../../lib/cravings';
import { BarChart } from '../../components/charts';

export function AdminMetrics() {
  const [m, setM] = useState<Metrics | null>(null);

  useEffect(() => {
    getAdminMetrics().then(setM).catch(() => setM(null));
  }, []);

  if (!m) return <p className="font-body text-ink/60">Cargando…</p>;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl leading-tight text-green">
        Métricas <span className="italic text-terra">anónimas</span>
      </h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Usuarios" value={m.totalUsers} />
        <Stat label="Activos 7d" value={m.activeLast7d} />
        <Stat label="Activos 30d" value={m.activeLast30d} />
        <Stat label="Antojos totales" value={m.totalCravingsLogged} />
        <Stat label="Hábitos/día" value={m.avgHabitsCompleted ?? '—'} />
        <Stat label="Sueño prom. (h)" value={m.avgSleepHours ?? '—'} />
        <Stat label="Racha prom." value={m.avgStreak} />
      </div>

      <Panel title="Altas por semana">
        {m.signupsOverTime.length > 0 ? (
          <BarChart
            color="var(--green)"
            data={m.signupsOverTime.map((s) => ({
              label: s.week.slice(5),
              value: s.count,
              caption: String(s.count),
            }))}
          />
        ) : (
          <Empty />
        )}
      </Panel>

      <Panel title="Usuarios activos por semana">
        {m.activeOverTime.length > 0 ? (
          <BarChart
            color="var(--sun)"
            data={m.activeOverTime.map((s) => ({
              label: s.week.slice(5),
              value: s.count,
              caption: String(s.count),
            }))}
          />
        ) : (
          <Empty />
        )}
      </Panel>

      <Panel title="Disparadores más comunes">
        {m.topTriggers.length > 0 ? (
          <ul className="space-y-2">
            {m.topTriggers.map((t) => {
              const max = m.topTriggers[0].count || 1;
              return (
                <li key={t.trigger} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 font-body text-sm text-ink/70">
                    {TRIGGER_LABELS[t.trigger]}
                  </span>
                  <div className="h-3 flex-1 rounded-full bg-bg">
                    <div
                      className="h-3 rounded-full bg-terra"
                      style={{ width: `${(t.count / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-body text-sm text-ink">{t.count}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty />
        )}
      </Panel>

      <Panel title="Distribución de pérdida de peso">
        <BarChart
          color="var(--green)"
          data={m.weightLossDistribution.map((b) => ({
            label: b.bucket,
            value: b.users,
            caption: String(b.users),
          }))}
        />
      </Panel>

      <Panel title="Retención por cohorte (semana de alta)">
        {m.cohortRetention.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse font-body text-sm">
              <thead>
                <tr className="text-left text-ink/60">
                  <th className="px-3 py-2 font-medium">Cohorte</th>
                  <th className="px-3 py-2 font-medium">Tamaño</th>
                  {['Sem 0', 'Sem 1', 'Sem 2', 'Sem 3'].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {m.cohortRetention.map((c) => (
                  <tr key={c.cohort} className="border-t border-line/60">
                    <td className="px-3 py-2 text-ink">{c.cohort}</td>
                    <td className="px-3 py-2 text-ink/70">{c.size}</td>
                    {c.retention.map((r, i) => (
                      <td key={i} className="px-3 py-2">
                        <span
                          className="inline-block rounded px-2 py-0.5 text-xs"
                          style={{
                            backgroundColor: `rgba(45, 74, 51, ${0.08 + r * 0.55})`,
                            color: r > 0.5 ? 'var(--surface)' : 'var(--ink)',
                          }}
                        >
                          {Math.round(r * 100)}%
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
      </Panel>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 text-center">
      <p className="font-display text-3xl text-green">{value}</p>
      <p className="mt-1 font-body text-xs uppercase tracking-wide text-ink/50">{label}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="mb-4 font-display text-xl text-green">{title}</h2>
      {children}
    </section>
  );
}

function Empty() {
  return <p className="font-body text-sm text-ink/40">Sin datos suficientes.</p>;
}
