import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  DrinkSource,
  HydrationToday,
  MobilityRoutine,
  ProposedWorkout,
  SupplementDoseToday,
  SupplementTiming,
  TrainingPlanResponse,
  TrainingWeekRecap,
  WeekDay,
} from '@nacionfit/shared';
import {
  getHydrationToday,
  getMobilityRoutines,
  getSupplementsToday,
  getTrainingPlan,
  getTrainingRecap,
  getTrainingToday,
  logHydration,
  logMobility,
  logSupplement,
  logWorkout,
} from '../lib/api';
import { formatLongEs, todayStr } from '../lib/date';
import { Card } from '../components/Card';
import { IntensityDots } from '../components/IntensityDots';

const WEEKDAY_LABELS: Record<WeekDay, string> = {
  mon: 'Lun', tue: 'Mar', wed: 'Mié', thu: 'Jue', fri: 'Vie', sat: 'Sáb', sun: 'Dom',
};

export function Entreno() {
  const today = todayStr();
  const [proposed, setProposed] = useState<ProposedWorkout | null>(null);
  const [plan, setPlan] = useState<TrainingPlanResponse | null>(null);
  const [supps, setSupps] = useState<SupplementDoseToday[] | null>(null);
  const [hydration, setHydration] = useState<HydrationToday | null>(null);
  const [routines, setRoutines] = useState<MobilityRoutine[]>([]);
  const [recap, setRecap] = useState<TrainingWeekRecap | null>(null);

  async function reloadTraining() {
    const [p, pl, r] = await Promise.all([getTrainingToday(), getTrainingPlan(), getTrainingRecap()]);
    setProposed(p);
    setPlan(pl);
    setRecap(r);
  }

  useEffect(() => {
    reloadTraining();
    getSupplementsToday().then(setSupps).catch(() => setSupps([]));
    getHydrationToday().then(setHydration).catch(() => null);
    getMobilityRoutines().then(setRoutines).catch(() => setRoutines([]));
  }, []);

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl leading-tight text-green">
        Tu <span className="italic text-terra">entreno</span>
      </h1>

      <TodayCard proposed={proposed} today={today} onChange={reloadTraining} onHydrationChange={() => getHydrationToday().then(setHydration)} />
      {plan && <PlanCard plan={plan} today={today} />}
      {supps && <SupplementsCard doses={supps} onToggle={async (id, taken) => { await logSupplement(id, taken); setSupps(await getSupplementsToday()); }} />}
      {hydration && <HydrationCard hydration={hydration} onAdd={async (ml, src) => setHydration(await logHydration(ml, src))} />}
      <MobilityCard routines={routines} proposed={proposed} onDone={async (id) => { await logMobility(id); reloadTraining(); }} />
      {recap && <RecapCard recap={recap} />}
    </div>
  );
}

// 1. HOY
function TodayCard({
  proposed,
  today,
  onChange,
  onHydrationChange,
}: {
  proposed: ProposedWorkout | null;
  today: string;
  onChange: () => void;
  onHydrationChange: () => void;
}) {
  const [mode, setMode] = useState<'view' | 'log' | 'skip'>('view');
  const [rpe, setRpe] = useState<number | null>(null);
  const [duration, setDuration] = useState('');
  const [skipReason, setSkipReason] = useState<string | null>(null);

  if (!proposed) return <Card pre="Hoy" em="·"><p className="font-body text-ink/50">Cargando…</p></Card>;

  const statusLabel =
    proposed.status === 'completed' ? 'Completado ✓' : proposed.status === 'in_progress' ? 'En progreso' : 'Pendiente';
  const statusClass =
    proposed.status === 'completed' ? 'bg-green-pale text-green' : 'bg-bg text-ink/60 border border-line';

  async function markDone() {
    await logWorkout({
      date: today,
      type: proposed!.type,
      durationMinutes: duration ? Number(duration) : null,
      rpe: rpe ?? null,
    });
    setMode('view');
    setRpe(null);
    setDuration('');
    onChange();
    onHydrationChange();
  }

  return (
    <Card pre="" em={formatLongEs(today)}>
      <div className="rounded-xl border border-terra/40 bg-terra-pale p-4">
        <p className="font-display text-lg italic text-terra">{proposed.label}</p>
        <p className="mt-1 font-body text-sm text-ink/75">{proposed.reasoning}</p>
        {proposed.adjusted && (
          <p className="mt-2 font-body text-xs text-terra">
            Ajustado por tu recuperación · vos decidís.
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <span className={`rounded-full px-3 py-1 font-body text-xs ${statusClass}`}>{statusLabel}</span>
        <button type="button" onClick={() => navigatorTimer()} className="font-body text-xs text-ink/40 hover:text-green">
          Iniciar timer 20 min
        </button>
      </div>

      {proposed.status !== 'completed' && mode === 'view' && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => { setMode('log'); }} className="rounded-lg bg-green px-4 py-2 font-body text-sm font-medium text-surface transition hover:bg-green/90">
            Marcar como hecho
          </button>
          <button type="button" onClick={() => setMode('log')} className="rounded-lg border border-line px-4 py-2 font-body text-sm text-ink transition hover:bg-bg">
            Modificar
          </button>
          <button type="button" onClick={() => setMode('skip')} className="rounded-lg border border-line px-4 py-2 font-body text-sm text-ink/70 transition hover:bg-bg">
            Skipear
          </button>
        </div>
      )}

      {mode === 'log' && (
        <div className="mt-4 space-y-3 rounded-xl border border-line bg-bg p-4">
          <div>
            <p className="mb-1.5 font-body text-sm font-medium text-ink">¿Cómo te fue? (RPE)</p>
            <IntensityDots value={rpe} onChange={setRpe} />
          </div>
          <label className="block">
            <span className="mb-1 block font-body text-sm font-medium text-ink">Duración (min)</span>
            <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="45"
              className="w-28 rounded-lg border border-line bg-surface px-3 py-2 font-body text-ink outline-none focus:border-green focus:ring-2 focus:ring-green-pale" />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={markDone} className="rounded-lg bg-green px-4 py-2 font-body text-sm font-medium text-surface hover:bg-green/90">Guardar</button>
            <button type="button" onClick={() => setMode('view')} className="rounded-lg border border-line px-4 py-2 font-body text-sm text-ink/60">Cancelar</button>
          </div>
        </div>
      )}

      {mode === 'skip' && (
        <div className="mt-4 rounded-xl border border-line bg-bg p-4">
          {!skipReason ? (
            <>
              <p className="mb-2 font-body text-sm text-ink/70">¿Qué pasó hoy?</p>
              <div className="flex flex-wrap gap-2">
                {['Cansancio', 'Lesión', 'Falta de tiempo', 'Otra cosa'].map((r) => (
                  <button key={r} type="button" onClick={() => setSkipReason(r)}
                    className="rounded-full border border-line bg-surface px-3 py-1.5 font-body text-sm text-ink transition hover:border-green/40">
                    {r}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="font-body text-sm text-ink/75">
              <p>Anotado. Saltarse un día también es información — sin culpa.</p>
              <p className="mt-2">
                Si querés, <Link to="/app/coach" className="text-terra underline-offset-2 hover:underline">hablalo con el coach</Link>.
              </p>
              <button type="button" onClick={() => { setMode('view'); setSkipReason(null); }} className="mt-3 font-body text-xs text-ink/50 hover:text-green">Listo</button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function navigatorTimer() {
  window.location.hash = '';
  window.location.pathname = '/app/tools';
}

// 2. PLAN ACTIVO
function PlanCard({ plan, today }: { plan: TrainingPlanResponse; today: string }) {
  if (!plan.block) {
    return (
      <Card pre="Plan" em="activo">
        <p className="font-body text-ink/60">Todavía no tenés un plan configurado.</p>
      </Card>
    );
  }
  return (
    <Card pre="Plan" em="activo">
      <p className="font-display text-lg text-green">{plan.block.name}</p>
      {plan.block.startDate && plan.block.endDate && (
        <p className="font-body text-sm text-ink/50">
          {plan.block.startDate} → {plan.block.endDate}
        </p>
      )}
      <ul className="mt-4 space-y-1">
        {plan.week.map((d) => {
          const isToday = d.date === today;
          return (
            <li key={d.day} className={`flex items-center gap-3 rounded-lg px-3 py-2 ${isToday ? 'bg-green-pale' : ''}`}>
              <span className={`w-10 shrink-0 font-body text-sm ${isToday ? 'font-semibold text-green' : 'text-ink/50'}`}>
                {WEEKDAY_LABELS[d.day]}
              </span>
              <span className={`font-body text-sm ${isToday ? 'text-ink' : 'text-ink/70'}`}>{d.label}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// 3. SUPLEMENTOS
const TIMING_GROUPS: { timings: SupplementTiming[]; label: string; icon: 'sun' | 'dumbbell' | 'plate' | 'moon' | 'dot' }[] = [
  { timings: ['morning'], label: 'Mañana', icon: 'sun' },
  { timings: ['pre_workout', 'post_workout'], label: 'Entreno', icon: 'dumbbell' },
  { timings: ['with_lunch', 'with_dinner'], label: 'Con comida', icon: 'plate' },
  { timings: ['before_bed'], label: 'Antes de dormir', icon: 'moon' },
  { timings: ['flexible'], label: 'Flexible', icon: 'dot' },
];

function TimingIcon({ icon }: { icon: string }) {
  const c = 'h-4 w-4 text-terra';
  if (icon === 'sun') return <svg viewBox="0 0 24 24" className={c} fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" strokeLinecap="round" /></svg>;
  if (icon === 'dumbbell') return <svg viewBox="0 0 24 24" className={c} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6.5 6.5v11M3 9v6M17.5 6.5v11M21 9v6M6.5 12h11" /></svg>;
  if (icon === 'plate') return <svg viewBox="0 0 24 24" className={c} fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></svg>;
  if (icon === 'moon') return <svg viewBox="0 0 24 24" className={c} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A8 8 0 1111 3a6 6 0 0010 9.8z" /></svg>;
  return <svg viewBox="0 0 24 24" className={c} fill="currentColor"><circle cx="12" cy="12" r="3" /></svg>;
}

function SupplementsCard({
  doses,
  onToggle,
}: {
  doses: SupplementDoseToday[];
  onToggle: (id: number, taken: boolean) => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const takenCount = doses.filter((d) => d.taken).length;

  return (
    <Card pre="Suplementos" em="hoy">
      {doses.length === 0 ? (
        <p className="font-body text-ink/60">Hoy no tenés suplementos programados.</p>
      ) : (
        <>
          <div className="space-y-4">
            {TIMING_GROUPS.map((g) => {
              const items = doses.filter((d) => g.timings.includes(d.supplement.timing));
              if (items.length === 0) return null;
              return (
                <div key={g.label}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <TimingIcon icon={g.icon} />
                    <span className="font-body text-xs uppercase tracking-wide text-ink/50">{g.label}</span>
                  </div>
                  <ul className="space-y-1">
                    {items.map((d) => (
                      <li key={d.supplement.id}>
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={() => onToggle(d.supplement.id, !d.taken)}
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${d.taken ? 'border-green bg-green' : 'border-line bg-bg'}`}>
                            {d.taken && <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-surface" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7" /></svg>}
                          </button>
                          <button type="button" onClick={() => setExpanded(expanded === d.supplement.id ? null : d.supplement.id)}
                            className="flex-1 text-left font-body text-ink">
                            {d.supplement.name} <span className="text-ink/40">· {d.supplement.dose}</span>
                          </button>
                        </div>
                        {expanded === d.supplement.id && (
                          <div className="ml-8 mt-1 font-body text-xs text-ink/50">
                            {d.supplement.brand && <span>Marca: {d.supplement.brand}. </span>}
                            {d.supplement.notes ?? 'Sin notas.'}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <p className="mt-4 font-body text-sm text-ink/60">
            Tomaste <span className="font-medium text-ink">{takenCount}</span> de {doses.length} suplementos hoy.
          </p>
        </>
      )}
    </Card>
  );
}

// 4. HIDRATACIÓN
function HydrationCard({
  hydration,
  onAdd,
}: {
  hydration: HydrationToday;
  onAdd: (ml: number, src: DrinkSource) => void;
}) {
  const pct = Math.min(100, Math.round((hydration.consumedMl / Math.max(1, hydration.targetMl)) * 100));
  return (
    <Card pre="" em="Hidratación">
      <div className="flex items-end justify-between">
        <p className="font-display text-3xl text-green">
          {(hydration.consumedMl / 1000).toFixed(2)}
          <span className="text-lg text-ink/50"> / {(hydration.targetMl / 1000).toFixed(2)} L</span>
        </p>
        <span className="font-body text-sm text-ink/50">vas en {pct}%</span>
      </div>
      <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-bg">
        <div className="h-3 rounded-full bg-terra transition-all" style={{ width: `${pct}%` }} />
      </div>
      {hydration.bonuses.length > 0 && (
        <p className="mt-2 font-body text-xs text-terra">
          {hydration.bonuses.map((b) => `${b.label}, te suma ${b.ml}ml`).join(' · ')}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {[250, 500, 750].map((ml) => (
          <button key={ml} type="button" onClick={() => onAdd(ml, 'water')}
            className="rounded-lg border border-green bg-green/5 px-3 py-2 font-body text-sm text-green transition hover:bg-green/10">
            +{ml}ml
          </button>
        ))}
        {(['coffee', 'tea', 'mate'] as DrinkSource[]).map((src) => (
          <button key={src} type="button" onClick={() => onAdd(200, src)}
            className="rounded-lg border border-line bg-bg px-3 py-2 font-body text-sm text-ink/70 transition hover:border-terra/40">
            {src === 'coffee' ? 'Café' : src === 'tea' ? 'Té' : 'Mate'} 200ml
          </button>
        ))}
      </div>
      <p className="mt-2 font-body text-xs text-ink/40">Café, té y mate cuentan al 80%.</p>
    </Card>
  );
}

// 5. MOVILIDAD
function MobilityCard({
  routines,
  proposed,
  onDone,
}: {
  routines: MobilityRoutine[];
  proposed: ProposedWorkout | null;
  onDone: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  if (routines.length === 0) return null;

  const isRestish = proposed?.type === 'rest' || proposed?.type === 'rest_active';
  const suggested =
    (isRestish
      ? routines.find((r) => r.name.toLowerCase().includes('recuperación') || r.name.toLowerCase().includes('off'))
      : routines.find((r) => r.name.toLowerCase().includes('post-wod'))) ?? routines[0];

  return (
    <Card pre="" em="Movilidad">
      <p className="font-display text-lg text-green">{suggested.name}</p>
      <p className="font-body text-sm text-ink/50">{suggested.durationMinutes} min · {suggested.exercises.length} ejercicios</p>
      <button type="button" onClick={() => setOpen((o) => !o)} className="mt-2 font-body text-sm text-terra hover:underline">
        {open ? 'Ocultar' : 'Ver ejercicios'}
      </button>
      {open && (
        <ol className="mt-3 space-y-2">
          {suggested.exercises.map((ex, i) => (
            <li key={i} className="flex gap-3 font-body text-sm">
              <span className="w-5 shrink-0 font-display italic text-terra">{i + 1}</span>
              <span className="text-ink/80">
                {ex.name}
                <span className="text-ink/40">
                  {ex.durationSec ? ` · ${ex.durationSec}s` : ex.reps ? ` · ${ex.reps} reps` : ''}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
      <button type="button" onClick={() => onDone(suggested.id)}
        className="mt-4 rounded-lg border border-green px-4 py-2 font-body text-sm font-medium text-green transition hover:bg-green-pale">
        Marcar como hecho
      </button>
    </Card>
  );
}

// 6. ESTA SEMANA
function RecapCard({ recap }: { recap: TrainingWeekRecap }) {
  return (
    <Card pre="Esta" em="semana">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric label="Entrenamientos" value={`${recap.workoutsCompleted} de ${recap.workoutsPlanned}`} />
        <Metric label="RPE promedio" value={recap.avgRpe != null ? `${recap.avgRpe}/10` : '—'} />
        <Metric label="Movilidad" value={`${recap.mobilityMinutes} min`} />
        <Metric label="Hidratación" value={`${recap.hydrationDaysHit} de ${recap.hydrationDaysTotal} días`} />
        <Metric label="Suplementos" value={`${recap.supplementAdherencePct}%`} />
      </div>
      <p className="mt-4 font-body text-sm text-ink/60">
        Esto es lo que hiciste, no lo que “deberías”. Cada dato suma para entenderte mejor.
      </p>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-bg p-3 text-center">
      <p className="font-display text-xl text-green">{value}</p>
      <p className="mt-0.5 font-body text-xs uppercase tracking-wide text-ink/50">{label}</p>
    </div>
  );
}
