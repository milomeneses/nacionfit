import { Router, type Response } from 'express';
import { z } from 'zod';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import type {
  TrainingBlock,
  TrainingPlanResponse,
  TrainingWeekRecap,
  Workout,
} from '@nacionfit/shared';
import { db } from '../db/index.js';
import {
  hydrationLogs,
  supplementLogs,
  supplements,
  trainingBlocks,
  workouts,
  TRAINING_FOCUSES,
  WORKOUT_TYPES,
  type TrainingBlockRow,
  type WorkoutRow,
} from '../db/schema.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { mondayOf, todayInTz, userTimezone, weekDates } from '../util/dates.js';
import { parseSlot, parseStructure, proposeWorkout } from './recommend.js';

export const trainingRouter = Router();
export const workoutsRouter = Router();

function mapBlock(row: TrainingBlockRow): TrainingBlock {
  return {
    id: row.id,
    name: row.name,
    startDate: row.startDate ?? null,
    endDate: row.endDate ?? null,
    focus: row.focus,
    weeklyStructure: parseStructure(row.weeklyStructure) as TrainingBlock['weeklyStructure'],
  };
}

function mapWorkout(row: WorkoutRow): Workout {
  const wd = typeof row.workoutData === 'string' ? JSON.parse(row.workoutData) : (row.workoutData ?? null);
  return {
    id: row.id,
    date: row.date,
    type: row.type,
    plannedAt: row.plannedAt ? (row.plannedAt as Date).toISOString() : null,
    completedAt: row.completedAt ? (row.completedAt as Date).toISOString() : null,
    durationMinutes: row.durationMinutes,
    rpe: row.rpe,
    notes: row.notes,
    source: row.source,
    workoutData: wd,
  };
}

async function activeBlock(userId: number, date: string): Promise<TrainingBlockRow | null> {
  const blocks = await db
    .select()
    .from(trainingBlocks)
    .where(eq(trainingBlocks.userId, userId))
    .orderBy(desc(trainingBlocks.startDate));
  return (
    blocks.find((b) => (!b.startDate || b.startDate <= date) && (!b.endDate || b.endDate >= date)) ??
    blocks[0] ??
    null
  );
}

// GET /api/training/plan
trainingRouter.get('/plan', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.sub;
  const today = todayInTz(await userTimezone(userId));
  const block = await activeBlock(userId, today);
  const structure = parseStructure(block?.weeklyStructure);
  const week = weekDates(mondayOf(today)).map(({ day, date }) => ({
    day,
    date,
    label: parseSlot(structure[day]).label,
  }));
  const result: TrainingPlanResponse = { block: block ? mapBlock(block) : null, week };
  res.json(result);
});

const blockSchema = z.object({
  name: z.string().trim().min(1).max(120),
  focus: z.enum(TRAINING_FOCUSES as unknown as [string, ...string[]]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  weeklyStructure: z.record(z.string(), z.string()),
});

// POST /api/training/plan — create or update the user's current block
trainingRouter.post('/plan', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = blockSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos' });
    return;
  }
  const userId = req.user!.sub;
  const data = parsed.data;
  const [latest] = await db
    .select()
    .from(trainingBlocks)
    .where(eq(trainingBlocks.userId, userId))
    .orderBy(desc(trainingBlocks.id))
    .limit(1);

  const values = {
    name: data.name,
    focus: data.focus as TrainingBlockRow['focus'],
    startDate: data.startDate ?? null,
    endDate: data.endDate ?? null,
    weeklyStructure: data.weeklyStructure,
  };
  let id: number;
  if (latest) {
    await db.update(trainingBlocks).set(values).where(eq(trainingBlocks.id, latest.id));
    id = latest.id;
  } else {
    await db.insert(trainingBlocks).values({ userId, ...values });
    const [created] = await db
      .select()
      .from(trainingBlocks)
      .where(eq(trainingBlocks.userId, userId))
      .orderBy(desc(trainingBlocks.id))
      .limit(1);
    id = created!.id;
  }
  const [row] = await db.select().from(trainingBlocks).where(eq(trainingBlocks.id, id)).limit(1);
  res.json(mapBlock(row!));
});

// GET /api/training/today
trainingRouter.get('/today', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.sub;
  const today = todayInTz(await userTimezone(userId));
  res.json(await proposeWorkout(userId, today));
});

// GET /api/training/recap — this week's training recap (framed positively)
trainingRouter.get('/recap', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.sub;
  const tz = await userTimezone(userId);
  const today = todayInTz(tz);
  const monday = mondayOf(today);

  const block = await activeBlock(userId, today);
  const structure = parseStructure(block?.weeklyStructure);
  const workoutsPlanned = Object.values(structure).filter((s) => {
    const t = parseSlot(s).type;
    return t === 'crossfit' || t === 'strength' || t === 'cardio';
  }).length;

  const weekWorkouts = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.userId, userId), gte(workouts.date, monday), lte(workouts.date, today)));
  const completedTraining = weekWorkouts.filter(
    (w) => w.completedAt != null && (w.type === 'crossfit' || w.type === 'strength' || w.type === 'cardio'),
  );
  const rpes = completedTraining.map((w) => w.rpe).filter((x): x is number => x != null);
  const mobilityMinutes = weekWorkouts
    .filter((w) => w.type === 'mobility' && w.completedAt != null)
    .reduce((a, w) => a + (w.durationMinutes ?? 0), 0);

  const hydra = await db
    .select()
    .from(hydrationLogs)
    .where(and(eq(hydrationLogs.userId, userId), gte(hydrationLogs.date, monday)));
  const hydrationDaysHit = hydra.filter((h) => h.targetMl != null && h.consumedMl >= h.targetMl).length;

  const [{ active }] = await db
    .select({ active: sql<number>`count(*)` })
    .from(supplements)
    .where(and(eq(supplements.userId, userId), eq(supplements.active, true)));
  const takenThisWeek = await db
    .select({ id: supplementLogs.id })
    .from(supplementLogs)
    .where(and(eq(supplementLogs.userId, userId), gte(supplementLogs.date, monday), eq(supplementLogs.taken, true)));
  const daysElapsed = Math.round((Date.parse(today) - Date.parse(monday)) / 86_400_000) + 1;
  const expected = Number(active) * daysElapsed;

  const recap: TrainingWeekRecap = {
    workoutsCompleted: completedTraining.length,
    workoutsPlanned,
    avgRpe: rpes.length ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 : null,
    mobilityMinutes,
    hydrationDaysHit,
    hydrationDaysTotal: daysElapsed,
    supplementAdherencePct: expected > 0 ? Math.round((takenThisWeek.length / expected) * 100) : 0,
  };
  res.json(recap);
});

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const workoutSchema = z.object({
  date: z.string().regex(dateRe),
  type: z.enum(WORKOUT_TYPES as unknown as [string, ...string[]]),
  durationMinutes: z.number().int().min(0).max(600).nullish(),
  rpe: z.number().int().min(1).max(10).nullish(),
  notes: z.string().trim().max(2000).nullish(),
  workoutData: z.unknown().optional(),
});

// GET /api/workouts?from=&to=
workoutsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.sub;
  const today = todayInTz(await userTimezone(userId));
  const from = dateRe.test(String(req.query.from)) ? String(req.query.from) : '2000-01-01';
  const to = dateRe.test(String(req.query.to)) ? String(req.query.to) : today;
  const rows = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.userId, userId), gte(workouts.date, from), lte(workouts.date, to)))
    .orderBy(desc(workouts.date));
  res.json(rows.map(mapWorkout));
});

// POST /api/workouts — log a completed workout
workoutsRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = workoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos' });
    return;
  }
  const userId = req.user!.sub;
  const d = parsed.data;
  await db.insert(workouts).values({
    userId,
    date: d.date,
    type: d.type as WorkoutRow['type'],
    completedAt: new Date(),
    durationMinutes: d.durationMinutes ?? null,
    rpe: d.rpe ?? null,
    notes: d.notes ?? null,
    source: 'app_logged',
    workoutData: d.workoutData ?? null,
  });
  const [row] = await db
    .select()
    .from(workouts)
    .where(eq(workouts.userId, userId))
    .orderBy(desc(workouts.id))
    .limit(1);
  res.status(201).json(mapWorkout(row!));
});

const patchSchema = z.object({
  type: z.enum(WORKOUT_TYPES as unknown as [string, ...string[]]).optional(),
  durationMinutes: z.number().int().min(0).max(600).nullish(),
  rpe: z.number().int().min(1).max(10).nullish(),
  notes: z.string().trim().max(2000).nullish(),
  completed: z.boolean().optional(),
  workoutData: z.unknown().optional(),
});

// PATCH /api/workouts/:id
workoutsRouter.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const id = Number(req.params.id);
  const [existing] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, id), eq(workouts.userId, req.user!.sub)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: 'No encontrado' });
    return;
  }
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos' });
    return;
  }
  const d = parsed.data;
  const set: Record<string, unknown> = {};
  if (d.type !== undefined) set.type = d.type;
  if (d.durationMinutes !== undefined) set.durationMinutes = d.durationMinutes;
  if (d.rpe !== undefined) set.rpe = d.rpe;
  if (d.notes !== undefined) set.notes = d.notes;
  if (d.workoutData !== undefined) set.workoutData = d.workoutData;
  if (d.completed !== undefined) set.completedAt = d.completed ? new Date() : null;
  if (Object.keys(set).length > 0) {
    await db.update(workouts).set(set).where(eq(workouts.id, id));
  }
  const [row] = await db.select().from(workouts).where(eq(workouts.id, id)).limit(1);
  res.json(mapWorkout(row!));
});

// DELETE /api/workouts/:id
workoutsRouter.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const id = Number(req.params.id);
  await db
    .delete(workouts)
    .where(and(eq(workouts.id, id), eq(workouts.userId, req.user!.sub)));
  res.json({ ok: true });
});
