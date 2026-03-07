import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import {
	deleteMessage,
	updateMessageAsBanned,
	verifyDiscordSignature,
} from "@/lib/discord";

// Discord interaction types
const INTERACTION_TYPE_PING = 1;
const INTERACTION_TYPE_COMPONENT = 3;

// Discord response types
const RESPONSE_PONG = 1;
const RESPONSE_UPDATE_MESSAGE = 7;

export async function POST(request: NextRequest) {
	const body = await request.text();
	const signature = request.headers.get("x-signature-ed25519");
	const timestamp = request.headers.get("x-signature-timestamp");

	// Verify signature
	const isValid = await verifyDiscordSignature(body, signature, timestamp);
	if (!isValid) {
		return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
	}

	const interaction = JSON.parse(body);

	// Handle PING (Discord verification handshake)
	if (interaction.type === INTERACTION_TYPE_PING) {
		return NextResponse.json({ type: RESPONSE_PONG });
	}

	// Handle button clicks
	if (interaction.type === INTERACTION_TYPE_COMPONENT) {
		const customId: string = interaction.data?.custom_id ?? "";

		if (customId.startsWith("ban_ip:")) {
			return await handleBanIP(interaction, customId);
		}

		if (customId.startsWith("confirm_ban:")) {
			return await handleConfirmBan(interaction, customId);
		}

		if (customId.startsWith("cancel_ban:")) {
			return await handleCancelBan(interaction);
		}
	}

	return NextResponse.json({ type: RESPONSE_PONG });
}

async function handleBanIP(
	interaction: Record<string, unknown>,
	customId: string,
) {
	const ip = customId.replace("ban_ip:", "");

	// Show confirmation buttons instead of banning immediately
	return NextResponse.json({
		type: RESPONSE_UPDATE_MESSAGE,
		data: {
			embeds: (interaction as { message?: { embeds?: unknown[] } }).message
				?.embeds,
			components: [
				{
					type: 1,
					components: [
						{
							type: 2,
							style: 4, // Danger
							label: `Confirm Ban ${ip}`,
							custom_id: `confirm_ban:${ip}`,
							emoji: { name: "⚠️" },
						},
						{
							type: 2,
							style: 2, // Secondary
							label: "Cancel",
							custom_id: `cancel_ban:${ip}`,
						},
					],
				},
			],
		},
	});
}

async function handleConfirmBan(
	interaction: Record<string, unknown>,
	customId: string,
) {
	const ip = customId.replace("confirm_ban:", "");
	const member = interaction.member as
		| { user?: { id?: string; username?: string } }
		| undefined;
	const userId = member?.user?.id ?? "unknown";
	const userName = member?.user?.username ?? "unknown";

	// Check if already banned
	const [existingBan] = await db
		.select()
		.from(schema.bans)
		.where(eq(schema.bans.ip, ip))
		.limit(1);

	if (existingBan) {
		return NextResponse.json({
			type: RESPONSE_UPDATE_MESSAGE,
			data: {
				embeds: [
					{
						title: "Already Banned",
						description: `IP \`${ip}\` is already banned.`,
						color: 0xff9900,
					},
				],
				components: [],
			},
		});
	}

	// Find all feedback from this IP
	const feedbackEntries = await db
		.select()
		.from(schema.feedback)
		.where(eq(schema.feedback.ip, ip));

	// Insert ban
	await db.insert(schema.bans).values({
		ip,
		reason: "Banned via Discord",
		bannedBy: userId,
		bannedByName: userName,
		feedbackCount: feedbackEntries.length,
	});

	// Delete all Discord messages from this IP (except the current one)
	const currentMessageId = (interaction as { message?: { id?: string } })
		.message?.id;
	const deletePromises = feedbackEntries
		.filter(
			(f) => f.discordMessageId && f.discordMessageId !== currentMessageId,
		)
		.map((f) => deleteMessage(f.discordMessageId as string));

	await Promise.allSettled(deletePromises);

	// Update the current message to show ban confirmation
	if (currentMessageId) {
		await updateMessageAsBanned(currentMessageId, ip, userName);
	}

	return NextResponse.json({
		type: RESPONSE_UPDATE_MESSAGE,
		data: {
			embeds: [
				{
					title: "IP Banned",
					color: 0xff0000,
					description: `IP \`${ip}\` has been permanently banned by ${userName}.`,
					fields: [
						{
							name: "Feedback purged",
							value: `${feedbackEntries.length} message(s) deleted`,
							inline: true,
						},
					],
					timestamp: new Date().toISOString(),
				},
			],
			components: [],
		},
	});
}

async function handleCancelBan(interaction: Record<string, unknown>) {
	// Restore the original message with the ban button
	const message = interaction.message as { embeds?: unknown[] } | undefined;
	const embeds = message?.embeds ?? [];

	// Extract IP from the embed footer
	let ip = "unknown";
	const firstEmbed = embeds[0] as { footer?: { text?: string } } | undefined;
	if (firstEmbed?.footer?.text) {
		const match = firstEmbed.footer.text.match(/IP: ([^\s|]+)/);
		if (match) ip = match[1];
	}

	return NextResponse.json({
		type: RESPONSE_UPDATE_MESSAGE,
		data: {
			embeds,
			components: [
				{
					type: 1,
					components: [
						{
							type: 2,
							style: 4,
							label: "Ban IP",
							custom_id: `ban_ip:${ip}`,
							emoji: { name: "🔨" },
						},
					],
				},
			],
		},
	});
}
