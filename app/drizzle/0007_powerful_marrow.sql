ALTER TABLE `goals` ADD `fulfilled_on` text;--> statement-breakpoint
ALTER TABLE `goals` ADD `wish` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `goals` ADD `photo` text;