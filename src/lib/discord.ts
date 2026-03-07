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

export async function verifyDiscordSignature(
	body: string,
	signature: string | null,
	timestamp: string | null,
): Promise<boolean> {
	const publicKey = process.env.DISCORD_PUBLIC_KEY;
	if (!publicKey || !signature || !timestamp) return false;

	try {
		const keyBuf = new ArrayBuffer(publicKey.length / 2);
		const keyView = new Uint8Array(keyBuf);
		for (let i = 0; i < publicKey.length; i += 2) {
			keyView[i / 2] = Number.parseInt(publicKey.substring(i, i + 2), 16);
		}

		const key = await crypto.subtle.importKey(
			"raw",
			keyBuf,
			{ name: "Ed25519" },
			false,
			["verify"],
		);

		const message = new TextEncoder().encode(timestamp + body);

		const sigBuf = new ArrayBuffer(signature.length / 2);
		const sigView = new Uint8Array(sigBuf);
		for (let i = 0; i < signature.length; i += 2) {
			sigView[i / 2] = Number.parseInt(signature.substring(i, i + 2), 16);
		}

		return await crypto.subtle.verify("Ed25519", key, sigBuf, message);
	} catch (e) {
		console.error("Signature verification failed:", e);
		return false;
	}
}
