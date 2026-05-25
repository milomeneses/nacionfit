import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  DailyLogInput,
  HabitId,
  HealthData,
  Meals,
  ProjectIntensity,
} from '@nacionfit/shared';
import { getDay, getDays, getHealthMe, getReviews, putDay, toggleHabit } from '../lib/api';
import { computeStreak, daysAgoStr, formatLongEs, todayStr } from '../lib/date';
import { fmtSleep } from '../lib/health';
import {
  EMPTY_MEALS,
  HABITS,
  INTENSITY_OPTIONS,
  MEAL_FIELDS,
  MOOD_OPTIONS,
} from '../lib/constants';
import { Card } from '../components/Card';

interface Metrics {
  meals: Meals;
  waterCount: number | null;
  mood: number | null;
  crossfit: boolean | null;
  energy: number | null;
  projectIntensity: ProjectIntensity | null;
  weightKg: number | null;
}

const EMPTY_METRICS: Metrics = {
  meals: { ...EMPTY_MEALS },
  waterCount: null,
  mood: null,
  crossfit: null,
  energy: null,
  projectIntensity: null,
  weightKg: null,
};

function emptyHabits(): Record<HabitId, boolean> {
  return Object.fromEntries(HABITS.map((h) => [h.id, false])) as Record<HabitId, boolean>;
}

type SaveState = 'idle' | 'saving' | 'saved';

export function Hoy() {
  const today = useMemo(() => todayStr(), []);

  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Metrics>(EMPTY_METRICS);
  const [habits, setHabits] = useState<Record<HabitId, boolean>>(emptyHabits());
  const [weightInput, setWeightInput] = useState('');
  const [savedDates, setSavedDates] = useState<Set<string>>(new Set());
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [todayHealth, setTodayHealth] = useState<HealthData | null>(null);
  const [unreadReview, setUnreadReview] = useState<string | null>(null);

  const metricsRef = useRef(metrics);
  useEffect(() => {
    metricsRef.current = metrics;
  }, [metrics]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashSaved = useCallback(() => {
    setSaveState('saved');
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(
      () => setSaveState((s) => (s === 'saved' ? 'idle' : s)),
      1800,
    );
  }, []);

  const flush = useCallback(async () => {
    setSaveState('saving');
    const m = metricsRef.current;
    const input: DailyLogInput = {
      meals: m.meals,
      waterCount: m.waterCount,
      mood: m.mood,
      crossfit: m.crossfit,
      energy: m.energy,
      projectIntensity: m.projectIntensity,
      weightKg: m.weightKg,
    };
    try {
      await putDay(today, input);
      setSavedDates((prev) => new Set(prev).add(today));
      flashSaved();
    } catch {
      setSaveState('idle');
    }
  }, [today, flashSaved]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, 1000);
  }, [flush]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [day, range, health, reviews] = await Promise.all([
          getDay(today),
          getDays(daysAgoStr(120), today),
          getHealthMe().catch(() => [] as HealthData[]),
          getReviews().catch(() => []),
        ]);
        if (!active) return;
        if (day) {
          setMetrics({
            meals: day.meals ?? { ...EMPTY_MEALS },
            waterCount: day.waterCount,
            mood: day.mood,
            crossfit: day.crossfit,
            energy: day.energy,
            projectIntensity: day.projectIntensity,
            weightKg: day.weightKg,
          });
          setHabits(day.habits);
          setWeightInput(day.weightKg != null ? String(day.weightKg) : '');
        }
        const saved = new Set(range.filter((d) => d.savedAt).map((d) => d.date));
        if (day?.savedAt) saved.add(today);
        setSavedDates(saved);
        setTodayHealth(health.find((h) => h.date === today) ?? null);
        setUnreadReview(reviews.find((r) => !r.readAt)?.weekStart ?? null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [today]);

  function update<K extends keyof Metrics>(key: K, value: Metrics[K]) {
    setMetrics((prev) => ({ ...prev, [key]: value }));
    scheduleSave();
  }

  function updateMeal(key: keyof Meals, value: string) {
    setMetrics((prev) => ({ ...prev, meals: { ...prev.meals, [key]: value } }));
    scheduleSave();
  }

  function setCrossfit(value: boolean) {
    setMetrics((prev) => ({ ...prev, crossfit: value, energy: value ? prev.energy : null }));
    scheduleSave();
  }

  function onWeightChange(value: string) {
    setWeightInput(value);
    const num = value.trim() === '' ? null : parseFloat(value);
    update('weightKg', num != null && !Number.isNaN(num) ? num : null);
  }

  async function onToggleHabit(id: HabitId) {
    const next = !habits[id];
    setHabits((prev) => ({ ...prev, [id]: next }));
    setSaveState('saving');
    try {
      await toggleHabit({ date: today, habitId: id, completed: next });
      flashSaved();
    } catch {
      setHabits((prev) => ({ ...prev, [id]: !next }));
      setSaveState('idle');
    }
  }

  const streak = useMemo(() => computeStreak(savedDates, today), [savedDates, today]);

  if (loading) {
    return <p className="font-body text-ink/60">Cargando…</p>;
  }

  const water = metrics.waterCount ?? 0;

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4">
        <h1 className="font-display text-3xl leading-tight text-green">
          {formatLongEs(today)}
        </h1>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="rounded-full border border-line bg-surface px-3 py-1 font-body text-sm text-ink">
            Racha de <span className="font-semibold text-terra">{streak}</span>{' '}
            {streak === 1 ? 'día' : 'días'}
          </span>
          <span
            className={`font-body text-xs text-green transition-opacity duration-700 ${
              saveState === 'saved' ? 'opacity-100' : 'opacity-0'
            }`}
          >
            Guardado
          </span>
        </div>
      </div>

      <div className="space-y-5">
        {unreadReview && (
          <Link
            to={`/app/reviews/${unreadReview}`}
            className="block rounded-2xl border border-terra/40 bg-terra-pale p-5 transition hover:border-terra"
          >
            <p className="font-display text-lg italic text-terra">
              Tu review de la semana está listo
            </p>
            <p className="mt-1 font-body text-sm text-ink/70">
              Tocá para ver tus 3 patrones y el experimento de esta semana.
            </p>
          </Link>
        )}

        <Card em="Apple Watch">
          {todayHealth ? (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="font-display text-2xl text-green">
                  {fmtSleep(todayHealth.sleepMinutes)}
                </p>
                <p className="font-body text-xs uppercase tracking-wide text-ink/50">Sueño</p>
              </div>
              <div>
                <p className="font-display text-2xl text-green">
                  {todayHealth.hrvMs != null ? `${todayHealth.hrvMs}` : '—'}
                  {todayHealth.hrvMs != null && (
                    <span className="text-sm text-ink/50"> ms</span>
                  )}
                </p>
                <p className="font-body text-xs uppercase tracking-wide text-ink/50">HRV</p>
              </div>
              <div>
                <p className="font-display text-2xl text-green">
                  {todayHealth.steps != null
                    ? todayHealth.steps.toLocaleString('es-AR')
                    : '—'}
                </p>
                <p className="font-body text-xs uppercase tracking-wide text-ink/50">Pasos</p>
              </div>
            </div>
          ) : (
            <p className="font-body text-ink/60">
              <Link
                to="/app/settings"
                className="text-terra underline-offset-2 hover:underline"
              >
                Conectá Apple Watch en Ajustes
              </Link>
            </p>
          )}
        </Card>

        <Card pre="Las" em="comidas">
          <div className="space-y-3">
            {MEAL_FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="mb-1 block font-body text-sm font-medium text-ink">
                  {f.label}
                </span>
                <input
                  type="text"
                  value={metrics.meals[f.key]}
                  onChange={(e) => updateMeal(f.key, e.target.value)}
                  placeholder="¿Qué comiste?"
                  className="w-full rounded-lg border border-line bg-bg px-3 py-2 font-body text-ink placeholder:text-ink/30 outline-none transition focus:border-green focus:ring-2 focus:ring-green-pale"
                />
              </label>
            ))}
          </div>
        </Card>

        <Card pre="Vasos de" em="agua">
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => {
              const filled = water >= n;
              return (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} vasos`}
                  aria-pressed={filled}
                  onClick={() => update('waterCount', water === n ? n - 1 : n)}
                  className={`h-10 w-8 rounded-md rounded-t-sm border transition ${
                    filled
                      ? 'border-green bg-green'
                      : 'border-line bg-surface hover:border-green/40'
                  }`}
                />
              );
            })}
          </div>
          <p className="mt-3 font-body text-sm text-ink/60">{water} / 8 vasos</p>
        </Card>

        <Card pre="Nivel de" em="estrés">
          <div className="grid grid-cols-4 gap-2">
            {INTENSITY_OPTIONS.map((o) => {
              const active = metrics.projectIntensity === o.value;
              const activeClass =
                o.value === 'crisis'
                  ? 'border-terra bg-terra text-surface'
                  : 'border-green bg-green text-surface';
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => update('projectIntensity', active ? null : o.value)}
                  className={`rounded-lg border px-2 py-2 font-body text-sm transition ${
                    active ? activeClass : 'border-line bg-bg text-ink hover:border-green/40'
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </Card>

        <Card pre="Tu" em="ánimo">
          <div className="flex gap-2">
            {MOOD_OPTIONS.map((o) => {
              const active = metrics.mood === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  title={o.label}
                  aria-label={o.label}
                  onClick={() => update('mood', active ? null : o.value)}
                  className={`flex h-11 w-11 items-center justify-center rounded-full border text-xl transition ${
                    active
                      ? 'border-green bg-green-pale'
                      : 'border-line bg-bg grayscale hover:grayscale-0'
                  }`}
                >
                  {o.emoji}
                </button>
              );
            })}
          </div>
        </Card>

        <Card em="CrossFit">
          <div className="flex gap-2">
            {[
              { v: true, l: 'Sí' },
              { v: false, l: 'No' },
            ].map((o) => {
              const active = metrics.crossfit === o.v;
              return (
                <button
                  key={o.l}
                  type="button"
                  onClick={() => setCrossfit(o.v)}
                  className={`rounded-lg border px-5 py-2 font-body text-sm transition ${
                    active
                      ? 'border-green bg-green text-surface'
                      : 'border-line bg-bg text-ink hover:border-green/40'
                  }`}
                >
                  {o.l}
                </button>
              );
            })}
          </div>
          {metrics.crossfit === true && (
            <div className="mt-5">
              <p className="mb-2 font-body text-sm font-medium text-ink">Energía</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => {
                  const active = metrics.energy === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => update('energy', active ? null : n)}
                      className={`h-10 w-10 rounded-lg border font-body text-sm transition ${
                        active
                          ? 'border-sun bg-sun text-ink'
                          : 'border-line bg-bg text-ink hover:border-green/40'
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        <Card pre="Tu" em="peso">
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              value={weightInput}
              onChange={(e) => onWeightChange(e.target.value)}
              placeholder="0.0"
              className="w-32 rounded-lg border border-line bg-bg px-3 py-2 font-body text-ink placeholder:text-ink/30 outline-none transition focus:border-green focus:ring-2 focus:ring-green-pale"
            />
            <span className="font-body text-ink/60">kg</span>
            <span className="ml-1 font-body text-xs text-ink/40">(opcional)</span>
          </div>
        </Card>

        <Card pre="Tus" em="hábitos">
          <ul className="space-y-1">
            {HABITS.map((h) => {
              const done = habits[h.id];
              return (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => onToggleHabit(h.id)}
                    className="flex w-full items-center gap-3 rounded-lg border border-transparent px-2 py-2 text-left transition hover:border-line"
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                        done ? 'border-green bg-green' : 'border-line bg-bg'
                      }`}
                    >
                      {done && (
                        <svg
                          viewBox="0 0 16 16"
                          className="h-3.5 w-3.5 text-surface"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3.5 8.5l3 3 6-7" />
                        </svg>
                      )}
                    </span>
                    <span className={`font-body ${done ? 'text-ink' : 'text-ink/70'}`}>
                      {h.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </>
  );
}
