CREATE TABLE `scrape_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`city_node_id` text NOT NULL,
	`topic` text NOT NULL,
	`ring` integer NOT NULL,
	`status` text NOT NULL,
	`search_query` text,
	`results_found` integer DEFAULT 0,
	`policies_ingested` integer DEFAULT 0,
	`error` text,
	`started_at` text,
	`completed_at` text,
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX `idx_scrape_status` ON `scrape_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `idx_scrape_city` ON `scrape_jobs` (`city_node_id`);--> statement-breakpoint
CREATE INDEX `idx_scrape_ring` ON `scrape_jobs` (`ring`);