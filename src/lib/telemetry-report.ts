import { and, asc, gte, lt } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type {
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
}

export interface TelemetryReport {
	acceptedConsent: number;
	declinedConsent: number;
	runs: number;
	totalMarbles: string;
	demosCompleted: number;
	mostUsedHammers: TelemetryHammer[];
	playtimeMinutes: number;
	excludedSessions: number;
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
	const hammerCounts = new Map<TelemetryHammer, number>();
	let totalMarbles = BigInt(0);
	let acceptedConsent = 0;
	let declinedConsent = 0;
	let runs = 0;
	let demosCompleted = 0;
	let playtimeMinutes = 0;

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
		}
		if (event.name === "demo_completed") demosCompleted++;
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

	return {
		acceptedConsent,
		declinedConsent,
		runs,
		totalMarbles: totalMarbles.toString(),
		demosCompleted,
		mostUsedHammers,
		playtimeMinutes,
		excludedSessions,
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

function formatMinutes(minutes: number): string {
	return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
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
) {
	return {
		title: "Hammerbound weekly report",
		color: 0xfb6b1d,
		description: formatReportRange(start, end),
		fields: [
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
				name: "💖 Favorite hammer",
				value: formatFavoriteHammers(report.mostUsedHammers),
				inline: true,
			},
			{
				name: "⏱️ Playtime",
				value: formatMinutes(report.playtimeMinutes),
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
