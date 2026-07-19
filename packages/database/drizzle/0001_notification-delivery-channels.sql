CREATE TABLE "bark_channel_settings" (
	"channel_id" uuid PRIMARY KEY NOT NULL,
	"base_url" text DEFAULT 'https://api.day.app' NOT NULL,
	"device_key" text NOT NULL,
	"default_group" text,
	"icon_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"channel_type" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_channels_type_check" CHECK ("notification_channels"."channel_type" IN ('bark'))
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"notification_id" bigint NOT NULL,
	"channel_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_deliveries_status_check" CHECK ("notification_deliveries"."status" IN ('pending', 'processing', 'sent', 'skipped'))
);
--> statement-breakpoint
CREATE TABLE "notification_delivery_rules" (
	"channel_id" uuid NOT NULL,
	"notification_kind" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sound" text,
	"interruption_level" text DEFAULT 'active' NOT NULL,
	"critical_volume" integer,
	"repeat_sound" boolean DEFAULT false NOT NULL,
	"group_name" text,
	"target_url" text,
	"archive" boolean,
	"archive_ttl_seconds" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_delivery_rules_channel_id_notification_kind_pk" PRIMARY KEY("channel_id","notification_kind"),
	CONSTRAINT "notification_delivery_rules_kind_check" CHECK ("notification_delivery_rules"."notification_kind" IN ('completion', 'one_minute', 'resource_preparation', 'refresh_required')),
	CONSTRAINT "notification_delivery_rules_level_check" CHECK ("notification_delivery_rules"."interruption_level" IN ('passive', 'active', 'timeSensitive', 'critical')),
	CONSTRAINT "notification_delivery_rules_volume_check" CHECK ("notification_delivery_rules"."critical_volume" IS NULL OR ("notification_delivery_rules"."interruption_level" = 'critical' AND "notification_delivery_rules"."critical_volume" BETWEEN 0 AND 10)),
	CONSTRAINT "notification_delivery_rules_archive_ttl_check" CHECK ("notification_delivery_rules"."archive_ttl_seconds" IS NULL OR ("notification_delivery_rules"."archive" IS TRUE AND "notification_delivery_rules"."archive_ttl_seconds" > 0))
);
--> statement-breakpoint
CREATE TABLE "notification_delivery_suppressions" (
	"account_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"notification_id" bigint NOT NULL,
	"suppress_until" timestamp with time zone NOT NULL,
	"preparation_minutes" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_delivery_suppressions_account_id_channel_id_pk" PRIMARY KEY("account_id","channel_id")
);
--> statement-breakpoint
ALTER TABLE "bark_channel_settings" ADD CONSTRAINT "bark_channel_settings_channel_id_notification_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."notification_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_upgrade_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."upgrade_notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_channel_id_notification_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."notification_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery_rules" ADD CONSTRAINT "notification_delivery_rules_channel_id_notification_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."notification_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery_suppressions" ADD CONSTRAINT "notification_delivery_suppressions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery_suppressions" ADD CONSTRAINT "notification_delivery_suppressions_channel_id_notification_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."notification_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery_suppressions" ADD CONSTRAINT "notification_delivery_suppressions_notification_id_upgrade_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."upgrade_notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_deliveries_notification_channel_idx" ON "notification_deliveries" USING btree ("notification_id","channel_id");--> statement-breakpoint
CREATE INDEX "notification_deliveries_due_idx" ON "notification_deliveries" USING btree ("status","next_attempt_at");