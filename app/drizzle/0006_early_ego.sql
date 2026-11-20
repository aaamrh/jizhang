CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`ledger_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`name` text NOT NULL,
	`target_cents` integer NOT NULL,
	`deadline` text,
	`wallet_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_on` text NOT NULL,
	`achieved_on` text,
	`achieved_cents` integer
);
--> statement-breakpoint
CREATE INDEX `goal_ledger_idx` ON `goals` (`ledger_id`);