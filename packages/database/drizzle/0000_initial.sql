-- Initial schema for fresh installations.
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_index" integer,
	"label" text NOT NULL,
	"player_tag" text DEFAULT '' NOT NULL,
	"color" text DEFAULT '#4c9a79' NOT NULL,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"resource_status" text DEFAULT 'unanswered' NOT NULL,
	"resource_status_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resource_preparation_minutes" integer DEFAULT 60,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_resource_status_check" CHECK ("accounts"."resource_status" IN ('abundant', 'sufficient', 'insufficient', 'unanswered')),
	CONSTRAINT "accounts_resource_preparation_minutes_check" CHECK ("accounts"."resource_preparation_minutes" IS NULL OR "accounts"."resource_preparation_minutes" BETWEEN 1 AND 525600)
);
--> statement-breakpoint
CREATE TABLE "app_migrations" (
	"key" text PRIMARY KEY NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboard_settings" (
	"singleton" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"group_order" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dashboard_settings_singleton_check" CHECK ("dashboard_settings"."singleton")
);
--> statement-breakpoint
CREATE TABLE "resource_reminder_suppressions" (
	"account_id" uuid NOT NULL,
	"notification_id" bigint NOT NULL,
	"suppress_until" timestamp with time zone NOT NULL,
	"preparation_minutes" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_reminder_suppressions_account_id_pk" PRIMARY KEY("account_id")
);
--> statement-breakpoint
CREATE TABLE "tracked_upgrades" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"source" text NOT NULL,
	"source_key" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"base" text DEFAULT 'home' NOT NULL,
	"current_level" integer DEFAULT 0 NOT NULL,
	"next_level" integer DEFAULT 1 NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finish_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"notification_offsets" integer[] DEFAULT ARRAY[60, 1, 0] NOT NULL,
	"resource_preparation_override_minutes" integer,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tracked_upgrades_source_check" CHECK ("tracked_upgrades"."source" = 'export'),
	CONSTRAINT "tracked_upgrades_type_check" CHECK ("tracked_upgrades"."type" IN ('building', 'hero', 'pet', 'research')),
	CONSTRAINT "tracked_upgrades_base_check" CHECK ("tracked_upgrades"."base" IN ('home', 'builder')),
	CONSTRAINT "tracked_upgrades_status_check" CHECK ("tracked_upgrades"."status" IN ('active', 'completed', 'cancelled')),
	CONSTRAINT "tracked_upgrades_resource_preparation_override_check" CHECK ("tracked_upgrades"."resource_preparation_override_minutes" IS NULL OR "tracked_upgrades"."resource_preparation_override_minutes" BETWEEN 0 AND 525600)
);
--> statement-breakpoint
CREATE TABLE "upgrade_notifications" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"upgrade_id" bigint NOT NULL,
	"minutes_before" integer NOT NULL,
	"notification_kind" text NOT NULL,
	"preparation_minutes" integer,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "upgrade_notifications_minutes_before_check" CHECK ("upgrade_notifications"."minutes_before" >= 0),
	CONSTRAINT "upgrade_notifications_notification_kind_check" CHECK ("upgrade_notifications"."notification_kind" IN ('completion', 'one_minute', 'resource_preparation', 'refresh_required', 'legacy')),
	CONSTRAINT "upgrade_notifications_status_check" CHECK ("upgrade_notifications"."status" IN ('pending', 'processing', 'sent', 'skipped'))
);
--> statement-breakpoint
CREATE TABLE "village_exports" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"player_tag" text NOT NULL,
	"exported_at" timestamp with time zone NOT NULL,
	"raw" jsonb NOT NULL,
	"normalized" jsonb NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resource_reminder_suppressions" ADD CONSTRAINT "resource_reminder_suppressions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_reminder_suppressions" ADD CONSTRAINT "resource_reminder_suppressions_notification_id_upgrade_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."upgrade_notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracked_upgrades" ADD CONSTRAINT "tracked_upgrades_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upgrade_notifications" ADD CONSTRAINT "upgrade_notifications_upgrade_id_tracked_upgrades_id_fk" FOREIGN KEY ("upgrade_id") REFERENCES "public"."tracked_upgrades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "village_exports" ADD CONSTRAINT "village_exports_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_legacy_index_unique_idx" ON "accounts" USING btree ("legacy_index") WHERE "accounts"."legacy_index" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_unique_player_tag_idx" ON "accounts" USING btree (upper("player_tag")) WHERE "accounts"."player_tag" <> '';--> statement-breakpoint
CREATE UNIQUE INDEX "tracked_upgrades_source_key_idx" ON "tracked_upgrades" USING btree ("account_id","source","source_key");--> statement-breakpoint
CREATE INDEX "tracked_upgrades_account_status_idx" ON "tracked_upgrades" USING btree ("account_id","status","finish_at");--> statement-breakpoint
CREATE UNIQUE INDEX "upgrade_notifications_policy_kind_idx" ON "upgrade_notifications" USING btree ("upgrade_id","notification_kind") WHERE "upgrade_notifications"."notification_kind" <> 'legacy';--> statement-breakpoint
CREATE INDEX "upgrade_notifications_due_idx" ON "upgrade_notifications" USING btree ("status","next_attempt_at","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "village_exports_account_exported_unique_idx" ON "village_exports" USING btree ("account_id","exported_at");--> statement-breakpoint
CREATE INDEX "village_exports_latest_idx" ON "village_exports" USING btree ("account_id","exported_at" DESC NULLS LAST);
