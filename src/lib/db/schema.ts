import {
	bigint,
	bigserial,
	index,
	integer,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";
import { TELEMETRY_EVENT_NAMES, TELEMETRY_HAMMERS } from "@/lib/telemetry";

export const feedback = pgTable("feedback", {
	id: serial("id").primaryKey(),
	ip: text("ip").notNull(),
	message: text("message").notNull(),
	game: text("game"),
	contact: text("contact"),
	discordMessageId: text("discord_message_id"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bans = pgTable("bans", {
	id: serial("id").primaryKey(),
	ip: text("ip").notNull().unique(),
	reason: text("reason"),
	bannedBy: text("banned_by"),
	bannedByName: text("banned_by_name"),
	feedbackCount: integer("feedback_count").default(0),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const telemetryEventName = pgEnum(
	"telemetry_event_name",
	TELEMETRY_EVENT_NAMES,
);
export const telemetryHammer = pgEnum("telemetry_hammer", TELEMETRY_HAMMERS);
export const telemetryConsentChoice = pgEnum("telemetry_consent_choice", [
	"accepted",
	"declined",
]);
export const telemetryRunOutcome = pgEnum("telemetry_run_outcome", [
	"finished",
]);
export const telemetryPlatform = pgEnum("telemetry_platform", ["Windows"]);

export const telemetryEvents = pgTable(
	"telemetry_events",
	{
		id: bigserial("id", { mode: "number" }).primaryKey(),
		installId: varchar("install_id", { length: 32 }),
		game: varchar("game", { length: 32 }).notNull(),
		version: varchar("version", { length: 32 }).notNull(),
		platform: telemetryPlatform("platform").notNull(),
		name: telemetryEventName("name").notNull(),
		consentChoice: telemetryConsentChoice("consent_choice"),
		hammer: telemetryHammer("hammer"),
		outcome: telemetryRunOutcome("outcome"),
		marblesEarned: bigint("marbles_earned", { mode: "number" }),
		upgradeId: varchar("upgrade_id", { length: 64 }),
		receivedAt: timestamp("received_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("telemetry_events_received_at_idx").on(table.receivedAt),
		index("telemetry_events_name_received_at_idx").on(
			table.name,
			table.receivedAt,
		),
		index("telemetry_events_install_id_received_at_idx").on(
			table.installId,
			table.receivedAt,
		),
	],
);
