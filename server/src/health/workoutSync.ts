import { and, eq } from 'drizzle-orm';
import type { WorkoutType } from '@nacionfit/shared';
import { db } from '../db/index.js';
import { workouts } from '../db/schema.js';
import { parseHaeDate } from './parse.js';

type Json = Record<string, unknown>;

function isObject(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/** Maps an Apple/HAE workout type name to our internal workout type. */
export function mapAppleWorkoutType(name: string): WorkoutType {
  const n = name.toLowerCase();
  if (n.includes('functional strength') || n.includes('hiit') || n.includes('high intensity')) return 'crossfit';
  if (n.includes('traditional strength') || (n.includes('strength') && !n.includes('functional'))) return 'strength';
  if (n.includes('running') || n.includes('cycling') || n.includes('rowing') || n.includes('swimming') || n.includes('walking') || n.includes('elliptical')) return 'cardio';
  if (n.includes('yoga') || n.includes('flexibility') || n.includes('mobility') || n.includes('cooldown') || n.includes('pilates')) return 'mobility';
  return 'other';
}

function getWorkouts(body: unknown): Json[] {
  if (isObject(body)) {
    const data = body.data;
    if (isObject(data) && Array.isArray(data.workouts)) return data.workouts.filter(isObject);
    if (Array.isArray(body.workouts)) return body.workouts.filter(isObject);
  }
  return [];
}

/** Ingests Health Auto Export workouts; dedups by apple_workout_id and merges
 *  into a planned-but-incomplete workout for the same day when one exists. */
export async function syncWorkouts(userId: number, body: unknown): Promise<number> {
  const raw = getWorkouts(body);
  let synced = 0;

  for (const w of raw) {
    const lc: Json = {};
    for (const k of Object.keys(w)) lc[k.toLowerCase()] = w[k];

    const name = typeof lc.name === 'string' ? lc.name : typeof lc.type === 'string' ? (lc.type as string) : '';
    const startRaw = (lc.start ?? lc.startdate ?? lc.date) as unknown;
    const when = parseHaeDate(startRaw);
    if (!when) continue;

    const appleId = String(lc.id ?? `${name}-${when.day}-${when.ts}`).slice(0, 64);

    // Dedup: already synced?
    const [dup] = await db
      .select({ id: workouts.id })
      .from(workouts)
      .where(and(eq(workouts.userId, userId), eq(workouts.appleWorkoutId, appleId)))
      .limit(1);
    if (dup) continue;

    const type = mapAppleWorkoutType(name);
    let durationMin = num(lc.duration);
    if (durationMin != null && durationMin > 600) durationMin = Math.round(durationMin / 60); // seconds → minutes
    const completedAt = new Date(when.ts);
    const workoutData = {
      appleType: name,
      durationMinutes: durationMin ?? null,
      calories: num(lc.activeenergyburned ?? lc.totalenergy ?? lc.calories) ?? null,
      avgHeartRate: num(lc.avgheartrate ?? lc.averageheartrate) ?? null,
      maxHeartRate: num(lc.maxheartrate) ?? null,
    };

    // Merge into an existing app-planned, not-yet-completed workout for the day.
    const [planned] = await db
      .select()
      .from(workouts)
      .where(
        and(
          eq(workouts.userId, userId),
          eq(workouts.date, when.day),
          eq(workouts.source, 'app_planned'),
        ),
      )
      .limit(1);

    if (planned && planned.completedAt == null) {
      await db
        .update(workouts)
        .set({
          completedAt,
          durationMinutes: durationMin != null ? Math.round(durationMin) : planned.durationMinutes,
          appleWorkoutId: appleId,
          workoutData,
        })
        .where(eq(workouts.id, planned.id));
    } else {
      await db.insert(workouts).values({
        userId,
        date: when.day,
        type,
        completedAt,
        durationMinutes: durationMin != null ? Math.round(durationMin) : null,
        source: 'apple_watch_sync',
        appleWorkoutId: appleId,
        workoutData,
      });
    }
    synced++;
  }

  return synced;
}
