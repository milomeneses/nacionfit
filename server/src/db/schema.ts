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
  HydrationEntry,
  Meals,
  MobilityExercise,
  ProjectIntensity,
  ReviewExperiment,
  ReviewInsight,
  WeekDay,
  WeeklyStructure,
  WeeklyReviewData,
} from '@nacionfit/shared';

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
  role: mysqlEnum('role', ['user', 'admin']).notNull().default('user'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const adminAuditLog = mysqlTable('admin_audit_log', {
  id: int('id').autoincrement().primaryKey(),
  adminUserId: int('admin_user_id').notNull(),
  action: varchar('action', { length: 64 }).notNull(),
  targetType: varchar('target_type', { length: 32 }).notNull(),
  targetId: int('target_id'),
  payload: json('payload'),
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

export const TRAINING_FOCUSES = ['hypertrophy', 'strength', 'cut', 'recomp', 'maintenance'] as const;
export const WORKOUT_TYPES = ['crossfit', 'strength', 'cardio', 'mobility', 'rest', 'rest_active', 'other'] as const;
export const WORKOUT_SOURCES = ['app_planned', 'app_logged', 'apple_watch_sync'] as const;
export const SUPPLEMENT_TIMINGS = ['morning', 'pre_workout', 'post_workout', 'with_lunch', 'with_dinner', 'before_bed', 'flexible'] as const;
export const SUPPLEMENT_FREQUENCIES = ['daily', 'training_days_only', 'specific_days'] as const;

export const trainingBlocks = mysqlTable('training_blocks', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id').notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  startDate: date('start_date', { mode: 'string' }),
  endDate: date('end_date', { mode: 'string' }),
  focus: mysqlEnum('focus', TRAINING_FOCUSES).notNull(),
  weeklyStructure: json('weekly_structure').$type<WeeklyStructure>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const workouts = mysqlTable('workouts', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id').notNull(),
  date: date('date', { mode: 'string' }).notNull(),
  type: mysqlEnum('type', WORKOUT_TYPES).notNull(),
  plannedAt: datetime('planned_at', { mode: 'date' }),
  completedAt: datetime('completed_at', { mode: 'date' }),
  durationMinutes: int('duration_minutes'),
  rpe: tinyint('rpe'),
  notes: text('notes'),
  source: mysqlEnum('source', WORKOUT_SOURCES).notNull(),
  appleWorkoutId: varchar('apple_workout_id', { length: 64 }),
  workoutData: json('workout_data'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const supplements = mysqlTable('supplements', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id').notNull(),
  name: varchar('name', { length: 80 }).notNull(),
  brand: varchar('brand', { length: 80 }),
  dose: varchar('dose', { length: 40 }).notNull(),
  timing: mysqlEnum('timing', SUPPLEMENT_TIMINGS).notNull(),
  frequency: mysqlEnum('frequency', SUPPLEMENT_FREQUENCIES).notNull(),
  specificDays: json('specific_days').$type<WeekDay[]>(),
  active: boolean('active').notNull().default(true),
  startedAt: date('started_at', { mode: 'string' }),
  notes: text('notes'),
});

export const supplementLogs = mysqlTable(
  'supplement_logs',
  {
    id: int('id').autoincrement().primaryKey(),
    userId: int('user_id').notNull(),
    supplementId: int('supplement_id').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    taken: boolean('taken').notNull().default(false),
    takenAt: datetime('taken_at', { mode: 'date' }),
  },
  (t) => [unique('supplement_logs_unique').on(t.userId, t.supplementId, t.date)],
);

export const hydrationLogs = mysqlTable(
  'hydration_logs',
  {
    id: int('id').autoincrement().primaryKey(),
    userId: int('user_id').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    targetMl: int('target_ml'),
    consumedMl: int('consumed_ml').notNull().default(0),
    entries: json('entries').$type<HydrationEntry[]>(),
  },
  (t) => [unique('hydration_logs_user_date_unique').on(t.userId, t.date)],
);

export const mobilityRoutines = mysqlTable('mobility_routines', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id').notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  durationMinutes: int('duration_minutes').notNull(),
  exercises: json('exercises').$type<MobilityExercise[]>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type TrainingBlockRow = typeof trainingBlocks.$inferSelect;
export type WorkoutRow = typeof workouts.$inferSelect;
export type SupplementRow = typeof supplements.$inferSelect;
export type SupplementLogRow = typeof supplementLogs.$inferSelect;
export type HydrationLogRow = typeof hydrationLogs.$inferSelect;
export type MobilityRoutineRow = typeof mobilityRoutines.$inferSelect;
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
export type AdminAuditLogRow = typeof adminAuditLog.$inferSelect;
