import {
  mysqlTable,
  int,
  varchar,
  date,
  datetime,
  timestamp,
  json,
  tinyint,
  boolean,
  decimal,
  text,
  mysqlEnum,
  unique,
} from 'drizzle-orm/mysql-core';
import type {
  CravingAction,
  CravingContext,
  CravingTrigger,
  HabitId,
  Meals,
  ProjectIntensity,
  ReviewExperiment,
  ReviewInsight,
  WeeklyReviewData,
} from '@mi-cocina/shared';

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

export const healthData = mysqlTable(
  'health_data',
  {
    id: int('id').autoincrement().primaryKey(),
    userId: int('user_id').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    sleepMinutes: int('sleep_minutes'),
    deepSleepMinutes: int('deep_sleep_minutes'),
    remSleepMinutes: int('rem_sleep_minutes'),
    awakeMinutes: int('awake_minutes'),
    hrvMs: decimal('hrv_ms', { precision: 6, scale: 2 }),
    restingHr: int('resting_hr'),
    steps: int('steps'),
    activeCalories: int('active_calories'),
    source: varchar('source', { length: 40 }),
    syncedAt: timestamp('synced_at').notNull().defaultNow(),
  },
  (t) => [unique('health_data_user_date_unique').on(t.userId, t.date)],
);

export const userWebhookTokens = mysqlTable('user_webhook_tokens', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id').notNull(),
  token: varchar('token', { length: 64 }).notNull().unique(),
  lastSyncAt: timestamp('last_sync_at'),
});

export const CRAVING_TRIGGERS = [
  'estres',
  'cansancio',
  'aburrimiento',
  'hambre',
  'vista',
  'social',
  'emocion',
  'otro',
] as const satisfies readonly CravingTrigger[];

export const CRAVING_ACTIONS = [
  'cedi',
  'cedi_planeado',
  'porcion_chica',
  'redirigi',
  'espere',
  'agua_prot',
] as const satisfies readonly CravingAction[];

export const cravings = mysqlTable('cravings', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id').notNull(),
  timestamp: datetime('timestamp', { mode: 'date' }).notNull(),
  food: varchar('food', { length: 120 }).notNull(),
  intensity: tinyint('intensity').notNull(),
  trigger: mysqlEnum('trigger', CRAVING_TRIGGERS).$type<CravingTrigger>().notNull(),
  action: mysqlEnum('action', CRAVING_ACTIONS).$type<CravingAction>().notNull(),
  note: text('note'),
  context: json('context').$type<CravingContext>(),
});

export const aiConversations = mysqlTable('ai_conversations', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id').notNull(),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  lastMessageAt: timestamp('last_message_at').notNull().defaultNow(),
  summary: text('summary'),
});

export const aiMessages = mysqlTable('ai_messages', {
  id: int('id').autoincrement().primaryKey(),
  conversationId: int('conversation_id').notNull(),
  role: mysqlEnum('role', ['user', 'assistant', 'system']).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  tokensUsed: int('tokens_used'),
});

export const weeklyReviews = mysqlTable(
  'weekly_reviews',
  {
    id: int('id').autoincrement().primaryKey(),
    userId: int('user_id').notNull(),
    weekStart: date('week_start', { mode: 'string' }).notNull(),
    weekEnd: date('week_end', { mode: 'string' }).notNull(),
    narrative: text('narrative'),
    insights: json('insights').$type<ReviewInsight[]>(),
    experiment: json('experiment').$type<ReviewExperiment>(),
    rawData: json('raw_data').$type<WeeklyReviewData>(),
    generatedAt: timestamp('generated_at').notNull().defaultNow(),
    readAt: timestamp('read_at'),
  },
  (t) => [unique('weekly_reviews_user_week_unique').on(t.userId, t.weekStart)],
);

export const pushSubscriptions = mysqlTable('push_subscriptions', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id').notNull(),
  endpoint: varchar('endpoint', { length: 512 }).notNull().unique(),
  p256dh: varchar('p256dh', { length: 255 }).notNull(),
  auth: varchar('auth', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type DailyLogRow = typeof dailyLogs.$inferSelect;
export type HabitLogRow = typeof habitsLogs.$inferSelect;
export type HealthDataRow = typeof healthData.$inferSelect;
export type HealthDataInsert = typeof healthData.$inferInsert;
export type WebhookTokenRow = typeof userWebhookTokens.$inferSelect;
export type CravingRow = typeof cravings.$inferSelect;
export type ConversationRow = typeof aiConversations.$inferSelect;
export type MessageRow = typeof aiMessages.$inferSelect;
export type WeeklyReviewRow = typeof weeklyReviews.$inferSelect;
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
