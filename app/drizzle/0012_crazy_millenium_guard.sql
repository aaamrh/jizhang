CREATE TABLE `recurrings` (
	`id` text PRIMARY KEY NOT NULL,
	`ledger_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`type` text NOT NULL,
	`category_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`wallet_id` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`freq` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`done_through` text,
	`paused` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `recurring_ledger_idx` ON `recurrings` (`ledger_id`);--> statement-breakpoint
ALTER TABLE `transactions` ADD `recurring_id` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `photo` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `photo_file_id` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `photo_cached_for` text;