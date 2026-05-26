import { and, desc, eq, gte, lte } from 'drizzle-orm';
import type { ProposedWorkout, WeekDay, WorkoutType } from '@nacionfit/shared';
import { db } from '../db/index.js';
import { dailyLogs, healthData, trainingBlocks, workouts } from '../db/schema.js';
import { addDays, weekdayKey } from '../util/dates.js';

const TOKEN_LABELS: Record<string, string> = {
  crossfit: 'CrossFit',
  strength: 'fuerza',
  strength_upper: 'tren superior',
  strength_lower: 'tren inferior',
  mobility: 'movilidad',
  mobility_post: 'movilidad',
  upper: 'tren superior',
  lower: 'tren inferior',
  full: 'full body',
  cardio: 'cardio',
  rest_active: 'recuperación activa',
  rest: 'descanso',
};

/** Weekly-structure JSON column can come back as a string (MariaDB LONGTEXT). */
export function parseStructure(v: unknown): Record<string, string> {
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as Record<string, string>;
    } catch {
      return {};
    }
  }
  return (v ?? {}) as Record<string, string>;
}

/** Parses a weekly-structure slot string into a base type + human label. */
export function parseSlot(slot: string | undefined): { type: WorkoutType; label: string } {
  if (!slot) return { type: 'rest', label: 'Día libre' };
  const tokens = slot.split('+').map((t) => t.trim().toLowerCase());
  if (tokens.includes('rest_active')) return { type: 'rest_active', label: 'Recuperación activa (movilidad + caminata)' };
  if (tokens.length === 1 && tokens[0] === 'rest') return { type: 'rest', label: 'Descanso total' };

  let type: WorkoutType = 'other';
  if (tokens.some((t) => t.startsWith('crossfit'))) type = 'crossfit';
  else if (tokens.some((t) => t.startsWith('strength'))) type = 'strength';
  else if (tokens.some((t) => t.startsWith('mobility'))) type = 'mobility';
  else if (tokens.some((t) => t.startsWith('cardio'))) type = 'cardio';

  const labelParts = tokens.map((t) => TOKEN_LABELS[t] ?? t);
  const label = labelParts
    .map((p, i) => (i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p))
    .join(' + ');
  return { type, label };
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor(p * (sorted.length - 1));
  return sorted[idx];
}

export async function proposeWorkout(userId: number, date: string): Promise<ProposedWorkout> {
  const weekday = weekdayKey(date);

  // Active block (covers date, else most recent)
  const blocks = await db
    .select()
    .from(trainingBlocks)
    .where(eq(trainingBlocks.userId, userId))
    .orderBy(desc(trainingBlocks.startDate));
  const block =
    blocks.find((b) => (!b.startDate || b.startDate <= date) && (!b.endDate || b.endDate >= date)) ??
    blocks[0] ??
    null;
  const structure = parseStructure(block?.weeklyStructure);
  const base = parseSlot(structure[weekday]);

  // Recovery signals
  const [todayHealth] = await db
    .select()
    .from(healthData)
    .where(and(eq(healthData.userId, userId), eq(healthData.date, date)))
    .limit(1);
  const sleepHours = todayHealth?.sleepMinutes != null ? todayHealth.sleepMinutes / 60 : null;
  const sleepLow = sleepHours != null && sleepHours < 6;

  const hrvRows = await db
    .select({ hrv: healthData.hrvMs })
    .from(healthData)
    .where(and(eq(healthData.userId, userId), gte(healthData.date, addDays(date, -28))));
  const hrvValues = hrvRows.map((r) => (r.hrv != null ? Number(r.hrv) : null)).filter((x): x is number => x != null);
  const p25 = percentile(hrvValues, 0.25);
  const hrvToday = todayHealth?.hrvMs != null ? Number(todayHealth.hrvMs) : null;
  const hrvLow = hrvToday != null && p25 != null && hrvValues.length >= 7 && hrvToday <= p25;

  // consecutive high-stress days ending at date
  const stressRows = await db
    .select({ date: dailyLogs.date, intensity: dailyLogs.projectIntensity })
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, userId), gte(dailyLogs.date, addDays(date, -10))));
  const intensityByDate = new Map(stressRows.map((r) => [r.date, r.intensity]));
  let consecutiveStress = 0;
  for (let i = 0; ; i++) {
    const intensity = intensityByDate.get(addDays(date, -i));
    if (intensity === 'high' || intensity === 'crisis') consecutiveStress++;
    else break;
  }

  // training load last 7 days (completed high-intensity sessions)
  const recent = await db
    .select({ type: workouts.type, completedAt: workouts.completedAt })
    .from(workouts)
    .where(and(eq(workouts.userId, userId), gte(workouts.date, addDays(date, -7)), lte(workouts.date, date)));
  const highIntensity = recent.filter(
    (w) => w.completedAt != null && (w.type === 'crossfit' || w.type === 'strength'),
  ).length;

  // Decide
  let type = base.type;
  let label = base.label;
  let adjusted = false;
  let reasoning: string;

  const isRestSlot = base.type === 'rest' || base.type === 'rest_active';
  const heavySlot = base.type === 'crossfit' || base.type === 'strength';

  if (isRestSlot) {
    reasoning =
      base.type === 'rest'
        ? 'Hoy el plan marca descanso. Si tenés ganas, una movilidad suave suma; si no, descansar también es entrenar.'
        : 'Hoy toca recuperación activa: movilidad y una caminata tranquila. Tu cuerpo lo agradece.';
  } else if (heavySlot && consecutiveStress >= 3) {
    type = 'rest_active';
    label = 'Recuperación activa (movilidad + caminata)';
    adjusted = true;
    reasoning = `Originalmente tocaba ${base.label.toLowerCase()}, pero llevás ${consecutiveStress} días seguidos de proyecto intenso. Tu cuerpo está pidiendo bajar un cambio: propongo movilidad + caminata. Vos decidís.`;
  } else if (heavySlot && sleepLow) {
    type = 'mobility';
    label = 'Movilidad + caminata (sesión suave)';
    adjusted = true;
    reasoning = `Tocaba ${base.label.toLowerCase()}, pero anoche dormiste ${sleepHours?.toFixed(1)}h. Si querés entrenar, una versión cortita; si no, movilidad y listo. Sin culpa.`;
  } else if (heavySlot && hrvLow) {
    type = 'rest_active';
    label = 'Recuperación activa';
    adjusted = true;
    reasoning = `Tu HRV de hoy (${hrvToday} ms) está en tu cuarto más bajo del último mes. Suele ser señal de que conviene recuperar. Propongo movilidad; si te sentís bien, hacé lo tuyo.`;
  } else if (heavySlot && highIntensity > 5) {
    type = 'mobility';
    label = 'Movilidad (descarga)';
    adjusted = true;
    reasoning = `Llevás ${highIntensity} sesiones intensas en 7 días. Una descarga hoy te va a hacer rendir más esta semana. Igual, vos decidís.`;
  } else {
    const niceSleep = sleepHours != null ? ` Anoche dormiste ${sleepHours.toFixed(1)}h` : '';
    const niceHrv = hrvToday != null ? ` y tu HRV está en buen rango` : '';
    reasoning = `Hoy te toca ${base.label}.${niceSleep}${niceHrv}${niceSleep || niceHrv ? ' — buen día para darle.' : ' Cuando puedas, dale.'}`;
  }

  // Status from existing workout row for the date
  const [existing] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.userId, userId), eq(workouts.date, date)))
    .orderBy(desc(workouts.id))
    .limit(1);

  const status: ProposedWorkout['status'] = existing
    ? existing.completedAt != null
      ? 'completed'
      : 'in_progress'
    : 'pending';

  return {
    date,
    weekday: weekday as WeekDay,
    type,
    label,
    reasoning,
    adjusted,
    status,
    workoutId: existing?.id ?? null,
  };
}
