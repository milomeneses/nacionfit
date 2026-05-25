import { randomBytes } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { and, desc, eq, gte } from 'drizzle-orm';
import type { HealthData, WebhookTokenInfo } from '@nacionfit/shared';
import { db } from '../db/index.js';
import {
  healthData,
  userWebhookTokens,
  type HealthDataInsert,
  type HealthDataRow,
} from '../db/schema.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { parseHealthExport, type DayMetrics } from './parse.js';

const router = Router();

function mapRow(row: HealthDataRow): HealthData {
  return {
    date: row.date,
    sleepMinutes: row.sleepMinutes,
    deepSleepMinutes: row.deepSleepMinutes,
    remSleepMinutes: row.remSleepMinutes,
    awakeMinutes: row.awakeMinutes,
    hrvMs: row.hrvMs != null ? Number(row.hrvMs) : null,
    restingHr: row.restingHr,
    steps: row.steps,
    activeCalories: row.activeCalories,
    source: row.source,
    syncedAt:
      row.syncedAt instanceof Date ? row.syncedAt.toISOString() : String(row.syncedAt),
  };
}

function toColumns(m: DayMetrics): Partial<HealthDataInsert> {
  const r: Partial<HealthDataInsert> = {};
  if (m.sleepMinutes !== undefined) r.sleepMinutes = m.sleepMinutes;
  if (m.deepSleepMinutes !== undefined) r.deepSleepMinutes = m.deepSleepMinutes;
  if (m.remSleepMinutes !== undefined) r.remSleepMinutes = m.remSleepMinutes;
  if (m.awakeMinutes !== undefined) r.awakeMinutes = m.awakeMinutes;
  if (m.hrvMs !== undefined) r.hrvMs = String(m.hrvMs);
  if (m.restingHr !== undefined) r.restingHr = m.restingHr;
  if (m.steps !== undefined) r.steps = m.steps;
  if (m.activeCalories !== undefined) r.activeCalories = m.activeCalories;
  if (m.source !== undefined) r.source = m.source;
  return r;
}

function newToken(): string {
  return randomBytes(24).toString('hex');
}

// POST /api/health/webhook/:token — public, authenticated by the URL token.
// Accepts Health Auto Export JSON and upserts per-day metrics.
router.post('/webhook/:token', async (req: Request, res: Response) => {
  const [tokenRow] = await db
    .select()
    .from(userWebhookTokens)
    .where(eq(userWebhookTokens.token, req.params.token))
    .limit(1);
  if (!tokenRow) {
    res.status(401).json({ error: 'Invalid webhook token' });
    return;
  }

  const userId = tokenRow.userId;
  const days = parseHealthExport(req.body);
  const now = new Date();

  for (const [date, metrics] of days) {
    const columns = toColumns(metrics);
    if (Object.keys(columns).length === 0) continue;
    await db
      .insert(healthData)
      .values({ userId, date, ...columns, syncedAt: now })
      .onDuplicateKeyUpdate({ set: { ...columns, syncedAt: now } });
  }

  await db
    .update(userWebhookTokens)
    .set({ lastSyncAt: now })
    .where(eq(userWebhookTokens.id, tokenRow.id));

  res.json({ ok: true, daysUpdated: days.size });
});

// GET /api/health/me — last 7 days of the current user's health data.
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.sub;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 6);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const rows = await db
    .select()
    .from(healthData)
    .where(and(eq(healthData.userId, userId), gte(healthData.date, cutoffStr)))
    .orderBy(desc(healthData.date))
    .limit(7);

  res.json(rows.reverse().map(mapRow));
});

// GET /api/health/token — current token (created on first access).
router.get('/token', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.sub;
  let [row] = await db
    .select()
    .from(userWebhookTokens)
    .where(eq(userWebhookTokens.userId, userId))
    .limit(1);

  if (!row) {
    const token = newToken();
    await db.insert(userWebhookTokens).values({ userId, token });
    [row] = await db
      .select()
      .from(userWebhookTokens)
      .where(eq(userWebhookTokens.token, token))
      .limit(1);
  }

  const info: WebhookTokenInfo = {
    token: row!.token,
    lastSyncAt: row!.lastSyncAt ? row!.lastSyncAt.toISOString() : null,
  };
  res.json(info);
});

// POST /api/health/token — regenerate the token (invalidates the old URL).
router.post('/token', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.sub;
  await db.delete(userWebhookTokens).where(eq(userWebhookTokens.userId, userId));
  const token = newToken();
  await db.insert(userWebhookTokens).values({ userId, token });

  const info: WebhookTokenInfo = { token, lastSyncAt: null };
  res.json(info);
});

export default router;
