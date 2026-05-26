import { eq, sql } from 'drizzle-orm';
import type {
  CreateSupplementInput,
  MobilityRoutine,
  WeeklyStructure,
} from '@nacionfit/shared';
import { db } from '../db/index.js';
import {
  mobilityRoutines,
  supplements,
  trainingBlocks,
} from '../db/schema.js';
import { addDays, todayInTz, userTimezone } from '../util/dates.js';

export const DEFAULT_WEEKLY_STRUCTURE: WeeklyStructure = {
  mon: 'crossfit',
  tue: 'crossfit + mobility_post',
  wed: 'crossfit + strength_upper',
  thu: 'rest_active',
  fri: 'crossfit',
  sat: 'crossfit + strength_lower',
  sun: 'rest',
};

export const DEFAULT_MOBILITY: Omit<MobilityRoutine, 'id'>[] = [
  {
    name: 'Movilidad matinal 5min',
    durationMinutes: 5,
    exercises: [
      { name: 'Gato-camello', reps: 10 },
      { name: 'Rotación de cadera', durationSec: 30 },
      { name: 'Apertura torácica', durationSec: 30 },
      { name: 'Sentadilla profunda (hold)', durationSec: 60 },
    ],
  },
  {
    name: 'Post-WOD 10min',
    durationMinutes: 10,
    exercises: [
      { name: 'Estiramiento de cuádriceps', durationSec: 30 },
      { name: 'Estiramiento de isquios', durationSec: 30 },
      { name: 'Paloma (cadera)', durationSec: 45 },
      { name: 'Estiramiento de hombros', durationSec: 30 },
      { name: 'Respiración diafragmática', durationSec: 60 },
    ],
  },
  {
    name: 'Pre-sueño 8min',
    durationMinutes: 8,
    exercises: [
      { name: 'Postura del niño', durationSec: 60 },
      { name: 'Piernas en la pared', durationSec: 120 },
      { name: 'Torsión espinal suave', durationSec: 45 },
      { name: 'Respiración 4-7-8', durationSec: 120 },
    ],
  },
  {
    name: 'Recuperación día off 15min',
    durationMinutes: 15,
    exercises: [
      { name: 'Caminata suave', durationSec: 300 },
      { name: 'Movilidad de cadera completa', durationSec: 180 },
      { name: 'Foam roll de espalda', durationSec: 120 },
      { name: 'Estiramiento full body', durationSec: 300 },
    ],
  },
];

export const DEFAULT_SUPPLEMENTS: CreateSupplementInput[] = [
  { name: 'Whey protein', dose: '25g', timing: 'post_workout', frequency: 'training_days_only' },
  { name: 'Creatina monohidrato', dose: '5g', timing: 'flexible', frequency: 'daily' },
  { name: 'Multivitamínico', dose: '1 cápsula', timing: 'with_lunch', frequency: 'daily' },
  { name: 'Omega 3', dose: '2 cápsulas', timing: 'with_dinner', frequency: 'daily' },
  { name: 'Magnesio glicinato', dose: '400mg', timing: 'before_bed', frequency: 'daily' },
];

async function count(table: typeof mobilityRoutines, userId: number): Promise<number> {
  const [{ c }] = await db.select({ c: sql<number>`count(*)` }).from(table).where(eq(table.userId, userId));
  return Number(c);
}

/** Idempotently seeds starter training block, mobility routines and supplements. */
export async function seedUserDefaults(userId: number): Promise<void> {
  const tz = await userTimezone(userId);
  const today = todayInTz(tz);

  const [{ mob }] = await db
    .select({ mob: sql<number>`count(*)` })
    .from(mobilityRoutines)
    .where(eq(mobilityRoutines.userId, userId));
  if (Number(mob) === 0) {
    await db.insert(mobilityRoutines).values(
      DEFAULT_MOBILITY.map((r) => ({
        userId,
        name: r.name,
        durationMinutes: r.durationMinutes,
        exercises: r.exercises,
      })),
    );
  }

  const [{ blk }] = await db
    .select({ blk: sql<number>`count(*)` })
    .from(trainingBlocks)
    .where(eq(trainingBlocks.userId, userId));
  if (Number(blk) === 0) {
    await db.insert(trainingBlocks).values({
      userId,
      name: 'CrossFit + estructura',
      focus: 'recomp',
      startDate: today,
      endDate: addDays(today, 84), // 12 weeks
      weeklyStructure: DEFAULT_WEEKLY_STRUCTURE,
    });
  }

  const [{ sup }] = await db
    .select({ sup: sql<number>`count(*)` })
    .from(supplements)
    .where(eq(supplements.userId, userId));
  if (Number(sup) === 0) {
    await db.insert(supplements).values(
      DEFAULT_SUPPLEMENTS.map((s) => ({
        userId,
        name: s.name,
        dose: s.dose,
        timing: s.timing,
        frequency: s.frequency,
        startedAt: today,
      })),
    );
  }
}
