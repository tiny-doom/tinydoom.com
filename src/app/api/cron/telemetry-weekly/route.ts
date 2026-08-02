import { NextResponse } from "next/server";
import { postTelemetryReportMessage } from "@/lib/discord";
import { renderProgressionChart } from "@/lib/telemetry-chart";
import {
	loadTelemetryReport,
	previousUtcWeek,
	type TelemetryReport,
	telemetryReportEmbed,
} from "@/lib/telemetry-report";

type LoadReport = (start: Date, end: Date) => Promise<TelemetryReport>;
type PublishReport = (
	report: TelemetryReport,
	start: Date,
	end: Date,
) => Promise<void>;

const MAX_CUSTOM_RANGE_DAYS = 31;

export function requestedTelemetryRange(request: Request): {
	start: Date;
	end: Date;
} | null {
	const url = new URL(request.url);
	const startValue = url.searchParams.get("start");
	const endValue = url.searchParams.get("end");
	if (!startValue && !endValue) return previousUtcWeek();
	if (!startValue || !endValue) return null;
	const start = new Date(`${startValue}T00:00:00.000Z`);
	const end = new Date(`${endValue}T00:00:00.000Z`);
	if (
		Number.isNaN(start.getTime()) ||
		Number.isNaN(end.getTime()) ||
		start.toISOString().slice(0, 10) !== startValue ||
		end.toISOString().slice(0, 10) !== endValue ||
		start >= end ||
		(end.getTime() - start.getTime()) / 86_400_000 > MAX_CUSTOM_RANGE_DAYS
	) {
		return null;
	}
	return { start, end };
}

async function publishTelemetryReport(
	report: TelemetryReport,
	start: Date,
	end: Date,
): Promise<void> {
	const chart = report.progressionGraph.length
		? await renderProgressionChart(
				report.progressionGraph,
				report.progressionEras,
			)
		: undefined;
	await postTelemetryReportMessage(
		telemetryReportEmbed(report, start, end),
		chart,
	);
}

export function createTelemetryWeeklyGet(
	load: LoadReport = loadTelemetryReport,
	publish: PublishReport = publishTelemetryReport,
) {
	return async function GET(request: Request) {
		const secret = process.env.CRON_SECRET;
		if (!secret) {
			return NextResponse.json(
				{ error: "cron_not_configured" },
				{ status: 503 },
			);
		}
		if (request.headers.get("authorization") !== `Bearer ${secret}`) {
			return NextResponse.json({ error: "unauthorized" }, { status: 401 });
		}

		const range = requestedTelemetryRange(request);
		if (!range) {
			return NextResponse.json({ error: "invalid_range" }, { status: 400 });
		}
		const { start, end } = range;
		let report: TelemetryReport;
		try {
			report = await load(start, end);
		} catch (error) {
			console.error("Telemetry report query failed:", error);
			return NextResponse.json(
				{ error: "temporarily_unavailable" },
				{ status: 503 },
			);
		}

		if (report.activePlayers === 0) {
			return NextResponse.json({ start, end, report, skipped: true });
		}

		try {
			await publish(report, start, end);
		} catch (error) {
			console.error("Telemetry report Discord post failed:", error);
			return NextResponse.json({ error: "discord_failed" }, { status: 502 });
		}

		return NextResponse.json({ start, end, report, skipped: false });
	};
}

export const GET = createTelemetryWeeklyGet();
