import { Router, type Response } from 'express';
import { and, eq, gte } from 'drizzle-orm';
import type {
  CravingsHeatmap,
  CravingTrigger,
  SleepVsCravings,
  StressCravings,
  TopTriggersResult,
  VarianceTrend,
  VarianceWeek,
} from '@mi-cocina/shared';
import { db } from '../db/index.js';
import { cravings, dailyLogs, habitsLogs, healthData, users } from '../db/schema.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const BLOCK_LABELS = ['0-10h', '10-14h', '14-18h', '18-22h', '22-24h'];

function weeksParam(raw: unknown, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.min(Math.max(Math.trunc(n), 1), 26) : fallback;
}

function windowStart(weeks: number): Date {
  return new Date(Date.now() - weeks * 7 * 86_400_000);
}

async function userTz(userId: number): Promise<string> {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return u?.timezone ?? 'UTC';
}

/** Local calendar date, Mon-first weekday index, and hour for a UTC instant. */
function localParts(d: Date, tz: string): { date: string; dow: number; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  const y = Number(get('year'));
  const mo = Number(get('month'));
  const da = Number(get('day'));
  const hour = Number(get('hour')) % 24;
  const dow = (new Date(Date.UTC(y, mo - 1, da)).getUTCDay() + 6) % 7; // Mon=0..Sun=6
  return { date: `${get('year')}-${get('month')}-${get('day')}`, dow, hour };
}

function dowFromDateStr(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

function blockIndex(hour: number): number {
  if (hour < 10) return 0;
  if (hour < 14) return 1;
  if (hour < 18) return 2;
  if (hour < 22) return 3;
  return 4;
}

// GET /api/patterns/cravings-heatmap?weeks=6
router.get('/cravings-heatmap', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.sub;
  const weeks = weeksParam(req.query.weeks, 6);
  const tz = await userTz(userId);

  const rows = await db
    .select({ timestamp: cravings.timestamp })
    .from(cravings)
    .where(and(eq(cravings.userId, userId), gte(cravings.timestamp, windowStart(weeks))));

  const grid: number[][] = Array.from({ length: 7 }, () => Array(5).fill(0));
  let total = 0;
  let peak: CravingsHeatmap['peak'] = null;
  for (const r of rows) {
    const { dow, hour } = localParts(r.timestamp as Date, tz);
    const b = blockIndex(hour);
    grid[dow][b] += 1;
    total += 1;
    if (!peak || grid[dow][b] > peak.count) {
      peak = { dayIndex: dow, blockIndex: b, count: grid[dow][b] };
    }
  }

  const result: CravingsHeatmap = {
    weeks,
    dayLabels: DAY_LABELS,
    blockLabels: BLOCK_LABELS,
    grid,
    total,
    peak,
  };
  res.json(result);
});

// GET /api/patterns/sleep-vs-cravings?weeks=8
router.get('/sleep-vs-cravings', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.sub;
  const weeks = weeksParam(req.query.weeks, 8);
  const tz = await userTz(userId);
  const start = windowStart(weeks);

  const cravingRows = await db
    .select({ timestamp: cravings.timestamp, intensity: cravings.intensity })
    .from(cravings)
    .where(and(eq(cravings.userId, userId), gte(cravings.timestamp, start)));

  const healthRows = await db
    .select({ date: healthData.date, sleepMinutes: healthData.sleepMinutes })
    .from(healthData)
    .where(eq(healthData.userId, userId));
  const sleepByDate = new Map(healthRows.map((r) => [r.date, r.sleepMinutes]));

  const defs = [
    { label: '<5h', min: 0, max: 300 },
    { label: '5-6', min: 300, max: 360 },
    { label: '6-7', min: 360, max: 420 },
    { label: '7-8', min: 420, max: 480 },
    { label: '8-9', min: 480, max: 540 },
    { label: '9+', min: 540, max: Infinity },
  ];
  const acc = defs.map(() => ({ sum: 0, count: 0 }));

  for (const c of cravingRows) {
    const { date } = localParts(c.timestamp as Date, tz);
    const sleep = sleepByDate.get(date);
    if (sleep == null) continue;
    const idx = defs.findIndex((d) => sleep >= d.min && sleep < d.max);
    if (idx < 0) continue;
    acc[idx].sum += c.intensity;
    acc[idx].count += 1;
  }

  const result: SleepVsCravings = {
    weeks,
    buckets: defs.map((d, i) => ({
      label: d.label,
      count: acc[i].count,
      avgIntensity:
        acc[i].count > 0 ? Math.round((acc[i].sum / acc[i].count) * 10) / 10 : null,
    })),
  };
  res.json(result);
});

// GET /api/patterns/variance?weeks=6
router.get('/variance', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.sub;
  const weeks = weeksParam(req.query.weeks, 6);
  const start = windowStart(weeks + 1);
  const startStr = start.toISOString().slice(0, 10);

  const rows = await db
    .select({ date: habitsLogs.date, completed: habitsLogs.completed })
    .from(habitsLogs)
    .where(and(eq(habitsLogs.userId, userId), gte(habitsLogs.date, startStr)));

  // completion rate per day = completed / 6
  const perDay = new Map<string, number>();
  const totalByDay = new Map<string, number>();
  for (const r of rows) {
    if (r.completed) perDay.set(r.date, (perDay.get(r.date) ?? 0) + 1);
    totalByDay.set(r.date, (totalByDay.get(r.date) ?? 0) + 1);
  }

  // Monday of the current week (UTC-based; dates are local calendar strings).
  function mondayOf(date: string): string {
    const [y, m, d] = date.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
    return dt.toISOString().slice(0, 10);
  }

  const weekAgg = new Map<string, { wd: number[]; we: number[] }>();
  for (const date of totalByDay.keys()) {
    const rate = (perDay.get(date) ?? 0) / 6;
    const wk = mondayOf(date);
    const agg = weekAgg.get(wk) ?? { wd: [], we: [] };
    if (dowFromDateStr(date) <= 4) agg.wd.push(rate);
    else agg.we.push(rate);
    weekAgg.set(wk, agg);
  }

  const mean = (xs: number[]): number | null =>
    xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null;

  // Build the last `weeks` Monday buckets ending this week.
  const todayStr = new Date().toISOString().slice(0, 10);
  const thisMonday = mondayOf(todayStr);
  const series: VarianceWeek[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const [y, m, d] = thisMonday.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - i * 7);
    const wk = dt.toISOString().slice(0, 10);
    const agg = weekAgg.get(wk);
    const weekdayAvg = agg ? mean(agg.wd) : null;
    const weekendAvg = agg ? mean(agg.we) : null;
    const variance =
      weekdayAvg != null && weekendAvg != null
        ? Math.round(Math.abs(weekdayAvg - weekendAvg) * 100) / 100
        : null;
    series.push({ weekStart: wk, weekdayAvg, weekendAvg, variance });
  }

  const result: VarianceTrend = { weeks, goal: 0.15, series };
  res.json(result);
});

// GET /api/patterns/top-triggers?weeks=8
router.get('/top-triggers', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.sub;
  const weeks = weeksParam(req.query.weeks, 8);

  const rows = await db
    .select({ trigger: cravings.trigger })
    .from(cravings)
    .where(and(eq(cravings.userId, userId), gte(cravings.timestamp, windowStart(weeks))));

  const counts = new Map<CravingTrigger, number>();
  for (const r of rows) counts.set(r.trigger, (counts.get(r.trigger) ?? 0) + 1);

  const result: TopTriggersResult = {
    weeks,
    triggers: [...counts.entries()]
      .map(([trigger, count]) => ({ trigger, count }))
      .sort((a, b) => b.count - a.count),
  };
  res.json(result);
});

// GET /api/patterns/stress-cravings?weeks=6
router.get('/stress-cravings', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.sub;
  const weeks = weeksParam(req.query.weeks, 6);
  const tz = await userTz(userId);
  const start = windowStart(weeks);
  const startStr = start.toISOString().slice(0, 10);

  const dayRows = await db
    .select({ date: dailyLogs.date, intensity: dailyLogs.projectIntensity })
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, userId), gte(dailyLogs.date, startStr)));

  const groupByDate = new Map<string, 'high' | 'low'>();
  let highDays = 0;
  let lowDays = 0;
  for (const r of dayRows) {
    if (!r.intensity) continue;
    if (r.intensity === 'high' || r.intensity === 'crisis') {
      groupByDate.set(r.date, 'high');
      highDays += 1;
    } else {
      groupByDate.set(r.date, 'low');
      lowDays += 1;
    }
  }

  const cravingRows = await db
    .select({ timestamp: cravings.timestamp })
    .from(cravings)
    .where(and(eq(cravings.userId, userId), gte(cravings.timestamp, start)));

  let highCravings = 0;
  let lowCravings = 0;
  for (const c of cravingRows) {
    const { date } = localParts(c.timestamp as Date, tz);
    const g = groupByDate.get(date);
    if (g === 'high') highCravings += 1;
    else if (g === 'low') lowCravings += 1;
  }

  const perDay = (cr: number, days: number) =>
    days > 0 ? Math.round((cr / days) * 100) / 100 : 0;

  const result: StressCravings = {
    weeks,
    high: { days: highDays, cravings: highCravings, avgPerDay: perDay(highCravings, highDays) },
    low: { days: lowDays, cravings: lowCravings, avgPerDay: perDay(lowCravings, lowDays) },
  };
  res.json(result);
});

export default router;
