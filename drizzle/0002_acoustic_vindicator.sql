ALTER TABLE `music_libraries` ADD `account_name` text;
--> statement-breakpoint
UPDATE `music_libraries` SET `account_email` = NULL;
