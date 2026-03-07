import nacl from "tweetnacl";

const DISCORD_API = "https://discord.com/api/v10";

function botHeaders() {
	const token = process.env.DISCORD_BOT_TOKEN;
	if (!token) throw new Error("DISCORD_BOT_TOKEN is not configured");
	return {
		Authorization: `Bot ${token}`,
		"Content-Type": "application/json",
	};
}

export interface FeedbackEmbed {
	message: string;
	game?: string;
	contact?: string;
	ip: string;
	feedbackId: number;
}

export async function postFeedbackMessage(
	feedback: FeedbackEmbed,
): Promise<string | null> {
	const channelId = process.env.DISCORD_CHANNEL_ID;
	if (!channelId) throw new Error("DISCORD_CHANNEL_ID is not configured");

	const embed = {
		title: "Player Feedback",
		color: 0xa259ff,
		fields: [
			{ name: "Message", value: feedback.message },
			...(feedback.game
				? [{ name: "Game", value: feedback.game, inline: true }]
				: []),
			...(feedback.contact
				? [{ name: "Contact", value: feedback.contact, inline: true }]
				: []),
		],
		footer: { text: `IP: ${feedback.ip} | ID: ${feedback.feedbackId}` },
		timestamp: new Date().toISOString(),
	};

	const components = [
		{
			type: 1, // ActionRow
			components: [
				{
					type: 2, // Button
					style: 4, // Danger (red)
					label: "Ban IP",
					custom_id: `ban_ip:${feedback.ip}`,
					emoji: { name: "🔨" },
				},
			],
		},
	];

	const response = await fetch(
		`${DISCORD_API}/channels/${channelId}/messages`,
		{
			method: "POST",
			headers: botHeaders(),
			body: JSON.stringify({ embeds: [embed], components }),
		},
	);

	if (!response.ok) {
		console.error(
			"Failed to post Discord message:",
			response.status,
			await response.text(),
		);
		return null;
	}

	const data = (await response.json()) as { id: string };
	return data.id;
}

export async function deleteMessage(messageId: string): Promise<boolean> {
	const channelId = process.env.DISCORD_CHANNEL_ID;
	if (!channelId) return false;

	const response = await fetch(
		`${DISCORD_API}/channels/${channelId}/messages/${messageId}`,
		{ method: "DELETE", headers: botHeaders() },
	);

	return response.ok || response.status === 404;
}

export async function updateMessageAsBanned(
	messageId: string,
	ip: string,
	bannedByName: string,
): Promise<void> {
	const channelId = process.env.DISCORD_CHANNEL_ID;
	if (!channelId) return;

	const embed = {
		title: "Player Feedback [BANNED]",
		color: 0xff0000,
		description: `IP \`${ip}\` was banned by ${bannedByName}. All feedback from this IP has been purged.`,
		timestamp: new Date().toISOString(),
	};

	await fetch(`${DISCORD_API}/channels/${channelId}/messages/${messageId}`, {
		method: "PATCH",
		headers: botHeaders(),
		body: JSON.stringify({ embeds: [embed], components: [] }),
	});
}

export function verifyDiscordSignature(
	body: string,
	signature: string | null,
	timestamp: string | null,
): boolean {
	const publicKey = process.env.DISCORD_PUBLIC_KEY;
	if (!publicKey || !signature || !timestamp) return false;

	try {
		return nacl.sign.detached.verify(
			new TextEncoder().encode(timestamp + body),
			hexToUint8Array(signature),
			hexToUint8Array(publicKey),
		);
	} catch (e) {
		console.error("Signature verification failed:", e);
		return false;
	}
}

function hexToUint8Array(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = Number.parseInt(hex.substring(i, i + 2), 16);
	}
	return bytes;
}
