CREATE TABLE `budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`ledger_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`category_id` text,
	`amount_cents` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `budget_ledger_idx` ON `budgets` (`ledger_id`);--> statement-breakpoint
CREATE TABLE `day_marks` (
	`id` text PRIMARY KEY NOT NULL,
	`ledger_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`date` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `day_mark_date_idx` ON `day_marks` (`date`);