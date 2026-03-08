import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { postFeedbackMessage } from "@/lib/discord";
import { checkRateLimit } from "@/lib/rate-limit";

const MAX_MESSAGE_LENGTH = 1000;
const MAX_GAME_LENGTH = 100;
const MAX_CONTACT_LENGTH = 200;

interface FeedbackPayload {
	message: string;
	game?: string;
	contact?: string;
}

function getClientIP(request: NextRequest): string {
	return (
		request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
		request.headers.get("x-real-ip") ||
		"unknown"
	);
}

function validatePayload(
	body: unknown,
): { valid: true; data: FeedbackPayload } | { valid: false; error: string } {
	if (!body || typeof body !== "object") {
		return { valid: false, error: "Invalid request body" };
	}

	const { message, game, contact } = body as Record<string, unknown>;

	if (typeof message !== "string" || message.trim().length === 0) {
		return { valid: false, error: "Message is required" };
	}
	if (message.length > MAX_MESSAGE_LENGTH) {
		return {
			valid: false,
			error: `Message must be under ${MAX_MESSAGE_LENGTH} characters`,
		};
	}
	if (
		game !== undefined &&
		(typeof game !== "string" || game.length > MAX_GAME_LENGTH)
	) {
		return {
			valid: false,
			error: `Game must be a string under ${MAX_GAME_LENGTH} characters`,
		};
	}
	if (
		contact !== undefined &&
		(typeof contact !== "string" || contact.length > MAX_CONTACT_LENGTH)
	) {
		return {
			valid: false,
			error: `Contact must be a string under ${MAX_CONTACT_LENGTH} characters`,
		};
	}

	return {
		valid: true,
		data: {
			message: message.trim(),
			game: typeof game === "string" ? game.trim() : undefined,
			contact: typeof contact === "string" ? contact.trim() : undefined,
		},
	};
}

export async function POST(request: NextRequest) {
	const ip = getClientIP(request);

	// Layer 1: Persistent DB ban check
	const [existingBan] = await db
		.select()
		.from(schema.bans)
		.where(eq(schema.bans.ip, ip))
		.limit(1);

	if (existingBan) {
		return NextResponse.json(
			{ error: "You have been permanently banned from submitting feedback." },
			{ status: 403 },
		);
	}

	// Parse and validate body
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	const validation = validatePayload(body);
	if (!validation.valid) {
		return NextResponse.json({ error: validation.error }, { status: 400 });
	}

	const { message, game, contact } = validation.data;

	// Layer 2: Smart rate limit (checks content for duplicates + burst detection)
	const rateResult = checkRateLimit(ip, message);
	if (!rateResult.allowed) {
		// 5 strikes: write permaban to DB
		if (rateResult.permaban) {
			await db
				.insert(schema.bans)
				.values({
					ip,
					reason: "Automatic permaban: 5 rate limit strikes",
					bannedBy: "system",
					bannedByName: "rate-limiter",
				})
				.onConflictDoNothing();
		}

		const status = rateResult.banned ? 403 : 429;
		const msg = rateResult.banned
			? "You have been banned due to excessive requests."
			: "Too many requests. Please try again later.";
		return NextResponse.json(
			{ error: msg },
			{
				status,
				headers: { "Retry-After": String(rateResult.retryAfterSeconds) },
			},
		);
	}

	// Store in database
	const [inserted] = await db
		.insert(schema.feedback)
		.values({ ip, message, game, contact })
		.returning({ id: schema.feedback.id });

	// Post to Discord with ban button
	try {
		const discordMessageId = await postFeedbackMessage({
			message,
			game,
			contact,
			ip,
			feedbackId: inserted.id,
		});

		if (discordMessageId) {
			await db
				.update(schema.feedback)
				.set({ discordMessageId })
				.where(eq(schema.feedback.id, inserted.id));
		}
	} catch (error) {
		console.error("Discord post failed:", error);
		// Feedback is still saved in DB, just not posted to Discord
	}

	return NextResponse.json({ success: true });
}
