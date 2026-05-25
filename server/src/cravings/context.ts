import { and, eq, gte, sql } from 'drizzle-orm';
import type { CravingContext, Meals, ProjectIntensity } from '@mi-cocina/shared';
import { db } from '../db/index.js';
import { cravings, dailyLogs, healthData, users } from '../db/schema.js';

// Approximate local clock-time of each meal slot (Argentine routine), used to
// estimate "hours since last meal" — we don't store per-meal timestamps.
const MEAL_SCHEDULE: { key: keyof Meals; hour: number }[] = [
  { key: 'desayuno', hour: 8 },
  { key: 'almuerzo', hour: 13 },
  { key: 'snacks', hour: 17 },
  { key: 'cena', hour: 21 },
];

const HIGH_STRESS: ProjectIntensity[] = ['high', 'crisis'];

function dateInTz(d: Date, tz: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function localHourFraction(d: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24;
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return h + m / 60;
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

function hoursSinceLastMeal(meals: Meals | null, nowHour: number): number | null {
  if (!meals) return null;
  let lastHour: number | null = null;
  for (const { key, hour } of MEAL_SCHEDULE) {
    const eaten = typeof meals[key] === 'string' && meals[key].trim() !== '';
    if (eaten && hour <= nowHour && (lastHour === null || hour > lastHour)) {
      lastHour = hour;
    }
  }
  return lastHour === null ? null : Math.round((nowHour - lastHour) * 10) / 10;
}

export async function computeContext(userId: number, at: Date): Promise<CravingContext> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const tz = user?.timezone ?? 'UTC';
  const today = dateInTz(at, tz);
  const yesterday = dateInTz(addDays(at, -1), tz);
  const weekAgo = dateInTz(addDays(at, -60), tz);

  const [todayLog] = await db
    .select()
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, today)))
    .limit(1);

  const [todayHealth] = await db
    .select()
    .from(healthData)
    .where(and(eq(healthData.userId, userId), eq(healthData.date, today)))
    .limit(1);

  const [yesterdayHealth] = await db
    .select()
    .from(healthData)
    .where(and(eq(healthData.userId, userId), eq(healthData.date, yesterday)))
    .limit(1);

  const [{ count: weekCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(cravings)
    .where(and(eq(cravings.userId, userId), gte(cravings.timestamp, addDays(at, -7))));

  // Consecutive high-stress days ending today.
  const stressRows = await db
    .select({ date: dailyLogs.date, intensity: dailyLogs.projectIntensity })
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, userId), gte(dailyLogs.date, weekAgo)));
  const intensityByDate = new Map(stressRows.map((r) => [r.date, r.intensity]));
  let consecutiveHighStressDays = 0;
  for (let i = 0; ; i += 1) {
    const day = dateInTz(addDays(at, -i), tz);
    const intensity = intensityByDate.get(day);
    if (intensity && HIGH_STRESS.includes(intensity)) {
      consecutiveHighStressDays += 1;
    } else {
      break;
    }
  }

  const meals =
    todayLog?.meals == null
      ? null
      : typeof todayLog.meals === 'string'
        ? (JSON.parse(todayLog.meals) as Meals)
        : todayLog.meals;

  return {
    hoursSinceLastMeal: hoursSinceLastMeal(meals, localHourFraction(at, tz)),
    sleepHoursLastNight:
      todayHealth?.sleepMinutes != null
        ? Math.round((todayHealth.sleepMinutes / 60) * 10) / 10
        : null,
    hrvYesterday: yesterdayHealth?.hrvMs != null ? Number(yesterdayHealth.hrvMs) : null,
    projectIntensityToday: todayLog?.projectIntensity ?? null,
    cravingsCountThisWeek: Number(weekCount),
    consecutiveHighStressDays,
  };
}
