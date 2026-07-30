import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import {
	MAX_TELEMETRY_BODY_BYTES,
	type TelemetryPayload,
	validateTelemetryPayload,
} from "@/lib/telemetry";

type InsertTelemetryBatch = (
	payload: TelemetryPayload,
	receivedAt: Date,
) => Promise<void>;

function eventColumns(event: TelemetryPayload["events"][number]) {
	switch (event.name) {
		case "telemetry_consent":
			return { consentChoice: event.properties.choice };
		case "hammer_selected":
		case "run_started":
			return { hammer: event.properties.hammer };
		case "run_ended":
			return {
				hammer: event.properties.hammer,
				outcome: event.properties.outcome,
				marblesEarned: event.properties.marbles_earned,
			};
		case "upgrade_purchased":
			return { upgradeId: event.properties.upgrade_id };
		default:
			return {};
	}
}

async function insertTelemetryBatch(
	payload: TelemetryPayload,
	receivedAt: Date,
): Promise<void> {
	await db.insert(schema.telemetryEvents).values(
		payload.events.map((event) => ({
			installId: payload.install_id,
			game: payload.game,
			version: payload.version,
			platform: payload.platform,
			name: event.name,
			receivedAt,
			...eventColumns(event),
		})),
	);
}

function error(status: number, code: string) {
	return NextResponse.json({ error: code }, { status });
}

export function createTelemetryPost(
	insert: InsertTelemetryBatch = insertTelemetryBatch,
) {
	return async function POST(request: Request) {
		const contentType = request.headers.get("content-type")?.split(";", 1)[0];
		if (contentType?.trim().toLowerCase() !== "application/json") {
			return error(415, "unsupported_media_type");
		}

		const contentLength = Number(request.headers.get("content-length"));
		if (
			Number.isFinite(contentLength) &&
			contentLength > MAX_TELEMETRY_BODY_BYTES
		) {
			return error(413, "payload_too_large");
		}

		let bodyText: string;
		try {
			bodyText = await request.text();
		} catch {
			return error(400, "invalid_json");
		}
		if (
			new TextEncoder().encode(bodyText).byteLength > MAX_TELEMETRY_BODY_BYTES
		) {
			return error(413, "payload_too_large");
		}

		let body: unknown;
		try {
			body = JSON.parse(bodyText);
		} catch {
			return error(400, "invalid_json");
		}

		const validation = validateTelemetryPayload(body);
		if (!validation.valid) return error(422, "invalid_payload");

		try {
			await insert(validation.data, new Date());
		} catch {
			console.error("Telemetry insert failed");
			return error(503, "temporarily_unavailable");
		}

		return NextResponse.json(
			{ accepted: validation.data.events.length },
			{ status: 202 },
		);
	};
}

export const POST = createTelemetryPost();
