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
--> statement-breakpoint
CREATE TABLE `mobility_routines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`duration_minutes` int NOT NULL,
	`exercises` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mobility_routines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
