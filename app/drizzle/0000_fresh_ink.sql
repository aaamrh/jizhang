CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`ledger_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`name` text NOT NULL,
	`cost_cents` integer NOT NULL,
	`acquired_on` text NOT NULL,
	`status` text DEFAULT 'holding' NOT NULL,
	`ended_on` text,
	`sold_cents` integer,
	`sold_wallet_id` text,
	`use_count` integer DEFAULT 0 NOT NULL,
	`note` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `asset_ledger_idx` ON `assets` (`ledger_id`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`ledger_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`key` text,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`tier` text,
	`icon` text NOT NULL,
	`color` text DEFAULT 'mo' NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`hidden` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `category_ledger_idx` ON `categories` (`ledger_id`);--> statement-breakpoint
CREATE TABLE `ledgers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`ledger_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`type` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`category_id` text,
	`wallet_id` text NOT NULL,
	`to_wallet_id` text,
	`date` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`asset_id` text,
	`review` text,
	`created_by` text,
	`member_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `txn_ledger_date_idx` ON `transactions` (`ledger_id`,`date`);--> statement-breakpoint
CREATE INDEX `txn_wallet_idx` ON `transactions` (`wallet_id`);--> statement-breakpoint
CREATE INDEX `txn_to_wallet_idx` ON `transactions` (`to_wallet_id`);--> statement-breakpoint
CREATE INDEX `txn_category_idx` ON `transactions` (`category_id`);--> statement-breakpoint
CREATE INDEX `txn_asset_idx` ON `transactions` (`asset_id`);--> statement-breakpoint
CREATE TABLE `wallets` (
	`id` text PRIMARY KEY NOT NULL,
	`ledger_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT true NOT NULL,
	`key` text,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`initial_cents` integer DEFAULT 0 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `wallet_ledger_idx` ON `wallets` (`ledger_id`);