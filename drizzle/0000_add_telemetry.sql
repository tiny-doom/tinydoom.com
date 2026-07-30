CREATE TYPE "public"."telemetry_consent_choice" AS ENUM('accepted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."telemetry_event_name" AS ENUM('telemetry_consent', 'session_started', 'session_heartbeat', 'session_ended', 'hammer_selected', 'run_started', 'run_ended', 'upgrade_purchased', 'demo_completed');--> statement-breakpoint
CREATE TYPE "public"."telemetry_hammer" AS ENUM('pennyroyal', 'crescendo', 'hex', 'wildfire', 'coup_de_grace', 'singularity');--> statement-breakpoint
CREATE TYPE "public"."telemetry_platform" AS ENUM('Windows');--> statement-breakpoint
CREATE TYPE "public"."telemetry_run_outcome" AS ENUM('finished');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bans" (
	"id" serial PRIMARY KEY NOT NULL,
	"ip" text NOT NULL,
	"reason" text,
	"banned_by" text,
	"banned_by_name" text,
	"feedback_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bans_ip_unique" UNIQUE("ip")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"ip" text NOT NULL,
	"message" text NOT NULL,
	"game" text,
	"contact" text,
	"discord_message_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telemetry_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"install_id" varchar(32),
	"game" varchar(32) NOT NULL,
	"version" varchar(32) NOT NULL,
	"platform" "telemetry_platform" NOT NULL,
	"name" "telemetry_event_name" NOT NULL,
	"consent_choice" "telemetry_consent_choice",
	"hammer" "telemetry_hammer",
	"outcome" "telemetry_run_outcome",
	"marbles_earned" bigint,
	"upgrade_id" varchar(64),
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "telemetry_events_received_at_idx" ON "telemetry_events" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "telemetry_events_name_received_at_idx" ON "telemetry_events" USING btree ("name","received_at");--> statement-breakpoint
CREATE INDEX "telemetry_events_install_id_received_at_idx" ON "telemetry_events" USING btree ("install_id","received_at");