CREATE TABLE `articles` (
	`id` text PRIMARY KEY NOT NULL,
	`dedupe_hash` text NOT NULL,
	`source_content_hash` text NOT NULL,
	`source` text NOT NULL,
	`source_name` text NOT NULL,
	`source_url` text NOT NULL,
	`source_guid` text,
	`source_title` text NOT NULL,
	`source_excerpt` text,
	`source_author` text,
	`source_length` integer DEFAULT 0 NOT NULL,
	`slug` text NOT NULL,
	`title` text,
	`dek` text,
	`body_md` text,
	`category_slug` text DEFAULT 'vaticano' NOT NULL,
	`tags` text,
	`image_url` text,
	`image_credit` text,
	`image_caption` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`validation_errors` text,
	`provider_used` text,
	`model_used` text,
	`tokens_in` integer,
	`tokens_out` integer,
	`published_at` integer NOT NULL,
	`fetched_at` integer NOT NULL,
	`adapted_at` integer,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `articles_dedupe_hash_idx` ON `articles` (`dedupe_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `articles_slug_idx` ON `articles` (`slug`);--> statement-breakpoint
CREATE INDEX `articles_status_published_idx` ON `articles` (`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `articles_category_published_idx` ON `articles` (`category_slug`,`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `articles_status_fetched_idx` ON `articles` (`status`,`fetched_at`);--> statement-breakpoint
CREATE TABLE `ingestion_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`duration_ms` integer,
	`items_seen` integer DEFAULT 0 NOT NULL,
	`items_new` integer DEFAULT 0 NOT NULL,
	`items_duplicate` integer DEFAULT 0 NOT NULL,
	`items_published` integer DEFAULT 0 NOT NULL,
	`items_failed` integer DEFAULT 0 NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `ingestion_runs_source_started_idx` ON `ingestion_runs` (`source`,`started_at`);--> statement-breakpoint
CREATE TABLE `liturgical_days` (
	`date` text PRIMARY KEY NOT NULL,
	`weekday` text NOT NULL,
	`feast` text NOT NULL,
	`commemoration` text,
	`classis` text,
	`marian_saint` text,
	`color` text,
	`gloria` integer,
	`credo` integer,
	`preface` text,
	`note` text,
	`epistle` text,
	`gospel` text,
	`source_url` text NOT NULL,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `liturgical_days_fetched_idx` ON `liturgical_days` (`fetched_at`);