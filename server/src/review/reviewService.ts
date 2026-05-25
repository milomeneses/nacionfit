import { and, asc, eq, gte, lte } from 'drizzle-orm';
import type {
  CravingTrigger,
  HabitId,
  ReviewExperiment,
  ReviewInsight,
  WeeklyReview,
  WeeklyReviewData,
} from '@nacionfit/shared';
import { db } from '../db/index.js';
import {
  cravings,
  dailyLogs,
  habitsLogs,
  healthData,
  users,
  weeklyReviews,
  type WeeklyReviewRow,
} from '../db/schema.js';
import { generateJson } from './gemini.js';

// ----- date helpers (calendar-string math) -----

function toDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function fromDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(s: string, n: number): string {
  const d = toDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fromDate(d);
}
function dow(s: string): number {
  return (toDate(s).getUTCDay() + 6) % 7; // Mon=0..Sun=6
}

export function todayInTz(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function localDate(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export async function userTimezone(userId: number): Promise<string> {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return u?.timezone ?? 'UTC';
}

/** The most recently completed Mon–Sun week relative to `today` (local). */
export function lastCompletedWeek(today: string): { weekStart: string; weekEnd: string } {
  const d = dow(today);
  const back = d === 6 ? 0 : d + 1; // days back to the most recent Sunday
  const weekEnd = addDays(today, -back);
  return { weekStart: addDays(weekEnd, -6), weekEnd };
}

const HABIT_LIST: HabitId[] = [
  'meditacion',
  'lectura',
  'estiramiento',
  'sin_azucar',
  'suplementos',
  'pasos',
];

const round1 = (n: number) => Math.round(n * 10) / 10;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export async function gatherWeeklyData(
  userId: number,
  weekStart: string,
): Promise<WeeklyReviewData> {
  const weekEnd = addDays(weekStart, 6);
  const windowStart = addDays(weekStart, -21);
  const tz = await userTimezone(userId);

  const logs = await db
    .select()
    .from(dailyLogs)
    .where(
      and(eq(dailyLogs.userId, userId), gte(dailyLogs.date, windowStart), lte(dailyLogs.date, weekEnd)),
    )
    .orderBy(asc(dailyLogs.date));
  const habits = await db
    .select()
    .from(habitsLogs)
    .where(
      and(eq(habitsLogs.userId, userId), gte(habitsLogs.date, windowStart), lte(habitsLogs.date, weekEnd)),
    );
  const health = await db
    .select()
    .from(healthData)
    .where(
      and(eq(healthData.userId, userId), gte(healthData.date, windowStart), lte(healthData.date, weekEnd)),
    );
  const cravingRows = await db
    .select()
    .from(cravings)
    .where(
      and(
        eq(cravings.userId, userId),
        gte(cravings.timestamp, toDate(windowStart)),
        lte(cravings.timestamp, new Date(`${weekEnd}T23:59:59Z`)),
      ),
    );
  const cravingsWithDate = cravingRows.map((c) => ({
    ...c,
    localDate: localDate(c.timestamp as Date, tz),
  }));

  const inWeek = (date: string, ws: string) => date >= ws && date <= addDays(ws, 6);

  function weekDigest(ws: string) {
    const we = addDays(ws, 6);
    const wLogs = logs.filter((l) => l.date >= ws && l.date <= we);
    const wHealth = health.filter((h) => h.date >= ws && h.date <= we);
    const wHabits = habits.filter((h) => h.date >= ws && h.date <= we);
    const wCravings = cravingsWithDate.filter((c) => inWeek(c.localDate, ws));

    const weights = wLogs
      .map((l) => (l.weightKg != null ? Number(l.weightKg) : null))
      .filter((x): x is number => x != null);
    const kgChange = weights.length >= 2 ? round1(weights[weights.length - 1] - weights[0]) : null;

    const sleeps = wHealth
      .map((h) => h.sleepMinutes)
      .filter((x): x is number => x != null)
      .map((m) => m / 60);
    const avgSleepHours = sleeps.length ? round1(mean(sleeps)!) : null;

    const habitDone = wHabits.filter((h) => h.completed).length;
    const habitRate = wHabits.length ? round1(habitDone / wHabits.length) : null;

    return { we, wLogs, wHealth, wHabits, wCravings, kgChange, avgSleepHours, habitRate };
  }

  const target = weekDigest(weekStart);

  // Per-habit completion this week
  const habitCompletion = HABIT_LIST.map((habitId) => {
    const rows = target.wHabits.filter((h) => h.habitId === habitId);
    const done = rows.filter((h) => h.completed).length;
    return { habitId, rate: rows.length ? round1(done / rows.length) : 0 };
  });

  // Variance (weekday vs weekend habit completion)
  const dayRate = new Map<string, { done: number; total: number }>();
  for (const h of target.wHabits) {
    const e = dayRate.get(h.date) ?? { done: 0, total: 0 };
    e.total += 1;
    if (h.completed) e.done += 1;
    dayRate.set(h.date, e);
  }
  const wd: number[] = [];
  const we: number[] = [];
  for (const [date, { done, total }] of dayRate) {
    (dow(date) <= 4 ? wd : we).push(done / total);
  }
  const variance =
    wd.length && we.length ? round1(Math.abs(mean(wd)! - mean(we)!)) : null;

  const hrvs = target.wHealth
    .map((h) => (h.hrvMs != null ? Number(h.hrvMs) : null))
    .filter((x): x is number => x != null);

  const triggerCounts = new Map<CravingTrigger, number>();
  for (const c of target.wCravings) triggerCounts.set(c.trigger, (triggerCounts.get(c.trigger) ?? 0) + 1);

  const highStressDays = target.wLogs.filter(
    (l) => l.projectIntensity === 'high' || l.projectIntensity === 'crisis',
  ).length;

  const previousWeeks = [3, 2, 1].map((n) => {
    const ws = addDays(weekStart, -7 * n);
    const dg = weekDigest(ws);
    return {
      weekStart: ws,
      kgChange: dg.kgChange,
      avgSleepHours: dg.avgSleepHours,
      cravingsTotal: dg.wCravings.length,
      habitRate: dg.habitRate,
    };
  });

  return {
    kgChange: target.kgChange,
    habitCompletion,
    avgSleepHours: target.avgSleepHours,
    avgHrv: hrvs.length ? round1(mean(hrvs)!) : null,
    cravingsByTrigger: [...triggerCounts.entries()]
      .map(([trigger, count]) => ({ trigger, count }))
      .sort((a, b) => b.count - a.count),
    cravingsTotal: target.wCravings.length,
    variance,
    highStressDays,
    previousWeeks,
  };
}

const SYSTEM_INSTRUCTION = `Sos un amigo atento que leyó todos los registros de la semana de la persona y le escribís su "review semanal" en español rioplatense (vos, tenés, querés). Cálido, específico y honesto; nunca sermoneás ni usás "deberías", "tenés que" ni "no es saludable".

Reglas:
- Identificá EXACTAMENTE 3 patrones específicos de ESTA semana, citando números reales de los datos (no observaciones genéricas).
- Conectá esos patrones con las semanas anteriores cuando los datos lo permitan (ej.: "como las últimas dos semanas...").
- Proponé EXACTAMENTE 1 experimento chico para la semana que viene, con un criterio de éxito claro y medible.
- Dejá los términos técnicos en su idioma (HRV, deep sleep).
- Devolvé SOLO JSON válido, sin texto extra, con esta forma EXACTA:
{
  "narrative": "apertura cálida de 2 a 3 oraciones",
  "insights": [
    { "title": "título corto", "body": "1-2 oraciones con el dato concreto" },
    { "title": "...", "body": "..." },
    { "title": "...", "body": "..." }
  ],
  "experiment": { "title": "título del experimento", "body": "qué probar la semana que viene", "success_criteria": "cómo sabés que funcionó, medible" }
}`;

interface ParsedReview {
  narrative: string;
  insights: ReviewInsight[];
  experiment: ReviewExperiment;
}

function parseReview(text: string): ParsedReview {
  // Strip code fences if the model added them.
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  const obj = JSON.parse(cleaned);
  if (
    typeof obj.narrative !== 'string' ||
    !Array.isArray(obj.insights) ||
    !obj.experiment ||
    typeof obj.experiment.success_criteria !== 'string'
  ) {
    throw new Error('Review JSON did not match the expected shape');
  }
  return {
    narrative: obj.narrative,
    insights: obj.insights
      .slice(0, 3)
      .map((i: { title?: string; body?: string }) => ({ title: i.title ?? '', body: i.body ?? '' })),
    experiment: {
      title: obj.experiment.title ?? '',
      body: obj.experiment.body ?? '',
      success_criteria: obj.experiment.success_criteria,
    },
  };
}

export function mapReviewRow(row: WeeklyReviewRow): WeeklyReview {
  const parse = <T>(v: unknown): T => (typeof v === 'string' ? JSON.parse(v) : v) as T;
  return {
    weekStart: row.weekStart,
    weekEnd: row.weekEnd,
    narrative: row.narrative ?? '',
    insights: row.insights ? parse<ReviewInsight[]>(row.insights) : [],
    experiment: row.experiment
      ? parse<ReviewExperiment>(row.experiment)
      : { title: '', body: '', success_criteria: '' },
    data: row.rawData
      ? parse<WeeklyReviewData>(row.rawData)
      : ({} as WeeklyReviewData),
    generatedAt:
      row.generatedAt instanceof Date ? row.generatedAt.toISOString() : String(row.generatedAt),
    readAt: row.readAt ? (row.readAt as Date).toISOString() : null,
  };
}

export async function generateReview(userId: number, weekStart: string): Promise<WeeklyReview> {
  const weekEnd = addDays(weekStart, 6);
  const data = await gatherWeeklyData(userId, weekStart);

  const userPrompt = `Semana a revisar: ${weekStart} (lunes) a ${weekEnd} (domingo).

Datos de la semana y comparación con las 3 semanas previas (JSON):
${JSON.stringify(data, null, 2)}

Generá el review siguiendo las reglas y el formato JSON indicados.`;

  const text = await generateJson(SYSTEM_INSTRUCTION, userPrompt);
  const parsed = parseReview(text);
  const now = new Date();

  const values = {
    userId,
    weekStart,
    weekEnd,
    narrative: parsed.narrative,
    insights: parsed.insights,
    experiment: parsed.experiment,
    rawData: data,
    generatedAt: now,
    readAt: null,
  };
  await db
    .insert(weeklyReviews)
    .values(values)
    .onDuplicateKeyUpdate({
      set: {
        weekEnd,
        narrative: parsed.narrative,
        insights: parsed.insights,
        experiment: parsed.experiment,
        rawData: data,
        generatedAt: now,
        readAt: null,
      },
    });

  const [row] = await db
    .select()
    .from(weeklyReviews)
    .where(and(eq(weeklyReviews.userId, userId), eq(weeklyReviews.weekStart, weekStart)))
    .limit(1);
  return mapReviewRow(row!);
}
