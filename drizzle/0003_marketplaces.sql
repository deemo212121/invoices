CREATE TABLE `marketplace_connections` (
	`channel` text PRIMARY KEY NOT NULL,
	`app_key` text DEFAULT '' NOT NULL,
	`app_secret` text DEFAULT '' NOT NULL,
	`auth_url` text DEFAULT '' NOT NULL,
	`oauth_state` text DEFAULT '' NOT NULL,
	`access_token` text DEFAULT '' NOT NULL,
	`refresh_token` text DEFAULT '' NOT NULL,
	`access_expires_at` integer DEFAULT 0 NOT NULL,
	`refresh_expires_at` integer DEFAULT 0 NOT NULL,
	`seller_name` text DEFAULT '' NOT NULL,
	`shop_id` text DEFAULT '' NOT NULL,
	`shop_name` text DEFAULT '' NOT NULL,
	`shop_cipher` text DEFAULT '' NOT NULL,
	`shop_region` text DEFAULT '' NOT NULL,
	`auto_sync` integer DEFAULT false NOT NULL,
	`orders_synced_to` integer DEFAULT 0 NOT NULL,
	`last_sync_at` text,
	`last_sync_result` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `marketplace_listings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`channel` text NOT NULL,
	`external_product_id` text NOT NULL,
	`external_sku_id` text NOT NULL,
	`seller_sku` text DEFAULT '' NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`status` text DEFAULT '' NOT NULL,
	`external_quantity` integer DEFAULT 0 NOT NULL,
	`warehouse_id` text DEFAULT '' NOT NULL,
	`product_id` integer,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `listings_channel_sku_idx` ON `marketplace_listings` (`channel`,`external_sku_id`);--> statement-breakpoint
CREATE TABLE `marketplace_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`channel` text NOT NULL,
	`external_order_id` text NOT NULL,
	`status` text DEFAULT '' NOT NULL,
	`order_created_at` text NOT NULL,
	`total` real DEFAULT 0 NOT NULL,
	`buyer_name` text DEFAULT '' NOT NULL,
	`sale_id` integer,
	`problem` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mp_orders_channel_order_idx` ON `marketplace_orders` (`channel`,`external_order_id`);--> statement-breakpoint
ALTER TABLE `sales` ADD `channel` text DEFAULT 'pos' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `external_order_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `cancelled_at` text;