CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`source_type` text NOT NULL,
	`source_url` text,
	`r2_key` text,
	`summary` text,
	`date_published` text,
	`ingested_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `edges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` text NOT NULL,
	`target_id` text NOT NULL,
	`relationship` text NOT NULL,
	`weight` real DEFAULT 1,
	`metadata` text,
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX `idx_edges_source` ON `edges` (`source_id`);--> statement-breakpoint
CREATE INDEX `idx_edges_target` ON `edges` (`target_id`);--> statement-breakpoint
CREATE INDEX `idx_edges_rel` ON `edges` (`relationship`);--> statement-breakpoint
CREATE INDEX `idx_edges_pair` ON `edges` (`source_id`,`target_id`);--> statement-breakpoint
CREATE TABLE `nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`metadata` text,
	`source_doc_id` text,
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX `idx_nodes_type` ON `nodes` (`type`);--> statement-breakpoint
CREATE INDEX `idx_nodes_name` ON `nodes` (`name`);--> statement-breakpoint
CREATE INDEX `idx_nodes_source` ON `nodes` (`source_doc_id`);--> statement-breakpoint
CREATE TABLE `simulations` (
	`id` text PRIMARY KEY NOT NULL,
	`input_policy` text NOT NULL,
	`input_location` text,
	`retrieved_context` text,
	`simulation_result` text,
	`sustainability_score` real,
	`weather_context` text,
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX `idx_simulations_date` ON `simulations` (`created_at`);--> statement-breakpoint
CREATE TABLE `weather_cache` (
	`cache_key` text PRIMARY KEY NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`data_type` text NOT NULL,
	`data` text NOT NULL,
	`fetched_at` text DEFAULT (datetime('now')),
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_weather_expires` ON `weather_cache` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_weather_coords` ON `weather_cache` (`lat`,`lng`,`data_type`);