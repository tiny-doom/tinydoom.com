import { describe, expect, spyOn, test } from "bun:test";
import { createTelemetryPost } from "../src/app/api/telemetry/route";
import {
	MAX_TELEMETRY_BODY_BYTES,
	TELEMETRY_HAMMERS,
	type TelemetryPayload,
	validateTelemetryPayload,
} from "../src/lib/telemetry";

const installId = "0123456789abcdef0123456789abcdef";

function payload(events: unknown[]): Record<string, unknown> {
	return {
		game: "Hammerbound",
		version: "0.1.0-beta",
		platform: "Windows",
		install_id: installId,
		events,
	};
}

function request(body: unknown, contentType = "application/json") {
	return new Request("https://tinydoom.com/api/telemetry", {
		method: "POST",
		headers: { "Content-Type": contentType },
		body: typeof body === "string" ? body : JSON.stringify(body),
	});
}

describe("telemetry contract", () => {
	test("accepts every hammer", () => {
		const result = validateTelemetryPayload(
			payload(
				TELEMETRY_HAMMERS.map((hammer) => ({
					name: "hammer_selected",
					properties: { hammer },
				})),
			),
		);
		expect(result.valid).toBe(true);
	});

	test("accepts every event and its exact properties", () => {
		const result = validateTelemetryPayload(
			payload([
				{
					name: "telemetry_consent",
					properties: { choice: "accepted" },
				},
				{ name: "session_started", properties: {} },
				{ name: "session_heartbeat", properties: {} },
				{
					name: "hammer_selected",
					properties: { hammer: "coup_de_grace" },
				},
				{
					name: "run_started",
					properties: { hammer: "singularity" },
				},
				{
					name: "run_ended",
					properties: {
						hammer: "singularity",
						outcome: "finished",
						marbles_earned: Number.MAX_SAFE_INTEGER,
					},
				},
				{
					name: "upgrade_purchased",
					properties: { upgrade_id: "steady_hand_3" },
				},
				{ name: "demo_completed", properties: {} },
				{ name: "session_ended", properties: {} },
			]),
		);
		expect(result.valid).toBe(true);
	});

	test("enforces the batch cap", () => {
		const heartbeat = { name: "session_heartbeat", properties: {} };
		expect(
			validateTelemetryPayload(payload(Array.from({ length: 20 }, () => heartbeat)))
				.valid,
		).toBe(true);
		expect(
			validateTelemetryPayload(payload(Array.from({ length: 21 }, () => heartbeat)))
				.valid,
		).toBe(false);
	});

	test("accepts an anonymous decline as a singleton", () => {
		const result = validateTelemetryPayload({
			game: "Hammerbound",
			version: "0.1.0-beta",
			platform: "Windows",
			events: [
				{
					name: "telemetry_consent",
					properties: { choice: "declined" },
				},
			],
		});
		expect(result.valid).toBe(true);
	});

	test("requires install_id on every other batch", () => {
		const withoutId = payload([
			{ name: "session_started", properties: {} },
		]);
		delete withoutId.install_id;
		expect(validateTelemetryPayload(withoutId).valid).toBe(false);
	});

	test("rejects identified or mixed decline batches", () => {
		expect(
			validateTelemetryPayload(
				payload([
					{
						name: "telemetry_consent",
						properties: { choice: "declined" },
					},
				]),
			).valid,
		).toBe(false);
		expect(
			validateTelemetryPayload(
				payload([
					{
						name: "telemetry_consent",
						properties: { choice: "declined" },
					},
					{ name: "session_started", properties: {} },
				]),
			).valid,
		).toBe(false);
	});

	test("rejects invalid metadata and identifiers", () => {
		expect(
			validateTelemetryPayload({
				...payload([{ name: "session_started", properties: {} }]),
				platform: "Linux",
			}).valid,
		).toBe(false);
		expect(
			validateTelemetryPayload({
				...payload([{ name: "session_started", properties: {} }]),
				install_id: "not-an-install-id",
			}).valid,
		).toBe(false);
	});

	test("rejects unknown fields and properties", () => {
		expect(
			validateTelemetryPayload({
				...payload([{ name: "session_started", properties: { extra: true } }]),
				extra: true,
			}).valid,
		).toBe(false);
	});

	test("rejects invalid run values", () => {
		expect(
			validateTelemetryPayload(
				payload([
					{
						name: "run_ended",
						properties: {
							hammer: "nightsilver",
							outcome: "finished",
							marbles_earned: -1,
						},
					},
				]),
			).valid,
		).toBe(false);
	});
});

describe("telemetry endpoint", () => {
	test("persists a valid batch and returns 202", async () => {
		let inserted: TelemetryPayload | undefined;
		const post = createTelemetryPost(async (value) => {
			inserted = value;
		});
		const response = await post(
			request(payload([{ name: "session_started", properties: {} }])),
		);

		expect(response.status).toBe(202);
		expect(await response.json()).toEqual({ accepted: 1 });
		expect(inserted?.install_id).toBe(installId);
	});

	test("returns contract response codes", async () => {
		const post = createTelemetryPost(async () => {});
		expect((await post(request("{", "application/json"))).status).toBe(400);
		expect((await post(request({}, "text/plain"))).status).toBe(415);
		expect((await post(request({}))).status).toBe(422);
		const oversized = "x".repeat(MAX_TELEMETRY_BODY_BYTES + 1);
		expect((await post(request(oversized))).status).toBe(413);
	});

	test("returns 503 when storage fails", async () => {
		const consoleError = spyOn(console, "error").mockImplementation(() => {});
		try {
			const post = createTelemetryPost(async () => {
				throw new Error("database unavailable");
			});
			const response = await post(
				request(payload([{ name: "session_started", properties: {} }])),
			);
			expect(response.status).toBe(503);
		} finally {
			consoleError.mockRestore();
		}
	});
});
