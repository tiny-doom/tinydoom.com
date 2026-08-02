ALTER TABLE "telemetry_events" ADD COLUMN "purchased_upgrade_points" integer;--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD COLUMN "upgrade_points" jsonb;--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD COLUMN "available_upgrades" jsonb;--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD COLUMN "cheapest_available_upgrade_cost" bigint;--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD COLUMN "starting_marble_balance" bigint;--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD COLUMN "duration_seconds" real;--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD COLUMN "run_duration_seconds" real;--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD COLUMN "good_strikes" integer;--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD COLUMN "bad_strikes" integer;--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD COLUMN "swords_fixed" integer;--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD COLUMN "swords_broken" integer;--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD COLUMN "peak_payout_multiplier" real;--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD COLUMN "average_payout_multiplier" real;--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD COLUMN "upgrade_value_earned" real;