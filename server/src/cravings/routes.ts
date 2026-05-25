import { Router, type Response } from 'express';
import { z } from 'zod';
import { and, desc, eq, gte } from 'drizzle-orm';
import type {
  Craving,
  CravingAction,
  CravingStats,
  CravingTrigger,
} from '@nacionfit/shared';
import { db } from '../db/index.js';
import {
  cravings,
  CRAVING_ACTIONS,
  CRAVING_TRIGGERS,
  type CravingRow,
} from '../db/schema.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { computeContext } from './context.js';

const router = Router();

const createSchema = z.object({
  food: z.string().trim().min(1).max(120),
  intensity: z.number().int().min(1).max(10),
  trigger: z.enum(CRAVING_TRIGGERS as unknown as [string, ...string[]]),
  action: z.enum(CRAVING_ACTIONS as unknown as [string, ...string[]]),
  note: z.string().trim().max(2000).nullish(),
  timestamp: z.string().datetime().optional(),
});

function mapRow(row: CravingRow): Craving {
  const context =
    typeof row.context === 'string' ? JSON.parse(row.context) : (row.context ?? null);
  return {
    id: row.id,
    timestamp:
      row.timestamp instanceof Date ? row.timestamp.toISOString() : String(row.timestamp),
    food: row.food,
    intensity: row.intensity,
    trigger: row.trigger,
    action: row.action,
    note: row.note,
    context,
  };
}

// POST /api/cravings — create a craving and snapshot the current context.
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });
    return;
  }
  const userId = req.user!.sub;
  const at = parsed.data.timestamp ? new Date(parsed.data.timestamp) : new Date();
  const context = await computeContext(userId, at);

  await db.insert(cravings).values({
    userId,
    timestamp: at,
    food: parsed.data.food,
    intensity: parsed.data.intensity,
    trigger: parsed.data.trigger as CravingTrigger,
    action: parsed.data.action as CravingAction,
    note: parsed.data.note ?? null,
    context,
  });

  const [row] = await db
    .select()
    .from(cravings)
    .where(eq(cravings.userId, userId))
    .orderBy(desc(cravings.id))
    .limit(1);

  res.status(201).json(mapRow(row!));
});

// GET /api/cravings/context — the current vulnerability context (no insert).
router.get('/context', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const context = await computeContext(req.user!.sub, new Date());
  res.json(context);
});

// GET /api/cravings/stats — pattern summary for the current user.
router.get('/stats', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.sub;
  const rows = await db
    .select()
    .from(cravings)
    .where(eq(cravings.userId, userId))
    .orderBy(desc(cravings.timestamp))
    .limit(1000);

  const total = rows.length;
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const countLast7d = rows.filter((r) => r.timestamp >= weekAgo).length;
  const managed = rows.filter((r) => r.action !== 'cedi').length;

  const tally = <T extends string>(values: T[]): { key: T; count: number } | null => {
    const counts = new Map<T, number>();
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
    let best: { key: T; count: number } | null = null;
    for (const [key, count] of counts) {
      if (!best || count > best.count) best = { key, count };
    }
    return best;
  };

  const topTriggerRaw = tally(rows.map((r) => r.trigger));
  const topFoodRaw = tally(rows.map((r) => r.food));

  const stats: CravingStats = {
    total,
    countLast7d,
    managedPct: total === 0 ? 0 : Math.round((managed / total) * 100),
    topTrigger: topTriggerRaw
      ? { trigger: topTriggerRaw.key, count: topTriggerRaw.count }
      : null,
    topFood: topFoodRaw ? { food: topFoodRaw.key, count: topFoodRaw.count } : null,
  };
  res.json(stats);
});

// GET /api/cravings?limit=20 — recent cravings, newest first.
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const rows = await db
    .select()
    .from(cravings)
    .where(eq(cravings.userId, req.user!.sub))
    .orderBy(desc(cravings.timestamp))
    .limit(limit);
  res.json(rows.map(mapRow));
});

export default router;
