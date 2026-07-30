import { NextResponse } from "next/server";
import { postTelemetryReportMessage } from "@/lib/discord";
import {
	loadTelemetryReport,
	previousUtcWeek,
	type TelemetryReport,
	telemetryReportEmbed,
} from "@/lib/telemetry-report";

export async function GET(request: Request) {
	const secret = process.env.CRON_SECRET;
	if (!secret) {
		return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
	}
	if (request.headers.get("authorization") !== `Bearer ${secret}`) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	const { start, end } = previousUtcWeek();
	let report: TelemetryReport;
	try {
		report = await loadTelemetryReport(start, end);
	} catch (error) {
		console.error("Telemetry report query failed:", error);
		return NextResponse.json(
			{ error: "temporarily_unavailable" },
			{ status: 503 },
		);
	}

	try {
		await postTelemetryReportMessage(telemetryReportEmbed(report, start, end));
	} catch (error) {
		console.error("Telemetry report Discord post failed:", error);
		return NextResponse.json({ error: "discord_failed" }, { status: 502 });
	}

	return NextResponse.json({ start, end, report });
}
