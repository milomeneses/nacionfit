import { Router, type Response } from 'express';
import { z } from 'zod';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type {
  AdminMetrics,
  AdminUserDetail,
  AdminUserSummary,
  AuditLogEntry,
  CravingTrigger,
} from '@nacionfit/shared';
import { db } from '../db/index.js';
import {
  adminAuditLog,
  aiConversations,
  aiMessages,
  cravings,
  dailyLogs,
  habitsLogs,
  healthData,
  pushSubscriptions,
  userWebhookTokens,
  users,
  weeklyReviews,
  PROJECT_INTENSITIES,
  type DailyLogRow,
} from '../db/schema.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { toPublicUser } from '../auth/routes.js';

const router = Router();
router.use(requireAuth, requireAdmin);

async function audit(
  adminUserId: number,
  action: string,
  targetType: string,
  targetId: number | null,
  payload?: unknown,
): Promise<void> {
  await db
    .insert(adminAuditLog)
    .values({ adminUserId, action, targetType, targetId, payload: payload ?? null });
}

function isoOrNull(v: unknown): string | null {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

function mondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return dt.toISOString().slice(0, 10);
}

const dayStr = (offsetDays = 0) =>
  new Date(Date.now() - offsetDays * 86_400_000).toISOString().slice(0, 10);

// GET /api/admin/users
router.get('/users', async (_req, res: Response) => {
  const rows = await db.select().from(users);
  const lastActive = await db
    .select({ userId: dailyLogs.userId, last: sql<string>`max(${dailyLogs.date})` })
    .from(dailyLogs)
    .groupBy(dailyLogs.userId);
  const lastMap = new Map(lastActive.map((r) => [r.userId, r.last]));

  const result: AdminUserSummary[] = rows.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
    lastActiveAt: lastMap.get(u.id) ?? null,
  }));
  res.json(result);
});

// GET /api/admin/users/:id
router.get('/users/:id', async (req, res: Response) => {
  const id = Number(req.params.id);
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!u) {
    res.status(404).json({ error: 'Usuario no encontrado' });
    return;
  }
  const count = async (table: typeof dailyLogs | typeof cravings | typeof healthData, col: typeof dailyLogs.userId | typeof cravings.userId | typeof healthData.userId) => {
    const [{ c }] = await db.select({ c: sql<number>`count(*)` }).from(table).where(eq(col, id));
    return Number(c);
  };
  const [{ conv }] = await db
    .select({ conv: sql<number>`count(*)` })
    .from(aiConversations)
    .where(eq(aiConversations.userId, id));

  const weightRows = await db
    .select({ date: dailyLogs.date, weight: dailyLogs.weightKg })
    .from(dailyLogs)
    .where(eq(dailyLogs.userId, id))
    .orderBy(dailyLogs.date);

  const detail: AdminUserDetail = {
    user: toPublicUser(u),
    counts: {
      dailyLogs: await count(dailyLogs, dailyLogs.userId),
      cravings: await count(cravings, cravings.userId),
      conversations: Number(conv),
      healthDays: await count(healthData, healthData.userId),
    },
    weightHistory: weightRows
      .filter((r) => r.weight != null)
      .map((r) => ({ date: r.date, weightKg: Number(r.weight) })),
  };
  res.json(detail);
});

// GET /api/admin/users/:id/days
router.get('/users/:id/days', async (req, res: Response) => {
  const id = Number(req.params.id);
  const rows = await db
    .select()
    .from(dailyLogs)
    .where(eq(dailyLogs.userId, id))
    .orderBy(desc(dailyLogs.date));
  res.json(rows.map(mapDailyLog));
});

function mapDailyLog(row: DailyLogRow) {
  const meals = typeof row.meals === 'string' ? JSON.parse(row.meals) : (row.meals ?? null);
  return {
    id: row.id,
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
    savedAt: isoOrNull(row.savedAt),
  };
}

// GET /api/admin/users/:id/cravings
router.get('/users/:id/cravings', async (req, res: Response) => {
  const id = Number(req.params.id);
  const rows = await db
    .select()
    .from(cravings)
    .where(eq(cravings.userId, id))
    .orderBy(desc(cravings.timestamp));
  res.json(
    rows.map((r) => ({
      id: r.id,
      timestamp: isoOrNull(r.timestamp),
      food: r.food,
      intensity: r.intensity,
      trigger: r.trigger,
      action: r.action,
      note: r.note,
    })),
  );
});

// GET /api/admin/users/:id/health
router.get('/users/:id/health', async (req, res: Response) => {
  const id = Number(req.params.id);
  const rows = await db
    .select()
    .from(healthData)
    .where(eq(healthData.userId, id))
    .orderBy(healthData.date);
  res.json(
    rows.map((r) => ({
      id: r.id,
      date: r.date,
      sleepMinutes: r.sleepMinutes,
      deepSleepMinutes: r.deepSleepMinutes,
      remSleepMinutes: r.remSleepMinutes,
      hrvMs: r.hrvMs != null ? Number(r.hrvMs) : null,
      restingHr: r.restingHr,
      steps: r.steps,
    })),
  );
});

const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  targetWeightKg: z.number().int().positive().nullish(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  role: z.enum(['user', 'admin']).optional(),
});

// PATCH /api/admin/users/:id
router.patch('/users/:id', async (req: AuthenticatedRequest, res: Response) => {
  const id = Number(req.params.id);
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos' });
    return;
  }
  const set: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) if (v !== undefined) set[k] = v;
  if (Object.keys(set).length > 0) {
    await db.update(users).set(set).where(eq(users.id, id));
  }
  const [updated] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!updated) {
    res.status(404).json({ error: 'Usuario no encontrado' });
    return;
  }
  await audit(req.user!.sub, 'update', 'user', id, parsed.data);
  res.json(toPublicUser(updated));
});

// DELETE /api/admin/users/:id  (body: { confirm: "<email>" })
router.delete('/users/:id', async (req: AuthenticatedRequest, res: Response) => {
  const id = Number(req.params.id);
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!u) {
    res.status(404).json({ error: 'Usuario no encontrado' });
    return;
  }
  if (req.body?.confirm !== u.email) {
    res.status(400).json({ error: 'Confirmación inválida: escribí el email exacto del usuario.' });
    return;
  }

  const convs = await db
    .select({ id: aiConversations.id })
    .from(aiConversations)
    .where(eq(aiConversations.userId, id));
  const convIds = convs.map((c) => c.id);
  if (convIds.length > 0) {
    await db.delete(aiMessages).where(inArray(aiMessages.conversationId, convIds));
  }
  await db.delete(aiConversations).where(eq(aiConversations.userId, id));
  await db.delete(dailyLogs).where(eq(dailyLogs.userId, id));
  await db.delete(habitsLogs).where(eq(habitsLogs.userId, id));
  await db.delete(cravings).where(eq(cravings.userId, id));
  await db.delete(healthData).where(eq(healthData.userId, id));
  await db.delete(weeklyReviews).where(eq(weeklyReviews.userId, id));
  await db.delete(userWebhookTokens).where(eq(userWebhookTokens.userId, id));
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, id));
  await db.delete(users).where(eq(users.id, id));

  await audit(req.user!.sub, 'delete', 'user', id, { email: u.email });
  res.json({ ok: true });
});

const dayPatchSchema = z.object({
  meals: z
    .object({ desayuno: z.string(), almuerzo: z.string(), cena: z.string(), snacks: z.string() })
    .nullish(),
  waterCount: z.number().int().min(0).max(20).nullish(),
  sleepHours: z.number().min(0).max(24).nullish(),
  mood: z.number().int().min(1).max(5).nullish(),
  crossfit: z.boolean().nullish(),
  energy: z.number().int().min(1).max(5).nullish(),
  stress: z.number().int().min(0).max(10).nullish(),
  projectIntensity: z.enum(PROJECT_INTENSITIES as unknown as [string, ...string[]]).nullish(),
  weightKg: z.number().min(0).max(500).nullish(),
});

// PATCH /api/admin/days/:id
router.patch('/days/:id', async (req: AuthenticatedRequest, res: Response) => {
  const id = Number(req.params.id);
  const parsed = dayPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos' });
    return;
  }
  const d = parsed.data;
  const set: Record<string, unknown> = {};
  if (d.meals !== undefined) set.meals = d.meals;
  if (d.waterCount !== undefined) set.waterCount = d.waterCount;
  if (d.sleepHours !== undefined) set.sleepHours = d.sleepHours != null ? String(d.sleepHours) : null;
  if (d.mood !== undefined) set.mood = d.mood;
  if (d.crossfit !== undefined) set.crossfit = d.crossfit;
  if (d.energy !== undefined) set.energy = d.energy;
  if (d.stress !== undefined) set.stress = d.stress;
  if (d.projectIntensity !== undefined) set.projectIntensity = d.projectIntensity;
  if (d.weightKg !== undefined) set.weightKg = d.weightKg != null ? String(d.weightKg) : null;

  if (Object.keys(set).length > 0) {
    await db.update(dailyLogs).set(set).where(eq(dailyLogs.id, id));
  }
  const [row] = await db.select().from(dailyLogs).where(eq(dailyLogs.id, id)).limit(1);
  if (!row) {
    res.status(404).json({ error: 'Registro no encontrado' });
    return;
  }
  await audit(req.user!.sub, 'update', 'daily_log', id, parsed.data);
  res.json(mapDailyLog(row));
});

// DELETE /api/admin/days/:id
router.delete('/days/:id', async (req: AuthenticatedRequest, res: Response) => {
  const id = Number(req.params.id);
  await db.delete(dailyLogs).where(eq(dailyLogs.id, id));
  await audit(req.user!.sub, 'delete', 'daily_log', id);
  res.json({ ok: true });
});

// DELETE /api/admin/cravings/:id
router.delete('/cravings/:id', async (req: AuthenticatedRequest, res: Response) => {
  const id = Number(req.params.id);
  await db.delete(cravings).where(eq(cravings.id, id));
  await audit(req.user!.sub, 'delete', 'craving', id);
  res.json({ ok: true });
});

// GET /api/admin/audit
router.get('/audit', async (_req, res: Response) => {
  const rows = await db
    .select()
    .from(adminAuditLog)
    .orderBy(desc(adminAuditLog.id))
    .limit(200);
  const result: AuditLogEntry[] = rows.map((r) => ({
    id: r.id,
    adminUserId: r.adminUserId,
    action: r.action,
    targetType: r.targetType,
    targetId: r.targetId,
    payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload,
    createdAt: r.createdAt.toISOString(),
  }));
  res.json(result);
});

// GET /api/admin/metrics
router.get('/metrics', async (_req, res: Response) => {
  const [userRows, logRows, habitRows, healthRows, cravingRows] = await Promise.all([
    db.select({ id: users.id, createdAt: users.createdAt }).from(users),
    db
      .select({ userId: dailyLogs.userId, date: dailyLogs.date, weight: dailyLogs.weightKg })
      .from(dailyLogs),
    db
      .select({ userId: habitsLogs.userId, date: habitsLogs.date, completed: habitsLogs.completed })
      .from(habitsLogs),
    db.select({ sleep: healthData.sleepMinutes }).from(healthData),
    db.select({ trigger: cravings.trigger }).from(cravings),
  ]);

  const totalUsers = userRows.length;
  const d7 = dayStr(7);
  const d30 = dayStr(30);
  const activeLast7d = new Set(logRows.filter((l) => l.date >= d7).map((l) => l.userId)).size;
  const activeLast30d = new Set(logRows.filter((l) => l.date >= d30).map((l) => l.userId)).size;

  // avg habits completed per logged day
  const habitDay = new Map<string, { done: number }>();
  for (const h of habitRows) {
    const key = `${h.userId}|${h.date}`;
    const e = habitDay.get(key) ?? { done: 0 };
    if (h.completed) e.done += 1;
    habitDay.set(key, e);
  }
  const avgHabitsCompleted =
    habitDay.size > 0
      ? Math.round(([...habitDay.values()].reduce((a, b) => a + b.done, 0) / habitDay.size) * 10) /
        10
      : null;

  const sleeps = healthRows.map((h) => h.sleep).filter((x): x is number => x != null);
  const avgSleepHours =
    sleeps.length > 0
      ? Math.round((sleeps.reduce((a, b) => a + b, 0) / sleeps.length / 60) * 10) / 10
      : null;

  // avg current streak across users with logs
  const datesByUser = new Map<number, Set<string>>();
  for (const l of logRows) {
    const s = datesByUser.get(l.userId) ?? new Set<string>();
    s.add(l.date);
    datesByUser.set(l.userId, s);
  }
  const today = dayStr(0);
  function streak(dates: Set<string>): number {
    const cur = new Date(`${today}T12:00:00Z`);
    if (!dates.has(cur.toISOString().slice(0, 10))) cur.setUTCDate(cur.getUTCDate() - 1);
    let n = 0;
    while (dates.has(cur.toISOString().slice(0, 10))) {
      n += 1;
      cur.setUTCDate(cur.getUTCDate() - 1);
    }
    return n;
  }
  const streaks = [...datesByUser.values()].map(streak);
  const avgStreak =
    streaks.length > 0
      ? Math.round((streaks.reduce((a, b) => a + b, 0) / streaks.length) * 10) / 10
      : 0;

  // top triggers
  const triggerCounts = new Map<CravingTrigger, number>();
  for (const c of cravingRows) triggerCounts.set(c.trigger, (triggerCounts.get(c.trigger) ?? 0) + 1);
  const topTriggers = [...triggerCounts.entries()]
    .map(([trigger, count]) => ({ trigger, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // weight loss distribution (first - last weight per user)
  const weightsByUser = new Map<number, { date: string; w: number }[]>();
  for (const l of logRows) {
    if (l.weight == null) continue;
    const arr = weightsByUser.get(l.userId) ?? [];
    arr.push({ date: l.date, w: Number(l.weight) });
    weightsByUser.set(l.userId, arr);
  }
  const buckets = [
    { bucket: 'Subió', users: 0 },
    { bucket: '0–1 kg', users: 0 },
    { bucket: '1–2 kg', users: 0 },
    { bucket: '2–3 kg', users: 0 },
    { bucket: '3+ kg', users: 0 },
  ];
  for (const arr of weightsByUser.values()) {
    if (arr.length < 2) continue;
    arr.sort((a, b) => a.date.localeCompare(b.date));
    const lost = arr[0].w - arr[arr.length - 1].w;
    if (lost <= 0) buckets[0].users += 1;
    else if (lost < 1) buckets[1].users += 1;
    else if (lost < 2) buckets[2].users += 1;
    else if (lost < 3) buckets[3].users += 1;
    else buckets[4].users += 1;
  }

  // signups over time (by signup week)
  const signupWeek = new Map<string, number>();
  const cohortUsers = new Map<string, number[]>();
  for (const u of userRows) {
    const wk = mondayOf(u.createdAt.toISOString().slice(0, 10));
    signupWeek.set(wk, (signupWeek.get(wk) ?? 0) + 1);
    const arr = cohortUsers.get(wk) ?? [];
    arr.push(u.id);
    cohortUsers.set(wk, arr);
  }
  const signupsOverTime = [...signupWeek.entries()]
    .map(([week, count]) => ({ week, count }))
    .sort((a, b) => a.week.localeCompare(b.week));

  // active users over time (distinct users with a log per week)
  const activeWeek = new Map<string, Set<number>>();
  for (const l of logRows) {
    const wk = mondayOf(l.date);
    const s = activeWeek.get(wk) ?? new Set<number>();
    s.add(l.userId);
    activeWeek.set(wk, s);
  }
  const activeOverTime = [...activeWeek.entries()]
    .map(([week, s]) => ({ week, count: s.size }))
    .sort((a, b) => a.week.localeCompare(b.week));

  // cohort retention (weeks 0-3 after signup)
  const userActiveWeeks = new Map<number, Set<string>>();
  for (const l of logRows) {
    const s = userActiveWeeks.get(l.userId) ?? new Set<string>();
    s.add(mondayOf(l.date));
    userActiveWeeks.set(l.userId, s);
  }
  const cohortRetention = [...cohortUsers.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([cohort, ids]) => {
      const retention = [0, 1, 2, 3].map((k) => {
        const [y, m, d] = cohort.split('-').map(Number);
        const wkDate = new Date(Date.UTC(y, m - 1, d));
        wkDate.setUTCDate(wkDate.getUTCDate() + k * 7);
        const wk = wkDate.toISOString().slice(0, 10);
        const activeCount = ids.filter((uid) => userActiveWeeks.get(uid)?.has(wk)).length;
        return Math.round((activeCount / ids.length) * 100) / 100;
      });
      return { cohort, size: ids.length, retention };
    });

  const metrics: AdminMetrics = {
    totalUsers,
    activeLast7d,
    activeLast30d,
    avgHabitsCompleted,
    avgSleepHours,
    avgStreak,
    totalCravingsLogged: cravingRows.length,
    topTriggers,
    weightLossDistribution: buckets,
    signupsOverTime,
    activeOverTime,
    cohortRetention,
  };
  res.json(metrics);
});

export default router;
