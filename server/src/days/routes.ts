import { Router, type Response } from 'express';
import { z } from 'zod';
import { and, eq, gte, lte } from 'drizzle-orm';
import type { DailyLog, HabitId } from '@mi-cocina/shared';
import { db } from '../db/index.js';
import {
  dailyLogs,
  habitsLogs,
  HABIT_IDS,
  PROJECT_INTENSITIES,
  type DailyLogRow,
  type HabitLogRow,
} from '../db/schema.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

const dateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD');

const mealsSchema = z.object({
  desayuno: z.string(),
  almuerzo: z.string(),
  cena: z.string(),
  snacks: z.string(),
});

const dayInputSchema = z.object({
  meals: mealsSchema.nullish(),
  waterCount: z.number().int().min(0).max(20).nullish(),
  sleepHours: z.number().min(0).max(24).nullish(),
  mood: z.number().int().min(1).max(5).nullish(),
  crossfit: z.boolean().nullish(),
  energy: z.number().int().min(1).max(5).nullish(),
  stress: z.number().int().min(0).max(10).nullish(),
  projectIntensity: z.enum(PROJECT_INTENSITIES as unknown as [string, ...string[]]).nullish(),
  weightKg: z.number().min(0).max(500).nullish(),
});

type DayInput = z.infer<typeof dayInputSchema>;

function emptyHabitMap(): Record<HabitId, boolean> {
  return Object.fromEntries(HABIT_IDS.map((h) => [h, false])) as Record<HabitId, boolean>;
}

function buildHabitMap(rows: HabitLogRow[]): Record<HabitId, boolean> {
  const map = emptyHabitMap();
  for (const r of rows) map[r.habitId] = r.completed;
  return map;
}

function mapDay(row: DailyLogRow, habits: Record<HabitId, boolean>): DailyLog {
  const meals =
    typeof row.meals === 'string' ? JSON.parse(row.meals) : (row.meals ?? null);
  return {
    date: row.date,
    meals,
    waterCount: row.waterCount,
    sleepHours: row.sleepHours != null ? Number(row.sleepHours) : null,
    mood: row.mood,
    crossfit: row.crossfit,
    energy: row.energy,
    stress: row.stress,
    projectIntensity: row.projectIntensity,
    weightKg: row.weightKg != null ? Number(row.weightKg) : null,
    savedAt: row.savedAt instanceof Date ? row.savedAt.toISOString() : String(row.savedAt),
    habits,
  };
}

function toRowValues(input: DayInput) {
  return {
    meals: input.meals ?? null,
    waterCount: input.waterCount ?? null,
    sleepHours: input.sleepHours != null ? String(input.sleepHours) : null,
    mood: input.mood ?? null,
    crossfit: input.crossfit ?? null,
    energy: input.energy ?? null,
    stress: input.stress ?? null,
    projectIntensity: (input.projectIntensity ?? null) as DailyLogRow['projectIntensity'],
    weightKg: input.weightKg != null ? String(input.weightKg) : null,
  };
}

// GET /api/days/:date → the day (merged with habits) or null
router.get('/:date', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = dateParam.safeParse(req.params.date);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid date' });
    return;
  }
  const userId = req.user!.sub;
  const date = parsed.data;

  const [dayRow] = await db
    .select()
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, date)))
    .limit(1);

  const habitRows = await db
    .select()
    .from(habitsLogs)
    .where(and(eq(habitsLogs.userId, userId), eq(habitsLogs.date, date)));

  if (!dayRow && habitRows.length === 0) {
    res.json(null);
    return;
  }

  const habits = buildHabitMap(habitRows);
  if (!dayRow) {
    const empty: DailyLog = {
      date,
      meals: null,
      waterCount: null,
      sleepHours: null,
      mood: null,
      crossfit: null,
      energy: null,
      stress: null,
      projectIntensity: null,
      weightKg: null,
      savedAt: null,
      habits,
    };
    res.json(empty);
    return;
  }
  res.json(mapDay(dayRow, habits));
});

// GET /api/days?from=YYYY-MM-DD&to=YYYY-MM-DD → range of saved days
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const from = dateParam.safeParse(req.query.from);
  const to = dateParam.safeParse(req.query.to);
  if (!from.success || !to.success) {
    res.status(400).json({ error: 'from and to must be YYYY-MM-DD' });
    return;
  }
  const userId = req.user!.sub;

  const dayRows = await db
    .select()
    .from(dailyLogs)
    .where(
      and(
        eq(dailyLogs.userId, userId),
        gte(dailyLogs.date, from.data),
        lte(dailyLogs.date, to.data),
      ),
    );

  const habitRows = await db
    .select()
    .from(habitsLogs)
    .where(
      and(
        eq(habitsLogs.userId, userId),
        gte(habitsLogs.date, from.data),
        lte(habitsLogs.date, to.data),
      ),
    );

  const habitsByDate = new Map<string, HabitLogRow[]>();
  for (const r of habitRows) {
    const list = habitsByDate.get(r.date) ?? [];
    list.push(r);
    habitsByDate.set(r.date, list);
  }

  const days = dayRows.map((row) =>
    mapDay(row, buildHabitMap(habitsByDate.get(row.date) ?? [])),
  );
  res.json(days);
});

// PUT /api/days/:date → upsert
router.put('/:date', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const dateParsed = dateParam.safeParse(req.params.date);
  if (!dateParsed.success) {
    res.status(400).json({ error: 'Invalid date' });
    return;
  }
  const bodyParsed = dayInputSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.issues[0]?.message ?? 'Invalid input' });
    return;
  }

  const userId = req.user!.sub;
  const date = dateParsed.data;
  const values = toRowValues(bodyParsed.data);
  const now = new Date();

  await db
    .insert(dailyLogs)
    .values({ userId, date, ...values, savedAt: now })
    .onDuplicateKeyUpdate({ set: { ...values, savedAt: now } });

  const [dayRow] = await db
    .select()
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, date)))
    .limit(1);

  const habitRows = await db
    .select()
    .from(habitsLogs)
    .where(and(eq(habitsLogs.userId, userId), eq(habitsLogs.date, date)));

  res.json(mapDay(dayRow!, buildHabitMap(habitRows)));
});

export default router;
