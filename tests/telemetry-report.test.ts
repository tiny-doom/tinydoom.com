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
		purchasedUpgradePoints: null,
		upgradePoints: null,
		availableUpgrades: null,
		cheapestAvailableUpgradeCost: null,
		startingMarbleBalance: null,
		durationSeconds: null,
		runDurationSeconds: null,
		goodStrikes: null,
		badStrikes: null,
		swordsFixed: null,
		swordsBroken: null,
		peakPayoutMultiplier: null,
		averagePayoutMultiplier: null,
		upgradeValueEarned: null,
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
			activePlayers: 1,
			acceptedConsent: 1,
			declinedConsent: 1,
			runs: 1,
			totalMarbles: "125",
			demosCompleted: 1,
			averageRunsToPrestige: null,
			averageForgeMinutesToPrestige: null,
			mostUsedHammers: ["hex"],
			playtimeMinutes: 2,
			excludedSessions: 0,
			progressionGraph: [],
			progressionEras: [],
		});
	});

	test("builds the weekly stats embed", () => {
		const embed = telemetryReportEmbed(
			{
				activePlayers: 12,
				acceptedConsent: 2,
				declinedConsent: 1,
				runs: 45,
				totalMarbles: "1234567",
				demosCompleted: 8,
				averageRunsToPrestige: 42,
				averageForgeMinutesToPrestige: 55.5,
				mostUsedHammers: ["singularity"],
				playtimeMinutes: 754,
				excludedSessions: 0,
				progressionGraph: [],
				progressionEras: [],
			},
			new Date("2026-07-20T00:00:00Z"),
			new Date("2026-07-27T00:00:00Z"),
		);
		expect(embed).toMatchObject({
			title: "Hammerbound telemetry report",
			description: "20–26 July 2026",
			fields: expect.arrayContaining([
				{ name: "👥 Players", value: "12", inline: true },
				{ name: "⚒️ Runs forged", value: "45", inline: true },
				{
					name: "⏱️ First prestige",
					value: "42.0 runs · 55.5 forge minutes",
					inline: true,
				},
			]),
		});
	});

	test("measures a complete first-prestige playthrough", () => {
		const report = summarizeTelemetry([
			event("run_ended", {
				marblesEarned: 100,
				purchasedUpgradePoints: 2,
				durationSeconds: 40,
			}),
			event("run_ended", {
				marblesEarned: 200,
				purchasedUpgradePoints: 4,
				durationSeconds: 50,
			}),
			event("demo_completed"),
		]);
		expect(report.averageRunsToPrestige).toBe(2);
		expect(report.averageForgeMinutesToPrestige).toBe(1.5);
	});

	test("ignores prestige journeys that began before the report range", () => {
		const report = summarizeTelemetry([
			event("run_ended", {
				marblesEarned: 100,
				purchasedUpgradePoints: 12,
				durationSeconds: 40,
			}),
			event("demo_completed"),
		]);
		expect(report.averageRunsToPrestige).toBeNull();
		expect(report.averageForgeMinutesToPrestige).toBeNull();
	});

	test("fails rather than publishing incomplete event data", () => {
		expect(() => summarizeTelemetry([event("run_ended")])).toThrow(
			"Run earnings are missing",
		);
	});

	test("graphs progression and explains outliers", () => {
		const report = summarizeTelemetry([
			event("run_ended", {
				hammer: "hex",
				upgradePoints: { copper_orders: 1 },
				marblesEarned: 100,
				purchasedUpgradePoints: 4,
				availableUpgrades: [{ id: "shiny_copper", cost: 100 }],
				startingMarbleBalance: 0,
				durationSeconds: 45,
				goodStrikes: 8,
				badStrikes: 2,
				swordsFixed: 3,
				swordsBroken: 1,
				peakPayoutMultiplier: 5,
				averagePayoutMultiplier: 2.5,
				upgradeValueEarned: 1,
			}),
			event("run_ended", {
				hammer: "wildfire",
				upgradePoints: { steelsmithing: 1 },
				marblesEarned: 20,
				purchasedUpgradePoints: 4,
				availableUpgrades: [{ id: "shiny_copper", cost: 100 }],
				startingMarbleBalance: 10,
				durationSeconds: 30,
				goodStrikes: 1,
				badStrikes: 5,
				swordsFixed: 1,
				swordsBroken: 4,
				peakPayoutMultiplier: 1,
				averagePayoutMultiplier: 1,
				upgradeValueEarned: 0.2,
			}),
		]);
		expect(report.progressionEras).toEqual([
			{ label: "Copper", purchasedUpgradePoints: 4 },
			{ label: "Steel", purchasedUpgradePoints: 4 },
		]);
		expect(report.progressionGraph).toEqual([
			{
				purchasedUpgradePoints: 4,
				runs: 2,
				averageRatio: 0.6,
				outliers: [expect.objectContaining({ hammer: "wildfire", ratio: 0.2 })],
			},
		]);
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
