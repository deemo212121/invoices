CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inventory_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`type` text NOT NULL,
	`quantity_change` integer NOT NULL,
	`quantity_after` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`sale_id` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `movements_product_idx` ON `inventory_movements` (`product_id`);--> statement-breakpoint
CREATE INDEX `movements_created_idx` ON `inventory_movements` (`created_at`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sku` text NOT NULL,
	`barcode` text,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`brand` text DEFAULT '' NOT NULL,
	`cost_price` real DEFAULT 0 NOT NULL,
	`selling_price` real DEFAULT 0 NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`min_stock` integer DEFAULT 0 NOT NULL,
	`image_path` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_sku_unique` ON `products` (`sku`);--> statement-breakpoint
CREATE INDEX `products_name_idx` ON `products` (`name`);--> statement-breakpoint
CREATE INDEX `products_barcode_idx` ON `products` (`barcode`);--> statement-breakpoint
CREATE TABLE `sale_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sale_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`name` text NOT NULL,
	`sku` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` real NOT NULL,
	`line_total` real NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_number` text NOT NULL,
	`customer_id` integer,
	`subtotal` real NOT NULL,
	`discount` real DEFAULT 0 NOT NULL,
	`tax_rate` real DEFAULT 0 NOT NULL,
	`tax` real DEFAULT 0 NOT NULL,
	`total` real NOT NULL,
	`payment_method` text NOT NULL,
	`amount_paid` real NOT NULL,
	`change` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sales_invoice_number_unique` ON `sales` (`invoice_number`);--> statement-breakpoint
CREATE INDEX `sales_created_idx` ON `sales` (`created_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`business_name` text DEFAULT 'My Business' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`tax_id` text DEFAULT '' NOT NULL,
	`currency_symbol` text DEFAULT '$' NOT NULL,
	`default_tax_rate` real DEFAULT 0 NOT NULL,
	`invoice_footer` text DEFAULT 'Thank you for your business!' NOT NULL
);
