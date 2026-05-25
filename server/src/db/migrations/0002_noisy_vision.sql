CREATE TABLE `health_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`date` date NOT NULL,
	`sleep_minutes` int,
	`deep_sleep_minutes` int,
	`rem_sleep_minutes` int,
	`awake_minutes` int,
	`hrv_ms` decimal(6,2),
	`resting_hr` int,
	`steps` int,
	`active_calories` int,
	`source` varchar(40),
	`synced_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `health_data_id` PRIMARY KEY(`id`),
	CONSTRAINT `health_data_user_date_unique` UNIQUE(`user_id`,`date`)
);
--> statement-breakpoint
CREATE TABLE `user_webhook_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`token` varchar(64) NOT NULL,
	`last_sync_at` timestamp,
	CONSTRAINT `user_webhook_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_webhook_tokens_token_unique` UNIQUE(`token`)
);
