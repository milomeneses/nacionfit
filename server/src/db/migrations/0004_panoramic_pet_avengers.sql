CREATE TABLE `ai_conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`started_at` timestamp NOT NULL DEFAULT (now()),
	`last_message_at` timestamp NOT NULL DEFAULT (now()),
	`summary` text,
	CONSTRAINT `ai_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversation_id` int NOT NULL,
	`role` enum('user','assistant','system') NOT NULL,
	`content` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`tokens_used` int,
	CONSTRAINT `ai_messages_id` PRIMARY KEY(`id`)
);
