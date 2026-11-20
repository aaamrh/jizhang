CREATE TABLE `templates` (
	`id` text PRIMARY KEY NOT NULL,
	`ledger_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`category_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`wallet_id` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`member_id` text,
	`sort` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `template_ledger_idx` ON `templates` (`ledger_id`);