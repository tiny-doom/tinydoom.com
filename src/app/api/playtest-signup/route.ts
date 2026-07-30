import { NextResponse } from "next/server";
import {
	type PlaytestSignupEmbed,
	postPlaytestSignupMessage,
} from "@/lib/discord";
import { checkRateLimit, type RateLimitResult } from "@/lib/rate-limit";

const MAX_BODY_LENGTH = 1024;
const MAX_NAME_LENGTH = 100;
const STEAM_ID_PATTERN = /^\d{17}$/;

export type PlaytestSignup = PlaytestSignupEmbed;

type ValidationResult =
	| { valid: true; data: PlaytestSignup }
	| { valid: false; error: string };

type DeliverSignup = (signup: PlaytestSignup) => Promise<void>;
type RateSignup = (ip: string, content: string) => RateLimitResult;

export function validatePlaytestSignup(body: unknown): ValidationResult {
	if (!body || typeof body !== "object" || Array.isArray(body)) {
		return { valid: false, error: "Invalid request body" };
	}

	const record = body as Record<string, unknown>;
	if (
		Object.keys(record).length !== 2 ||
		!("name" in record) ||
		!("steam_id" in record)
	) {
		return { valid: false, error: "Name and Steam ID are required" };
	}

	const name = typeof record.name === "string" ? record.name.trim() : "";
	if (!name || name.length > MAX_NAME_LENGTH) {
		return {
			valid: false,
			error: `Name must be between 1 and ${MAX_NAME_LENGTH} characters`,
		};
	}

	if (
		typeof record.steam_id !== "string" ||
		!STEAM_ID_PATTERN.test(record.steam_id)
	) {
		return { valid: false, error: "Steam ID must be exactly 17 digits" };
	}

	return { valid: true, data: { name, steamId: record.steam_id } };
}

function clientIp(request: Request): string {
	return (
		request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
		request.headers.get("x-real-ip") ||
		"unknown"
	);
}

export function createPlaytestSignupPost(
	deliver: DeliverSignup,
	rate: RateSignup = checkRateLimit,
) {
	return async function POST(request: Request) {
		if (!request.headers.get("content-type")?.includes("application/json")) {
			return NextResponse.json(
				{ error: "Content type must be application/json" },
				{ status: 415 },
			);
		}

		const text = await request.text();
		if (text.length > MAX_BODY_LENGTH) {
			return NextResponse.json(
				{ error: "Request is too large" },
				{ status: 413 },
			);
		}

		let body: unknown;
		try {
			body = JSON.parse(text);
		} catch {
			return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
		}

		const validation = validatePlaytestSignup(body);
		if (!validation.valid) {
			return NextResponse.json({ error: validation.error }, { status: 422 });
		}

		const rateResult = rate(
			clientIp(request),
			`${validation.data.name}:${validation.data.steamId}`,
		);
		if (!rateResult.allowed) {
			return NextResponse.json(
				{ error: "Too many requests. Please try again later." },
				{
					status: 429,
					headers: { "Retry-After": String(rateResult.retryAfterSeconds) },
				},
			);
		}

		try {
			await deliver(validation.data);
		} catch (error) {
			console.error("Playtest signup delivery failed", error);
			return NextResponse.json(
				{ error: "Your letter could not be sent. Please try again." },
				{ status: 503 },
			);
		}

		return NextResponse.json({ success: true }, { status: 201 });
	};
}

export const POST = createPlaytestSignupPost(postPlaytestSignupMessage);
