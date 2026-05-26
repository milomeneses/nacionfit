-- ============================================================================
-- NacionFit · Training / Supplements / Hydration / Mobility tables (migration 0007)
-- Run this in phpMyAdmin (SQL tab) against the NacionFit database.
-- Safe to run once. All tables are additive — no existing data is touched.
-- ============================================================================

-- Training blocks: a multi-week plan with a weekly day-by-day structure (JSON).
CREATE TABLE `training_blocks` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `name` varchar(120) NOT NULL,
  `start_date` date,
  `end_date` date,
  `focus` enum('hypertrophy','strength','cut','recomp','maintenance') NOT NULL,
  `weekly_structure` json,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `training_blocks_id` PRIMARY KEY(`id`)
);

-- Workouts: one row per session. Logged by the user, proposed by the app, or
-- synced from Apple Watch (apple_workout_id used to de-duplicate Watch syncs).
CREATE TABLE `workouts` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `date` date NOT NULL,
  `type` enum('crossfit','strength','cardio','mobility','rest','rest_active','other') NOT NULL,
  `planned_at` datetime,
  `completed_at` datetime,
  `duration_minutes` int,
  `rpe` tinyint,
  `notes` text,
  `source` enum('app_planned','app_logged','apple_watch_sync') NOT NULL,
  `apple_workout_id` varchar(64),
  `workout_data` json,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `workouts_id` PRIMARY KEY(`id`)
);

-- Supplements: the user's stack (active flag = soft delete).
CREATE TABLE `supplements` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `name` varchar(80) NOT NULL,
  `brand` varchar(80),
  `dose` varchar(40) NOT NULL,
  `timing` enum('morning','pre_workout','post_workout','with_lunch','with_dinner','before_bed','flexible') NOT NULL,
  `frequency` enum('daily','training_days_only','specific_days') NOT NULL,
  `specific_days` json,
  `active` boolean NOT NULL DEFAULT true,
  `started_at` date,
  `notes` text,
  CONSTRAINT `supplements_id` PRIMARY KEY(`id`)
);

-- Supplement logs: one taken/not-taken record per supplement per day.
CREATE TABLE `supplement_logs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `supplement_id` int NOT NULL,
  `date` date NOT NULL,
  `taken` boolean NOT NULL DEFAULT false,
  `taken_at` datetime,
  CONSTRAINT `supplement_logs_id` PRIMARY KEY(`id`),
  CONSTRAINT `supplement_logs_unique` UNIQUE(`user_id`,`supplement_id`,`date`)
);

-- Hydration logs: per-day dynamic target + consumed ml + per-drink entries (JSON).
CREATE TABLE `hydration_logs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `date` date NOT NULL,
  `target_ml` int,
  `consumed_ml` int NOT NULL DEFAULT 0,
  `entries` json,
  CONSTRAINT `hydration_logs_id` PRIMARY KEY(`id`),
  CONSTRAINT `hydration_logs_user_date_unique` UNIQUE(`user_id`,`date`)
);

-- Mobility routines: reusable stretch/recovery sequences (exercises as JSON).
CREATE TABLE `mobility_routines` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `name` varchar(120) NOT NULL,
  `duration_minutes` int NOT NULL,
  `exercises` json,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `mobility_routines_id` PRIMARY KEY(`id`)
);

-- After creating the tables, each user gets starter data (training block,
-- mobility routines, supplement stack) automatically on next sign-in/registration.
