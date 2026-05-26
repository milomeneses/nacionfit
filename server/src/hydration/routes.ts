import { Router, type Response } from 'express';
import { z } from 'zod';
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import type { DrinkSource, HydrationEntry, HydrationToday } from '@nacionfit/shared';
import { db } from '../db/index.js';
import { dailyLogs, hydrationLogs, workouts } from '../db/schema.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { todayInTz, userTimezone } from '../util/dates.js';

const router = Router();

const DEFAULT_WEIGHT_KG = 75;

/** Dynamic daily target: 35ml × weight, +500 if trained, +200 if high stress. */
export async function computeTarget(
  userId: number,
  date: string,
): Promise<{ targetMl: number; bonuses: { label: string; ml: number }[] }> {
  const [latestWeight] = await db
    .select({ w: dailyLogs.weightKg })
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, userId), isNotNull(dailyLogs.weightKg)))
    .orderBy(desc(dailyLogs.date))
    .limit(1);
  const weight = latestWeight?.w != null ? Number(latestWeight.w) : DEFAULT_WEIGHT_KG;
  const base = Math.round(35 * weight);
  const bonuses: { label: string; ml: number }[] = [];

  const [trained] = await db
    .select({ id: workouts.id })
    .from(workouts)
    .where(and(eq(workouts.userId, userId), eq(workouts.date, date), isNotNull(workouts.completedAt)))
    .limit(1);
  if (trained) bonuses.push({ label: 'Hoy entrenaste', ml: 500 });

  const [day] = await db
    .select({ intensity: dailyLogs.projectIntensity })
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, date)))
    .limit(1);
  if (day?.intensity === 'high' || day?.intensity === 'crisis') {
    bonuses.push({ label: 'Día de proyecto intenso', ml: 200 });
  }
  // temperature/humidity bonus — skipped in v1 (no weather source)

  const targetMl = base + bonuses.reduce((a, b) => a + b.ml, 0);
  return { targetMl, bonuses };
}

function parseEntries(v: unknown): HydrationEntry[] {
  if (!v) return [];
  return (typeof v === 'string' ? JSON.parse(v) : v) as HydrationEntry[];
}

async function buildToday(userId: number, date: string): Promise<HydrationToday> {
  const { targetMl, bonuses } = await computeTarget(userId, date);
  const [row] = await db
    .select()
    .from(hydrationLogs)
    .where(and(eq(hydrationLogs.userId, userId), eq(hydrationLogs.date, date)))
    .limit(1);
  const entries = parseEntries(row?.entries);
  const consumedMl = entries.reduce((a, e) => a + e.amountMl, 0);
  // keep the stored target/consumed fresh
  await db
    .insert(hydrationLogs)
    .values({ userId, date, targetMl, consumedMl, entries })
    .onDuplicateKeyUpdate({ set: { targetMl, consumedMl } });
  return { date, targetMl, consumedMl, entries, bonuses };
}

// GET /api/hydration/today
router.get('/today', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.sub;
  const date = todayInTz(await userTimezone(userId));
  res.json(await buildToday(userId, date));
});

const logSchema = z.object({
  amountMl: z.number().int().min(1).max(3000),
  source: z.enum(['water', 'coffee', 'tea', 'mate', 'other']),
});

// POST /api/hydration/log
router.post('/log', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = logSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos' });
    return;
  }
  const userId = req.user!.sub;
  const date = todayInTz(await userTimezone(userId));
  const source = parsed.data.source as DrinkSource;
  // coffee/tea/mate hydrate ~80%
  const factor = source === 'coffee' || source === 'tea' || source === 'mate' ? 0.8 : 1;
  const counted = Math.round(parsed.data.amountMl * factor);

  const [existing] = await db
    .select()
    .from(hydrationLogs)
    .where(and(eq(hydrationLogs.userId, userId), eq(hydrationLogs.date, date)))
    .limit(1);
  const entries = parseEntries(existing?.entries);
  entries.push({
    time: new Date().toISOString(),
    amountMl: counted,
    source,
  });
  const consumedMl = entries.reduce((a, e) => a + e.amountMl, 0);
  const { targetMl } = await computeTarget(userId, date);
  await db
    .insert(hydrationLogs)
    .values({ userId, date, targetMl, consumedMl, entries })
    .onDuplicateKeyUpdate({ set: { consumedMl, entries, targetMl } });

  res.json(await buildToday(userId, date));
});

export default router;
