import { Router, type Response } from 'express';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import type { HabitId, HabitLog } from '@mi-cocina/shared';
import { db } from '../db/index.js';
import { habitsLogs, HABIT_IDS } from '../db/schema.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

const toggleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  habitId: z.enum(HABIT_IDS as unknown as [string, ...string[]]),
  completed: z.boolean(),
});

// POST /api/habits/toggle → upsert a habit's completion for a day
router.post('/toggle', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = toggleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });
    return;
  }

  const userId = req.user!.sub;
  const { date, completed } = parsed.data;
  const habitId = parsed.data.habitId as HabitId;

  await db
    .insert(habitsLogs)
    .values({ userId, date, habitId, completed })
    .onDuplicateKeyUpdate({ set: { completed } });

  const result: HabitLog = { date, habitId, completed };
  res.json(result);
});

export default router;
