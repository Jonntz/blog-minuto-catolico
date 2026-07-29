CREATE TABLE `subscribers` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` integer NOT NULL,
	`confirmed_at` integer,
	`unsubscribed_at` integer,
	`source` text DEFAULT 'newsletter-home' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscribers_email_idx` ON `subscribers` (`email`);--> statement-breakpoint
ALTER TABLE `ingestion_runs` ADD `items_updated` integer DEFAULT 0 NOT NULL;