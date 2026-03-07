import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

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
