import { expect, test } from "bun:test";
import {
	createTelemetryWeeklyGet,
	GET,
	requestedTelemetryRange,
} from "../src/app/api/cron/telemetry-weekly/route";

test("telemetry report accepts a bounded custom UTC range", () => {
	const range = requestedTelemetryRange(
		new Request(
			"https://tinydoom.com/api/cron/telemetry-weekly?start=2026-08-02&end=2026-08-03",
		),
	);
	expect(range?.start.toISOString()).toBe("2026-08-02T00:00:00.000Z");
	expect(range?.end.toISOString()).toBe("2026-08-03T00:00:00.000Z");
	expect(
		requestedTelemetryRange(
			new Request(
				"https://tinydoom.com/api/cron/telemetry-weekly?start=2026-08-02&end=2026-10-03",
			),
		),
	).toBeNull();
});

test("weekly telemetry cron rejects requests without its bearer secret", async () => {
	const previousSecret = process.env.CRON_SECRET;
	process.env.CRON_SECRET = "test-secret";
	try {
		const response = await GET(
			new Request("https://tinydoom.com/api/cron/telemetry-weekly"),
		);
		expect(response.status).toBe(401);
	} finally {
		if (previousSecret === undefined) {
			delete process.env.CRON_SECRET;
		} else {
			process.env.CRON_SECRET = previousSecret;
		}
	}
});

test("weekly telemetry cron skips weeks without active players", async () => {
	const previousSecret = process.env.CRON_SECRET;
	process.env.CRON_SECRET = "test-secret";
	let published = false;
	try {
		const get = createTelemetryWeeklyGet(
			async () => ({
				activePlayers: 0,
				acceptedConsent: 0,
				declinedConsent: 0,
				runs: 0,
				totalMarbles: "0",
				demosCompleted: 0,
				averageRunsToPrestige: null,
				averageForgeMinutesToPrestige: null,
				mostUsedHammers: [],
				playtimeMinutes: 0,
				excludedSessions: 0,
				progressionGraph: [],
				progressionEras: [],
			}),
			async () => {
				published = true;
			},
		);
		const response = await get(
			new Request("https://tinydoom.com/api/cron/telemetry-weekly", {
				headers: { Authorization: "Bearer test-secret" },
			}),
		);
		expect(response.status).toBe(200);
		expect((await response.json()).skipped).toBe(true);
		expect(published).toBe(false);
	} finally {
		if (previousSecret === undefined) {
			delete process.env.CRON_SECRET;
		} else {
			process.env.CRON_SECRET = previousSecret;
		}
	}
});
