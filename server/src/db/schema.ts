import {
  mysqlTable,
  int,
  varchar,
  date,
  timestamp,
  json,
  tinyint,
  boolean,
  decimal,
  mysqlEnum,
  unique,
} from 'drizzle-orm/mysql-core';
import type { HabitId, Meals, ProjectIntensity } from '@mi-cocina/shared';

export const PROJECT_INTENSITIES = ['low', 'medium', 'high', 'crisis'] as const;
export const HABIT_IDS = [
  'meditacion',
  'lectura',
  'estiramiento',
  'sin_azucar',
  'suplementos',
  'pasos',
] as const satisfies readonly HabitId[];

export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  heightCm: int('height_cm'),
  targetWeightKg: int('target_weight_kg'),
  targetDate: date('target_date', { mode: 'string' }),
  timezone: varchar('timezone', { length: 64 }).notNull().default('UTC'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const dailyLogs = mysqlTable(
  'daily_logs',
  {
    id: int('id').autoincrement().primaryKey(),
    userId: int('user_id').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    meals: json('meals').$type<Meals>(),
    waterCount: int('water_count'),
    sleepHours: decimal('sleep_hours', { precision: 4, scale: 2 }),
    mood: tinyint('mood'),
    crossfit: boolean('crossfit'),
    energy: tinyint('energy'),
    stress: tinyint('stress'),
    projectIntensity: mysqlEnum('project_intensity', PROJECT_INTENSITIES).$type<ProjectIntensity>(),
    weightKg: decimal('weight_kg', { precision: 5, scale: 2 }),
    savedAt: timestamp('saved_at').notNull().defaultNow(),
  },
  (t) => [unique('daily_logs_user_date_unique').on(t.userId, t.date)],
);

export const habitsLogs = mysqlTable(
  'habits_logs',
  {
    id: int('id').autoincrement().primaryKey(),
    userId: int('user_id').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    habitId: mysqlEnum('habit_id', HABIT_IDS).$type<HabitId>().notNull(),
    completed: boolean('completed').notNull().default(false),
  },
  (t) => [unique('habits_logs_user_date_habit_unique').on(t.userId, t.date, t.habitId)],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type DailyLogRow = typeof dailyLogs.$inferSelect;
export type HabitLogRow = typeof habitsLogs.$inferSelect;
