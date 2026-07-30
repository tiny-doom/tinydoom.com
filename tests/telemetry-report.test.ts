import { describe, expect, test } from "bun:test";
import {
	previousUtcWeek,
	summarizeTelemetry,
	telemetryReportEmbed,
	type TelemetryReportEvent,
} from "../src/lib/telemetry-report";

let nextId = 1;
function event(
	name: TelemetryReportEvent["name"],
	overrides: Partial<TelemetryReportEvent> = {},
): TelemetryReportEvent {
	return {
		id: nextId++,
		installId: "0123456789abcdef0123456789abcdef",
		name,
		consentChoice: null,
		hammer: null,
		marblesEarned: null,
		...overrides,
	};
}

describe("weekly telemetry report", () => {
	test("uses the previous UTC calendar week", () => {
		const range = previousUtcWeek(new Date("2026-07-15T18:30:00Z"));
		expect(range.start.toISOString()).toBe("2026-07-06T00:00:00.000Z");
		expect(range.end.toISOString()).toBe("2026-07-13T00:00:00.000Z");
	});

	test("calculates the agreed metrics", () => {
		const report = summarizeTelemetry([
			event("telemetry_consent", { consentChoice: "accepted" }),
			event("session_started"),
			event("session_heartbeat"),
			event("session_heartbeat"),
			event("run_started", { hammer: "hex" }),
			event("run_started", { hammer: "hex" }),
			event("run_started", { hammer: "wildfire" }),
			event("run_ended", { hammer: "hex", marblesEarned: 125 }),
			event("demo_completed"),
			event("session_ended"),
			event("telemetry_consent", {
				installId: null,
				consentChoice: "declined",
			}),
		]);

		expect(report).toEqual({
			acceptedConsent: 1,
			declinedConsent: 1,
			runs: 1,
			totalMarbles: "125",
			demosCompleted: 1,
			mostUsedHammers: ["hex"],
			playtimeMinutes: 2,
			excludedSessions: 0,
		});
	});

	test("builds the friendly Discord embed", () => {
		const embed = telemetryReportEmbed(
			{
				acceptedConsent: 12,
				declinedConsent: 3,
				runs: 45,
				totalMarbles: "1234567",
				demosCompleted: 8,
				mostUsedHammers: ["coup_de_grace", "singularity"],
				playtimeMinutes: 754,
				excludedSessions: 1,
			},
			new Date("2026-07-20T00:00:00Z"),
			new Date("2026-07-27T00:00:00Z"),
		);

		expect(embed).toEqual({
			title: "Hammerbound weekly report",
			color: 0xfb6b1d,
			description: "20–26 July 2026",
			fields: [
				{
					name: "🙋 Consent",
					value: "12 accepted · 3 declined",
					inline: true,
				},
				{ name: "⚒️ Runs forged", value: "45", inline: true },
				{ name: "🔴 Marbles earned", value: "1,234,567", inline: true },
				{ name: "🏁 Demos finished", value: "8", inline: true },
				{
					name: "💖 Favorite hammer",
					value: "Coup de Grâce & Singularity",
					inline: true,
				},
				{ name: "⏱️ Playtime", value: "12h 34m", inline: true },
			],
			footer: { text: "🧹 1 suspicious session excluded" },
		});
	});

	test("fails rather than publishing incomplete event data", () => {
		expect(() => summarizeTelemetry([event("run_ended")])).toThrow(
			"Run earnings are missing",
		);
	});

	test("reports ties for most-used hammer", () => {
		const report = summarizeTelemetry([
			event("run_started", { hammer: "wildfire" }),
			event("run_started", { hammer: "coup_de_grace" }),
		]);
		expect(report.mostUsedHammers).toEqual(["coup_de_grace", "wildfire"]);
	});

	test("excludes sessions beyond conservative activity caps", () => {
		const events = [
			event("session_started"),
			...Array.from({ length: 721 }, () => event("session_heartbeat")),
			event("run_ended", { hammer: "pennyroyal", marblesEarned: 10 }),
			event("session_ended"),
			event("telemetry_consent", {
				installId: null,
				consentChoice: "declined",
			}),
		];
		const report = summarizeTelemetry(events);
		expect(report.excludedSessions).toBe(1);
		expect(report.playtimeMinutes).toBe(0);
		expect(report.runs).toBe(0);
		expect(report.declinedConsent).toBe(1);
	});
});
