CREATE TABLE `cravings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`timestamp` datetime NOT NULL,
	`food` varchar(120) NOT NULL,
	`intensity` tinyint NOT NULL,
	`trigger` enum('estres','cansancio','aburrimiento','hambre','vista','social','emocion','otro') NOT NULL,
	`action` enum('cedi','cedi_planeado','porcion_chica','redirigi','espere','agua_prot') NOT NULL,
	`note` text,
	`context` json,
	CONSTRAINT `cravings_id` PRIMARY KEY(`id`)
);
