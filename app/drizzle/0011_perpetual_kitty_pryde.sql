ALTER TABLE `templates` ADD `tags` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `tags` text DEFAULT '[]' NOT NULL;