CREATE TABLE `daily_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`date` date NOT NULL,
	`meals` json,
	`water_count` int,
	`sleep_hours` decimal(4,2),
	`mood` tinyint,
	`crossfit` boolean,
	`energy` tinyint,
	`stress` tinyint,
	`project_intensity` enum('low','medium','high','crisis'),
	`weight_kg` decimal(5,2),
	`saved_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `daily_logs_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_logs_user_date_unique` UNIQUE(`user_id`,`date`)
);
--> statement-breakpoint
CREATE TABLE `habits_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`date` date NOT NULL,
	`habit_id` enum('meditacion','lectura','estiramiento','sin_azucar','suplementos','pasos') NOT NULL,
	`completed` boolean NOT NULL DEFAULT false,
	CONSTRAINT `habits_logs_id` PRIMARY KEY(`id`),
	CONSTRAINT `habits_logs_user_date_habit_unique` UNIQUE(`user_id`,`date`,`habit_id`)
);
