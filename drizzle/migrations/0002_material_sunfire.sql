PRAGMA defer_foreign_keys = ON;--> statement-breakpoint
CREATE TABLE `__new_articles` (
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
	`category_slug` text DEFAULT 'mundo' NOT NULL,
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
INSERT INTO `__new_articles`("id", "dedupe_hash", "source_content_hash", "source", "source_name", "source_url", "source_guid", "source_title", "source_excerpt", "source_author", "source_length", "slug", "title", "dek", "body_md", "category_slug", "tags", "image_url", "image_credit", "image_caption", "status", "validation_errors", "provider_used", "model_used", "tokens_in", "tokens_out", "published_at", "fetched_at", "adapted_at", "updated_at") SELECT "id", "dedupe_hash", "source_content_hash", "source", "source_name", "source_url", "source_guid", "source_title", "source_excerpt", "source_author", "source_length", "slug", "title", "dek", "body_md", "category_slug", "tags", "image_url", "image_credit", "image_caption", "status", "validation_errors", "provider_used", "model_used", "tokens_in", "tokens_out", "published_at", "fetched_at", "adapted_at", "updated_at" FROM `articles`;--> statement-breakpoint
DROP TABLE `articles`;--> statement-breakpoint
ALTER TABLE `__new_articles` RENAME TO `articles`;--> statement-breakpoint
CREATE UNIQUE INDEX `articles_dedupe_hash_idx` ON `articles` (`dedupe_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `articles_slug_idx` ON `articles` (`slug`);--> statement-breakpoint
CREATE INDEX `articles_status_published_idx` ON `articles` (`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `articles_category_published_idx` ON `articles` (`category_slug`,`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `articles_status_fetched_idx` ON `articles` (`status`,`fetched_at`);--> statement-breakpoint
CREATE TABLE `social_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`article_id` text NOT NULL,
	`network` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`container_id` text,
	`remote_post_id` text,
	`card_image_url` text,
	`caption` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`error` text,
	`created_at` integer NOT NULL,
	`published_at` integer,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `social_posts_article_network_idx` ON `social_posts` (`article_id`,`network`);--> statement-breakpoint
CREATE INDEX `social_posts_status_created_idx` ON `social_posts` (`network`,`status`,`created_at`);--> statement-breakpoint
PRAGMA defer_foreign_keys = OFF;