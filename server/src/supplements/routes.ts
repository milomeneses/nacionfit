import { Router, type Response } from 'express';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import type { Supplement, SupplementDoseToday, WeekDay } from '@nacionfit/shared';
import { db } from '../db/index.js';
import {
  supplementLogs,
  supplements,
  trainingBlocks,
  workouts,
  SUPPLEMENT_FREQUENCIES,
  SUPPLEMENT_TIMINGS,
  type SupplementRow,
} from '../db/schema.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { todayInTz, userTimezone, weekdayKey } from '../util/dates.js';
import { parseSlot, parseStructure } from '../training/recommend.js';

const router = Router();

function mapSupplement(row: SupplementRow): Supplement {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    dose: row.dose,
    timing: row.timing,
    frequency: row.frequency,
    specificDays: (typeof row.specificDays === 'string'
      ? JSON.parse(row.specificDays)
      : row.specificDays) as WeekDay[] | null,
    active: row.active,
    startedAt: row.startedAt ?? null,
    notes: row.notes,
  };
}

async function isTrainingDay(userId: number, date: string): Promise<boolean> {
  const weekday = weekdayKey(date);
  const [block] = await db
    .select()
    .from(trainingBlocks)
    .where(eq(trainingBlocks.userId, userId))
    .orderBy(desc(trainingBlocks.startDate))
    .limit(1);
  const structure = parseStructure(block?.weeklyStructure);
  const slotType = parseSlot(structure[weekday]).type;
  if (slotType === 'crossfit' || slotType === 'strength' || slotType === 'cardio') return true;
  const [w] = await db
    .select({ id: workouts.id })
    .from(workouts)
    .where(and(eq(workouts.userId, userId), eq(workouts.date, date)))
    .limit(1);
  return Boolean(w);
}

function scheduledToday(s: SupplementRow, weekday: WeekDay, trainingDay: boolean): boolean {
  if (s.frequency === 'daily') return true;
  if (s.frequency === 'training_days_only') return trainingDay;
  const days = (typeof s.specificDays === 'string' ? JSON.parse(s.specificDays) : s.specificDays) as
    | WeekDay[]
    | null;
  return Boolean(days?.includes(weekday));
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  brand: z.string().trim().max(80).nullish(),
  dose: z.string().trim().min(1).max(40),
  timing: z.enum(SUPPLEMENT_TIMINGS as unknown as [string, ...string[]]),
  frequency: z.enum(SUPPLEMENT_FREQUENCIES as unknown as [string, ...string[]]),
  specificDays: z.array(z.string()).nullish(),
  notes: z.string().trim().max(500).nullish(),
});

// GET /api/supplements
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const rows = await db
    .select()
    .from(supplements)
    .where(and(eq(supplements.userId, req.user!.sub), eq(supplements.active, true)))
    .orderBy(supplements.id);
  res.json(rows.map(mapSupplement));
});

// POST /api/supplements
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos' });
    return;
  }
  const userId = req.user!.sub;
  const d = parsed.data;
  await db.insert(supplements).values({
    userId,
    name: d.name,
    brand: d.brand ?? null,
    dose: d.dose,
    timing: d.timing as SupplementRow['timing'],
    frequency: d.frequency as SupplementRow['frequency'],
    specificDays: (d.specificDays ?? null) as WeekDay[] | null,
    notes: d.notes ?? null,
    startedAt: todayInTz(await userTimezone(userId)),
  });
  const [row] = await db
    .select()
    .from(supplements)
    .where(eq(supplements.userId, userId))
    .orderBy(desc(supplements.id))
    .limit(1);
  res.status(201).json(mapSupplement(row!));
});

// PATCH /api/supplements/:id
router.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const id = Number(req.params.id);
  const [existing] = await db
    .select()
    .from(supplements)
    .where(and(eq(supplements.id, id), eq(supplements.userId, req.user!.sub)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: 'No encontrado' });
    return;
  }
  const parsed = createSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos' });
    return;
  }
  const set: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) if (v !== undefined) set[k] = v;
  if (Object.keys(set).length > 0) {
    await db.update(supplements).set(set).where(eq(supplements.id, id));
  }
  const [row] = await db.select().from(supplements).where(eq(supplements.id, id)).limit(1);
  res.json(mapSupplement(row!));
});

// DELETE /api/supplements/:id (soft delete)
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const id = Number(req.params.id);
  await db
    .update(supplements)
    .set({ active: false })
    .where(and(eq(supplements.id, id), eq(supplements.userId, req.user!.sub)));
  res.json({ ok: true });
});

// GET /api/supplements/today
router.get('/today', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.sub;
  const date = todayInTz(await userTimezone(userId));
  const weekday = weekdayKey(date);
  const trainingDay = await isTrainingDay(userId, date);

  const active = await db
    .select()
    .from(supplements)
    .where(and(eq(supplements.userId, userId), eq(supplements.active, true)))
    .orderBy(supplements.id);
  const logs = await db
    .select()
    .from(supplementLogs)
    .where(and(eq(supplementLogs.userId, userId), eq(supplementLogs.date, date)));
  const logBySup = new Map(logs.map((l) => [l.supplementId, l]));

  const doses: SupplementDoseToday[] = active
    .filter((s) => scheduledToday(s, weekday, trainingDay))
    .map((s) => {
      const log = logBySup.get(s.id);
      return {
        supplement: mapSupplement(s),
        taken: log?.taken ?? false,
        takenAt: log?.takenAt ? (log.takenAt as Date).toISOString() : null,
      };
    });
  res.json(doses);
});

const logSchema = z.object({
  supplementId: z.number().int().positive(),
  taken: z.boolean().optional(),
});

// POST /api/supplements/log
router.post('/log', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = logSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos' });
    return;
  }
  const userId = req.user!.sub;
  const date = todayInTz(await userTimezone(userId));
  const taken = parsed.data.taken ?? true;
  const takenAt = taken ? new Date() : null;
  await db
    .insert(supplementLogs)
    .values({ userId, supplementId: parsed.data.supplementId, date, taken, takenAt })
    .onDuplicateKeyUpdate({ set: { taken, takenAt } });
  res.json({ ok: true });
});

export default router;
