import { and, asc, gte, lt } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type {
	TelemetryAvailableUpgrade,
	TelemetryConsentChoice,
	TelemetryEventName,
	TelemetryHammer,
} from "@/lib/telemetry";

const MAX_SESSION_HEARTBEATS = 12 * 60;
const MAX_SESSION_RUNS = 1_000;

export interface TelemetryReportEvent {
	id: number;
	installId: string | null;
	name: TelemetryEventName;
	consentChoice: TelemetryConsentChoice | null;
	hammer: TelemetryHammer | null;
	marblesEarned: number | null;
	purchasedUpgradePoints: number | null;
	upgradePoints: Record<string, number> | null;
	availableUpgrades: TelemetryAvailableUpgrade[] | null;
	cheapestAvailableUpgradeCost: number | null;
	startingMarbleBalance: number | null;
	durationSeconds: number | null;
	runDurationSeconds: number | null;
	goodStrikes: number | null;
	badStrikes: number | null;
	swordsFixed: number | null;
	swordsBroken: number | null;
	peakPayoutMultiplier: number | null;
	averagePayoutMultiplier: number | null;
	upgradeValueEarned: number | null;
}

export interface TelemetryProgressionRun {
	purchasedUpgradePoints: number;
	upgradePoints: Record<string, number>;
	ratio: number;
	hammer: TelemetryHammer;
	marblesEarned: number;
	startingMarbleBalance: number;
	frontier: TelemetryAvailableUpgrade[];
	durationSeconds: number;
	goodStrikes: number;
	badStrikes: number;
	swordsFixed: number;
	swordsBroken: number;
	peakPayoutMultiplier: number;
	averagePayoutMultiplier: number;
}

export interface TelemetryProgressionPoint {
	purchasedUpgradePoints: number;
	runs: number;
	averageRatio: number;
	outliers: TelemetryProgressionRun[];
}

export interface TelemetryEraMarker {
	label: string;
	purchasedUpgradePoints: number;
}

export interface TelemetryReport {
	activePlayers: number;
	acceptedConsent: number;
	declinedConsent: number;
	runs: number;
	totalMarbles: string;
	demosCompleted: number;
	averageRunsToPrestige: number | null;
	averageForgeMinutesToPrestige: number | null;
	mostUsedHammers: TelemetryHammer[];
	playtimeMinutes: number;
	excludedSessions: number;
	progressionGraph: TelemetryProgressionPoint[];
	progressionEras: TelemetryEraMarker[];
}

export function previousUtcWeek(now = new Date()): { start: Date; end: Date } {
	const end = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
	);
	const daysSinceMonday = (end.getUTCDay() + 6) % 7;
	end.setUTCDate(end.getUTCDate() - daysSinceMonday);
	const start = new Date(end);
	start.setUTCDate(start.getUTCDate() - 7);
	return { start, end };
}

function reportableEvents(events: TelemetryReportEvent[]): {
	events: TelemetryReportEvent[];
	excludedSessions: number;
} {
	const anonymous = events.filter((event) => event.installId === null);
	const installed = new Map<string, TelemetryReportEvent[]>();
	for (const event of events) {
		if (!event.installId) continue;
		const installEvents = installed.get(event.installId) ?? [];
		installEvents.push(event);
		installed.set(event.installId, installEvents);
	}

	const included = [...anonymous];
	let excludedSessions = 0;
	for (const installEvents of installed.values()) {
		let session: TelemetryReportEvent[] = [];
		const finishSession = () => {
			if (session.length === 0) return;
			const heartbeats = session.filter(
				(event) => event.name === "session_heartbeat",
			).length;
			const runs = session.filter((event) => event.name === "run_ended").length;
			if (heartbeats > MAX_SESSION_HEARTBEATS || runs > MAX_SESSION_RUNS) {
				excludedSessions++;
			} else {
				included.push(...session);
			}
			session = [];
		};

		for (const event of installEvents) {
			if (event.name === "session_started" && session.length > 0) {
				finishSession();
			}
			session.push(event);
			if (event.name === "session_ended") finishSession();
		}
		finishSession();
	}

	return { events: included, excludedSessions };
}

export function summarizeTelemetry(
	allEvents: TelemetryReportEvent[],
): TelemetryReport {
	const { events, excludedSessions } = reportableEvents(allEvents);
	const activePlayers = new Set(
		events.flatMap((event) => (event.installId ? [event.installId] : [])),
	).size;
	const hammerCounts = new Map<TelemetryHammer, number>();
	let totalMarbles = BigInt(0);
	let acceptedConsent = 0;
	let declinedConsent = 0;
	let runs = 0;
	let demosCompleted = 0;
	let playtimeMinutes = 0;
	const progressionRuns: TelemetryProgressionRun[] = [];
	const activePrestigeRuns = new Map<
		string,
		{ runs: number; seconds: number; startedAtRoot: boolean }
	>();
	const completedPrestigeRuns: { runs: number; seconds: number }[] = [];

	for (const event of events) {
		if (event.name === "telemetry_consent") {
			if (!event.consentChoice) throw new Error("Consent choice is missing");
			if (event.consentChoice === "accepted") acceptedConsent++;
			if (event.consentChoice === "declined") declinedConsent++;
		}
		if (event.name === "run_ended") {
			if (event.marblesEarned === null) {
				throw new Error("Run earnings are missing");
			}
			runs++;
			totalMarbles += BigInt(event.marblesEarned);
			if (event.installId) {
				const journey = activePrestigeRuns.get(event.installId) ?? {
					runs: 0,
					seconds: 0,
					startedAtRoot:
						event.purchasedUpgradePoints !== null &&
						event.purchasedUpgradePoints <= 2,
				};
				journey.runs++;
				journey.seconds += event.durationSeconds ?? 0;
				activePrestigeRuns.set(event.installId, journey);
			}
			if (
				event.hammer &&
				event.purchasedUpgradePoints !== null &&
				event.upgradeValueEarned !== null &&
				event.availableUpgrades &&
				event.startingMarbleBalance !== null &&
				event.durationSeconds !== null &&
				event.goodStrikes !== null &&
				event.badStrikes !== null &&
				event.swordsFixed !== null &&
				event.swordsBroken !== null &&
				event.peakPayoutMultiplier !== null &&
				event.averagePayoutMultiplier !== null
			) {
				progressionRuns.push({
					purchasedUpgradePoints: event.purchasedUpgradePoints,
					upgradePoints: event.upgradePoints ?? {},
					ratio: event.upgradeValueEarned,
					hammer: event.hammer,
					marblesEarned: event.marblesEarned,
					startingMarbleBalance: event.startingMarbleBalance,
					frontier: event.availableUpgrades,
					durationSeconds: event.durationSeconds,
					goodStrikes: event.goodStrikes,
					badStrikes: event.badStrikes,
					swordsFixed: event.swordsFixed,
					swordsBroken: event.swordsBroken,
					peakPayoutMultiplier: event.peakPayoutMultiplier,
					averagePayoutMultiplier: event.averagePayoutMultiplier,
				});
			}
		}
		if (event.name === "demo_completed") {
			demosCompleted++;
			if (event.installId) {
				const journey = activePrestigeRuns.get(event.installId);
				if (journey?.startedAtRoot && journey.runs > 0) {
					completedPrestigeRuns.push(journey);
				}
				activePrestigeRuns.delete(event.installId);
			}
		}
		if (event.name === "session_heartbeat") playtimeMinutes++;
		if (event.name === "run_started") {
			if (!event.hammer) throw new Error("Run hammer is missing");
			hammerCounts.set(event.hammer, (hammerCounts.get(event.hammer) ?? 0) + 1);
		}
	}

	const highestHammerCount = Math.max(0, ...hammerCounts.values());
	const mostUsedHammers = [...hammerCounts.entries()]
		.filter(([, count]) => count === highestHammerCount)
		.map(([hammer]) => hammer)
		.sort();
	const progressionByPoint = new Map<number, TelemetryProgressionRun[]>();
	for (const run of progressionRuns) {
		const pointRuns = progressionByPoint.get(run.purchasedUpgradePoints) ?? [];
		pointRuns.push(run);
		progressionByPoint.set(run.purchasedUpgradePoints, pointRuns);
	}
	const progressionGraph = [...progressionByPoint.entries()]
		.sort(([left], [right]) => left - right)
		.map(([purchasedUpgradePoints, pointRuns]) => ({
			purchasedUpgradePoints,
			runs: pointRuns.length,
			averageRatio:
				pointRuns.reduce((sum, run) => sum + run.ratio, 0) / pointRuns.length,
			outliers: pointRuns.filter((run) => run.ratio < 0.5 || run.ratio > 1.5),
		}));
	const progressionEras = [
		{ id: "copper_orders", label: "Copper" },
		{ id: "steelsmithing", label: "Steel" },
		{ id: "goldsmithing", label: "Gold" },
		{ id: "mithrilsmithing", label: "Mithril" },
		{ id: "prestige", label: "Prestige" },
	]
		.map((era) => ({
			...era,
			purchasedUpgradePoints: Math.min(
				...progressionRuns
					.filter((run) => run.upgradePoints[era.id] > 0)
					.map((run) => run.purchasedUpgradePoints),
			),
		}))
		.filter((era) => Number.isFinite(era.purchasedUpgradePoints))
		.map(({ label, purchasedUpgradePoints }) => ({
			label,
			purchasedUpgradePoints,
		}));

	const averageRunsToPrestige = completedPrestigeRuns.length
		? completedPrestigeRuns.reduce((sum, journey) => sum + journey.runs, 0) /
			completedPrestigeRuns.length
		: null;
	const averageForgeMinutesToPrestige = completedPrestigeRuns.length
		? completedPrestigeRuns.reduce((sum, journey) => sum + journey.seconds, 0) /
			completedPrestigeRuns.length /
			60
		: null;

	return {
		activePlayers,
		acceptedConsent,
		declinedConsent,
		runs,
		totalMarbles: totalMarbles.toString(),
		demosCompleted,
		averageRunsToPrestige,
		averageForgeMinutesToPrestige,
		mostUsedHammers,
		playtimeMinutes,
		excludedSessions,
		progressionGraph,
		progressionEras,
	};
}

export async function loadTelemetryReport(
	start: Date,
	end: Date,
): Promise<TelemetryReport> {
	const events = await db
		.select({
			id: schema.telemetryEvents.id,
			installId: schema.telemetryEvents.installId,
			name: schema.telemetryEvents.name,
			consentChoice: schema.telemetryEvents.consentChoice,
			hammer: schema.telemetryEvents.hammer,
			marblesEarned: schema.telemetryEvents.marblesEarned,
			purchasedUpgradePoints: schema.telemetryEvents.purchasedUpgradePoints,
			upgradePoints: schema.telemetryEvents.upgradePoints,
			availableUpgrades: schema.telemetryEvents.availableUpgrades,
			cheapestAvailableUpgradeCost:
				schema.telemetryEvents.cheapestAvailableUpgradeCost,
			startingMarbleBalance: schema.telemetryEvents.startingMarbleBalance,
			durationSeconds: schema.telemetryEvents.durationSeconds,
			runDurationSeconds: schema.telemetryEvents.runDurationSeconds,
			goodStrikes: schema.telemetryEvents.goodStrikes,
			badStrikes: schema.telemetryEvents.badStrikes,
			swordsFixed: schema.telemetryEvents.swordsFixed,
			swordsBroken: schema.telemetryEvents.swordsBroken,
			peakPayoutMultiplier: schema.telemetryEvents.peakPayoutMultiplier,
			averagePayoutMultiplier: schema.telemetryEvents.averagePayoutMultiplier,
			upgradeValueEarned: schema.telemetryEvents.upgradeValueEarned,
		})
		.from(schema.telemetryEvents)
		.where(
			and(
				gte(schema.telemetryEvents.receivedAt, start),
				lt(schema.telemetryEvents.receivedAt, end),
			),
		)
		.orderBy(asc(schema.telemetryEvents.id));

	return summarizeTelemetry(events);
}

const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

const HAMMER_NAMES: Record<TelemetryHammer, string> = {
	pennyroyal: "Pennyroyal",
	crescendo: "Crescendo",
	hex: "Hex",
	wildfire: "Wildfire",
	coup_de_grace: "Coup de Grâce",
	singularity: "Singularity",
};

function formatReportRange(start: Date, end: Date): string {
	const lastDay = new Date(end);
	lastDay.setUTCDate(lastDay.getUTCDate() - 1);
	const sameYear = start.getUTCFullYear() === lastDay.getUTCFullYear();
	const sameMonth = sameYear && start.getUTCMonth() === lastDay.getUTCMonth();
	if (sameMonth) {
		return `${start.getUTCDate()}–${lastDay.getUTCDate()} ${MONTHS[start.getUTCMonth()]} ${start.getUTCFullYear()}`;
	}
	if (sameYear) {
		return `${start.getUTCDate()} ${MONTHS[start.getUTCMonth()]}–${lastDay.getUTCDate()} ${MONTHS[lastDay.getUTCMonth()]} ${start.getUTCFullYear()}`;
	}
	return `${start.getUTCDate()} ${MONTHS[start.getUTCMonth()]} ${start.getUTCFullYear()}–${lastDay.getUTCDate()} ${MONTHS[lastDay.getUTCMonth()]} ${lastDay.getUTCFullYear()}`;
}

function formatFavoriteHammers(hammers: TelemetryHammer[]): string {
	if (hammers.length === 0) return "No favorite yet";
	return hammers.map((hammer) => HAMMER_NAMES[hammer]).join(" & ");
}

export function telemetryReportEmbed(
	report: TelemetryReport,
	start: Date,
	end: Date,
): Record<string, unknown> {
	return {
		title: "Hammerbound telemetry report",
		color: 0xfb6b1d,
		description: formatReportRange(start, end),
		fields: [
			{ name: "👥 Players", value: String(report.activePlayers), inline: true },
			{
				name: "🙋 Consent",
				value: `${report.acceptedConsent} accepted · ${report.declinedConsent} declined`,
				inline: true,
			},
			{ name: "⚒️ Runs forged", value: String(report.runs), inline: true },
			{
				name: "🔴 Marbles earned",
				value: BigInt(report.totalMarbles).toLocaleString("en-US"),
				inline: true,
			},
			{
				name: "🏁 Demos finished",
				value: String(report.demosCompleted),
				inline: true,
			},
			{
				name: "⏱️ First prestige",
				value:
					report.averageRunsToPrestige === null ||
					report.averageForgeMinutesToPrestige === null
						? "No measured completions"
						: `${report.averageRunsToPrestige.toFixed(1)} runs · ${report.averageForgeMinutesToPrestige.toFixed(1)} forge minutes`,
				inline: true,
			},
			{
				name: "💖 Favorite hammer",
				value: formatFavoriteHammers(report.mostUsedHammers),
				inline: true,
			},
			{
				name: "⏱️ Playtime",
				value: `${Math.floor(report.playtimeMinutes / 60)}h ${report.playtimeMinutes % 60}m`,
				inline: true,
			},
		],
		...(report.excludedSessions > 0
			? {
					footer: {
						text: `🧹 ${report.excludedSessions} suspicious ${report.excludedSessions === 1 ? "session" : "sessions"} excluded`,
					},
				}
			: {}),
	};
}
