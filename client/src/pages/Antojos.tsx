import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  Craving,
  CravingAction,
  CravingContext,
  CravingStats,
  CravingTrigger,
} from '@nacionfit/shared';
import { createCraving, getCravingContext, getCravings, getCravingStats } from '../lib/api';
import {
  ACTION_LABELS,
  ACTION_OPTIONS,
  fmtTimeAgo,
  PROTOCOL_STEPS,
  TRIGGER_LABELS,
  TRIGGER_OPTIONS,
} from '../lib/cravings';
import { INTENSITY_OPTIONS } from '../lib/constants';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { IntensityDots } from '../components/IntensityDots';

const selectClass =
  'w-full rounded-lg border border-line bg-bg px-3 py-2.5 font-body text-ink outline-none transition focus:border-green focus:ring-2 focus:ring-green-pale';

function intensityLabel(value: string | null): string {
  return INTENSITY_OPTIONS.find((o) => o.value === value)?.label ?? '—';
}

function ContextRow({
  label,
  value,
  risk,
}: {
  label: string;
  value: string;
  risk: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-line/60 py-2 last:border-0">
      <span className="font-body text-sm text-ink/60">{label}</span>
      <span className={`font-body font-medium ${risk ? 'text-terra' : 'text-ink'}`}>
        {value}
      </span>
    </div>
  );
}

export function Antojos() {
  const navigate = useNavigate();
  const [view, setView] = useState<'active' | 'history'>('active');
  const [context, setContext] = useState<CravingContext | null>(null);
  const [recent, setRecent] = useState<Craving[] | null>(null);
  const [stats, setStats] = useState<CravingStats | null>(null);
  const [patternOpen, setPatternOpen] = useState(true);

  const [food, setFood] = useState('');
  const [intensity, setIntensity] = useState<number | null>(null);
  const [trigger, setTrigger] = useState<CravingTrigger | ''>('');
  const [action, setAction] = useState<CravingAction | ''>('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const refresh = useCallback(async () => {
    const [ctx, list, st] = await Promise.all([
      getCravingContext(),
      getCravings(20),
      getCravingStats(),
    ]);
    setContext(ctx);
    setRecent(list);
    setStats(st);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!food.trim() || intensity == null || !trigger || !action) {
      setError('Completá la comida, la intensidad, el disparador y la acción.');
      return;
    }
    setSaving(true);
    try {
      await createCraving({
        food: food.trim(),
        intensity,
        trigger,
        action,
        note: note.trim() || null,
      });
      setFood('');
      setIntensity(null);
      setTrigger('');
      setAction('');
      setNote('');
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2200);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl leading-tight text-green">
          Tus <span className="italic text-terra">antojos</span>
        </h1>
        <div className="flex rounded-lg border border-line bg-surface p-0.5 font-body text-sm">
          {(['active', 'history'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 transition ${
                view === v ? 'bg-green text-surface' : 'text-ink/60 hover:text-green'
              }`}
            >
              {v === 'active' ? 'Ahora' : 'Historial'}
            </button>
          ))}
        </div>
      </div>

      {view === 'active' ? (
        <>
          <Card pre="Protocolo" em="5 minutos">
            <ol className="space-y-3">
              {PROTOCOL_STEPS.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-7 shrink-0 font-display text-2xl italic leading-none text-terra">
                    {i + 1}
                  </span>
                  <span className="pt-1 font-body text-ink/80">{step}</span>
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={() => navigate('/app/tools')}
              className="mt-5 w-full rounded-lg border border-terra px-4 py-2.5 font-body text-sm font-medium text-terra transition hover:bg-terra-pale"
            >
              Iniciar timer 20 min
            </button>
          </Card>

          <Card pre="Contexto de" em="hoy">
            {context ? (
              <div>
                <ContextRow
                  label="Sueño anoche"
                  value={
                    context.sleepHoursLastNight != null
                      ? `${context.sleepHoursLastNight} h`
                      : '—'
                  }
                  risk={
                    context.sleepHoursLastNight != null && context.sleepHoursLastNight < 6
                  }
                />
                <ContextRow
                  label="Intensidad del proyecto"
                  value={intensityLabel(context.projectIntensityToday)}
                  risk={
                    context.projectIntensityToday === 'high' ||
                    context.projectIntensityToday === 'crisis'
                  }
                />
                <ContextRow
                  label="Desde la última comida"
                  value={
                    context.hoursSinceLastMeal != null
                      ? `${context.hoursSinceLastMeal} h`
                      : '—'
                  }
                  risk={
                    context.hoursSinceLastMeal != null && context.hoursSinceLastMeal >= 4
                  }
                />
                <ContextRow
                  label="Antojos esta semana"
                  value={String(context.cravingsCountThisWeek)}
                  risk={context.cravingsCountThisWeek >= 5}
                />
              </div>
            ) : (
              <p className="font-body text-ink/50">Cargando…</p>
            )}
          </Card>

          <Card pre="Cuando pase," em="registralo">
            <form onSubmit={onSubmit} className="space-y-4">
              <label className="block">
                <span className="mb-1 block font-body text-sm font-medium text-ink">
                  ¿Qué se te antojó?
                </span>
                <input
                  type="text"
                  value={food}
                  onChange={(e) => setFood(e.target.value)}
                  maxLength={120}
                  placeholder="Ej.: chocolate"
                  className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 font-body text-ink placeholder:text-ink/30 outline-none transition focus:border-green focus:ring-2 focus:ring-green-pale"
                />
              </label>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-body text-sm font-medium text-ink">Intensidad</span>
                  <span className="font-body text-sm text-ink/60">
                    {intensity != null ? `${intensity} / 10` : '—'}
                  </span>
                </div>
                <IntensityDots value={intensity} onChange={setIntensity} />
              </div>

              <label className="block">
                <span className="mb-1 block font-body text-sm font-medium text-ink">
                  Disparador
                </span>
                <select
                  value={trigger}
                  onChange={(e) => setTrigger(e.target.value as CravingTrigger)}
                  className={selectClass}
                >
                  <option value="">Elegí…</option>
                  {TRIGGER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block font-body text-sm font-medium text-ink">
                  ¿Qué hiciste?
                </span>
                <select
                  value={action}
                  onChange={(e) => setAction(e.target.value as CravingAction)}
                  className={selectClass}
                >
                  <option value="">Elegí…</option>
                  {ACTION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block font-body text-sm font-medium text-ink">
                  Nota <span className="text-ink/40">(opcional)</span>
                </span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="¿Qué estaba pasando?"
                  className="w-full resize-none rounded-lg border border-line bg-bg px-3 py-2.5 font-body text-ink placeholder:text-ink/30 outline-none transition focus:border-green focus:ring-2 focus:ring-green-pale"
                />
              </label>

              {error && <p className="font-body text-sm text-terra">{error}</p>}

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Guardando…' : 'Registrar antojo'}
                </Button>
                <span
                  className={`font-body text-sm text-green transition-opacity duration-700 ${
                    justSaved ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  Registrado
                </span>
              </div>
            </form>
          </Card>
        </>
      ) : (
        <>
          {stats && stats.total >= 5 && (
            <Card pre="Tu" em="patrón">
              <button
                type="button"
                onClick={() => setPatternOpen((o) => !o)}
                className="flex w-full items-center justify-between font-body text-sm text-ink/60"
              >
                <span>{patternOpen ? 'Ocultar' : 'Mostrar'} resumen</span>
                <span className="text-ink/40">{patternOpen ? '–' : '+'}</span>
              </button>
              {patternOpen && (
                <dl className="mt-4 grid grid-cols-2 gap-4">
                  <Stat
                    label="Disparador top"
                    value={
                      stats.topTrigger
                        ? `${TRIGGER_LABELS[stats.topTrigger.trigger]} (${stats.topTrigger.count})`
                        : '—'
                    }
                  />
                  <Stat
                    label="Comida top"
                    value={
                      stats.topFood ? `${stats.topFood.food} (${stats.topFood.count})` : '—'
                    }
                  />
                  <Stat label="Últimos 7 días" value={String(stats.countLast7d)} />
                  <Stat label="Manejados" value={`${stats.managedPct}%`} />
                </dl>
              )}
            </Card>
          )}

          {recent == null ? (
            <p className="font-body text-ink/50">Cargando…</p>
          ) : recent.length === 0 ? (
            <Card pre="Sin" em="registros">
              <p className="font-body text-ink/70">
                Todavía no registraste antojos. Cuando pase uno, registralo desde “Ahora”.
              </p>
            </Card>
          ) : (
            <ul className="space-y-3">
              {recent.map((c) => (
                <li
                  key={c.id}
                  className="rounded-2xl border border-line bg-surface p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-display text-lg text-green">{c.food}</span>
                    <span className="shrink-0 font-body text-xs text-ink/40">
                      {fmtTimeAgo(c.timestamp)}
                    </span>
                  </div>
                  <div className="mt-2">
                    <IntensityDots value={c.intensity} size="sm" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 font-body text-xs">
                    <span className="rounded-full bg-terra-pale px-2.5 py-1 text-terra">
                      {TRIGGER_LABELS[c.trigger]}
                    </span>
                    <span className="rounded-full bg-green-pale px-2.5 py-1 text-green">
                      {ACTION_LABELS[c.action]}
                    </span>
                  </div>
                  {c.note && (
                    <p className="mt-2 font-body text-sm italic text-ink/60">{c.note}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-body text-xs uppercase tracking-wide text-ink/50">{label}</dt>
      <dd className="mt-0.5 font-body font-medium text-ink">{value}</dd>
    </div>
  );
}
