import { Router, type Response } from 'express';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import type { MobilityExercise, MobilityRoutine } from '@nacionfit/shared';
import { db } from '../db/index.js';
import { mobilityRoutines, workouts, type MobilityRoutineRow } from '../db/schema.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { todayInTz, userTimezone } from '../util/dates.js';

const router = Router();

function mapRoutine(row: MobilityRoutineRow): MobilityRoutine {
  return {
    id: row.id,
    name: row.name,
    durationMinutes: row.durationMinutes,
    exercises: (typeof row.exercises === 'string'
      ? JSON.parse(row.exercises)
      : (row.exercises ?? [])) as MobilityExercise[],
  };
}

// GET /api/mobility/routines
router.get('/routines', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const rows = await db
    .select()
    .from(mobilityRoutines)
    .where(eq(mobilityRoutines.userId, req.user!.sub))
    .orderBy(mobilityRoutines.durationMinutes);
  res.json(rows.map(mapRoutine));
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  durationMinutes: z.number().int().min(1).max(120),
  exercises: z.array(
    z.object({
      name: z.string().min(1),
      durationSec: z.number().int().positive().optional(),
      reps: z.number().int().positive().optional(),
      notes: z.string().optional(),
    }),
  ),
});

// POST /api/mobility/routines
router.post('/routines', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos' });
    return;
  }
  const userId = req.user!.sub;
  await db.insert(mobilityRoutines).values({
    userId,
    name: parsed.data.name,
    durationMinutes: parsed.data.durationMinutes,
    exercises: parsed.data.exercises,
  });
  const [row] = await db
    .select()
    .from(mobilityRoutines)
    .where(eq(mobilityRoutines.userId, userId))
    .orderBy(desc(mobilityRoutines.id))
    .limit(1);
  res.status(201).json(mapRoutine(row!));
});

const logSchema = z.object({
  routineId: z.number().int().positive().optional(),
  name: z.string().trim().max(120).optional(),
  durationMinutes: z.number().int().min(1).max(120).optional(),
});

// POST /api/mobility/log — logs a completed mobility routine as a workout
router.post('/log', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = logSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos' });
    return;
  }
  const userId = req.user!.sub;
  const date = todayInTz(await userTimezone(userId));
  let name = parsed.data.name ?? 'Movilidad';
  let duration = parsed.data.durationMinutes ?? null;

  if (parsed.data.routineId) {
    const [routine] = await db
      .select()
      .from(mobilityRoutines)
      .where(and(eq(mobilityRoutines.id, parsed.data.routineId), eq(mobilityRoutines.userId, userId)))
      .limit(1);
    if (routine) {
      name = routine.name;
      duration = routine.durationMinutes;
    }
  }

  await db.insert(workouts).values({
    userId,
    date,
    type: 'mobility',
    completedAt: new Date(),
    durationMinutes: duration,
    source: 'app_logged',
    workoutData: { routineId: parsed.data.routineId ?? null, name },
  });
  res.status(201).json({ ok: true });
});

export default router;
