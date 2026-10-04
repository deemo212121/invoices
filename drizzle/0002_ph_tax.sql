ALTER TABLE `customers` ADD `tin` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `vat_exempt` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `senior_eligible` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `tax_mode` text DEFAULT 'added' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `vatable_sales` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `vat_exempt_sales` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `senior_discount` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `senior_eligible` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `senior_type` text;--> statement-breakpoint
ALTER TABLE `sales` ADD `senior_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `senior_id_number` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `buyer_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `buyer_address` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `buyer_tin` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `sales_senior_idx` ON `sales` (`senior_id_number`);--> statement-breakpoint
ALTER TABLE `settings` ADD `vat_registered` integer DEFAULT false NOT NULL;