import { Router, type Response } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import type { WeeklyReviewSummary } from '@nacionfit/shared';
import { db } from '../db/index.js';
import { weeklyReviews } from '../db/schema.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { GeminiNotConfiguredError, isGeminiConfigured } from './gemini.js';
import {
  generateReview,
  lastCompletedWeek,
  mapReviewRow,
  todayInTz,
  userTimezone,
} from './reviewService.js';

const router = Router();
const dateRe = /^\d{4}-\d{2}-\d{2}$/;

// POST /api/reviews/generate — generate for the current user's last completed week
router.post('/generate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!isGeminiConfigured()) {
    res.status(503).json({ error: 'El review no está configurado (falta GEMINI_API_KEY).' });
    return;
  }
  const userId = req.user!.sub;
  const tz = await userTimezone(userId);
  const { weekStart } = lastCompletedWeek(todayInTz(tz));

  try {
    const review = await generateReview(userId, weekStart);
    res.status(201).json(review);
  } catch (err) {
    if (err instanceof GeminiNotConfiguredError) {
      res.status(503).json({ error: 'El review no está configurado.' });
      return;
    }
    res.status(502).json({ error: 'No se pudo generar el review en este momento.' });
  }
});

// GET /api/reviews — summaries, newest first
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const rows = await db
    .select()
    .from(weeklyReviews)
    .where(eq(weeklyReviews.userId, req.user!.sub))
    .orderBy(desc(weeklyReviews.weekStart));
  const result: WeeklyReviewSummary[] = rows.map((r) => ({
    weekStart: r.weekStart,
    weekEnd: r.weekEnd,
    narrative: r.narrative ?? '',
    generatedAt: r.generatedAt.toISOString(),
    readAt: r.readAt ? r.readAt.toISOString() : null,
  }));
  res.json(result);
});

// GET /api/reviews/:week_start — full review
router.get('/:week_start', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!dateRe.test(req.params.week_start)) {
    res.status(400).json({ error: 'Fecha inválida' });
    return;
  }
  const [row] = await db
    .select()
    .from(weeklyReviews)
    .where(
      and(
        eq(weeklyReviews.userId, req.user!.sub),
        eq(weeklyReviews.weekStart, req.params.week_start),
      ),
    )
    .limit(1);
  if (!row) {
    res.status(404).json({ error: 'Review no encontrado' });
    return;
  }
  res.json(mapReviewRow(row));
});

// POST /api/reviews/:week_start/mark-read
router.post(
  '/:week_start/mark-read',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    if (!dateRe.test(req.params.week_start)) {
      res.status(400).json({ error: 'Fecha inválida' });
      return;
    }
    await db
      .update(weeklyReviews)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(weeklyReviews.userId, req.user!.sub),
          eq(weeklyReviews.weekStart, req.params.week_start),
        ),
      );
    res.json({ ok: true });
  },
);

export default router;
