CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`at` text NOT NULL,
	`project_id` text,
	`task_id` text,
	`actor` text NOT NULL,
	`summary` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `guards` (
	`id` text PRIMARY KEY NOT NULL,
	`valid` integer NOT NULL,
	CONSTRAINT "valid_revision" CHECK("guards"."valid"=1)
);
--> statement-breakpoint
CREATE TABLE `records` (
	`key` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `versions` (
	`id` integer PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL
);
