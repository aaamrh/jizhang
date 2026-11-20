CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`ledger_id` text NOT NULL,
	`user_id` text,
	`nickname` text NOT NULL,
	`role` text NOT NULL,
	`elder_mode` integer DEFAULT false NOT NULL,
	`is_me` integer DEFAULT false NOT NULL,
	`joined_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `member_ledger_idx` ON `members` (`ledger_id`);--> statement-breakpoint
ALTER TABLE `ledgers` ADD `remote` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `ledgers` ADD `cursor` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ledgers` ADD `my_role` text;