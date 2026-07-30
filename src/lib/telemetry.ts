export const MAX_TELEMETRY_BODY_BYTES = 16 * 1024;
export const MAX_TELEMETRY_EVENTS = 20;
export const MAX_MARBLES_EARNED = Number.MAX_SAFE_INTEGER;

export const TELEMETRY_EVENT_NAMES = [
	"telemetry_consent",
	"session_started",
	"session_heartbeat",
	"session_ended",
	"hammer_selected",
	"run_started",
	"run_ended",
	"upgrade_purchased",
	"demo_completed",
] as const;

export const TELEMETRY_HAMMERS = [
	"pennyroyal",
	"crescendo",
	"hex",
	"wildfire",
	"coup_de_grace",
	"singularity",
] as const;

export const TELEMETRY_PLATFORMS = ["Windows", "macOS", "Linux"] as const;

export type TelemetryEventName = (typeof TELEMETRY_EVENT_NAMES)[number];
export type TelemetryHammer = (typeof TELEMETRY_HAMMERS)[number];
export type TelemetryPlatform = (typeof TELEMETRY_PLATFORMS)[number];
export type TelemetryConsentChoice = "accepted" | "declined";

export interface TelemetryEvent {
	name: TelemetryEventName;
	properties: {
		choice?: TelemetryConsentChoice;
		hammer?: TelemetryHammer;
		outcome?: "finished";
		marbles_earned?: number;
		upgrade_id?: string;
	};
}

export interface TelemetryPayload {
	game: "Hammerbound";
	version: string;
	platform: TelemetryPlatform;
	install_id?: string;
	events: TelemetryEvent[];
}

export type TelemetryValidationResult =
	| { valid: true; data: TelemetryPayload }
	| { valid: false };

const VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z.+-]{0,31}$/;
const INSTALL_ID_PATTERN = /^[0-9a-f]{32}$/;
const UPGRADE_ID_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const HAMMERS = new Set<string>(TELEMETRY_HAMMERS);
const PLATFORMS = new Set<string>(TELEMETRY_PLATFORMS);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
	record: Record<string, unknown>,
	keys: string[],
): boolean {
	const actual = Object.keys(record).sort();
	const expected = [...keys].sort();
	return (
		actual.length === expected.length &&
		actual.every((key, index) => key === expected[index])
	);
}

function validateEvent(value: unknown): TelemetryEvent | null {
	if (!isRecord(value) || !hasExactKeys(value, ["name", "properties"])) {
		return null;
	}
	if (typeof value.name !== "string" || !isRecord(value.properties)) {
		return null;
	}

	const properties = value.properties;
	switch (value.name) {
		case "telemetry_consent":
			if (
				!hasExactKeys(properties, ["choice"]) ||
				(properties.choice !== "accepted" && properties.choice !== "declined")
			) {
				return null;
			}
			break;
		case "session_started":
		case "session_heartbeat":
		case "session_ended":
		case "demo_completed":
			if (!hasExactKeys(properties, [])) return null;
			break;
		case "hammer_selected":
		case "run_started":
			if (
				!hasExactKeys(properties, ["hammer"]) ||
				typeof properties.hammer !== "string" ||
				!HAMMERS.has(properties.hammer)
			) {
				return null;
			}
			break;
		case "run_ended":
			if (
				!hasExactKeys(properties, ["hammer", "marbles_earned", "outcome"]) ||
				typeof properties.hammer !== "string" ||
				!HAMMERS.has(properties.hammer) ||
				properties.outcome !== "finished" ||
				typeof properties.marbles_earned !== "number" ||
				!Number.isSafeInteger(properties.marbles_earned) ||
				properties.marbles_earned < 0 ||
				properties.marbles_earned > MAX_MARBLES_EARNED
			) {
				return null;
			}
			break;
		case "upgrade_purchased":
			if (
				!hasExactKeys(properties, ["upgrade_id"]) ||
				typeof properties.upgrade_id !== "string" ||
				!UPGRADE_ID_PATTERN.test(properties.upgrade_id)
			) {
				return null;
			}
			break;
		default:
			return null;
	}

	return {
		name: value.name as TelemetryEventName,
		properties: properties as TelemetryEvent["properties"],
	};
}

export function validateTelemetryPayload(
	value: unknown,
): TelemetryValidationResult {
	if (!isRecord(value)) return { valid: false };

	const allowedKeys =
		value.install_id === undefined
			? ["events", "game", "platform", "version"]
			: ["events", "game", "install_id", "platform", "version"];
	if (!hasExactKeys(value, allowedKeys)) return { valid: false };
	if (
		value.game !== "Hammerbound" ||
		typeof value.platform !== "string" ||
		!PLATFORMS.has(value.platform) ||
		typeof value.version !== "string" ||
		!VERSION_PATTERN.test(value.version) ||
		!Array.isArray(value.events) ||
		value.events.length < 1 ||
		value.events.length > MAX_TELEMETRY_EVENTS
	) {
		return { valid: false };
	}

	const events: TelemetryEvent[] = [];
	for (const valueEvent of value.events) {
		const event = validateEvent(valueEvent);
		if (!event) return { valid: false };
		events.push(event);
	}

	const hasDecline = events.some(
		(event) =>
			event.name === "telemetry_consent" &&
			event.properties.choice === "declined",
	);
	const anonymousDecline =
		events.length === 1 &&
		events[0].name === "telemetry_consent" &&
		events[0].properties.choice === "declined";
	if (hasDecline && !anonymousDecline) return { valid: false };
	if (anonymousDecline) {
		if (value.install_id !== undefined) return { valid: false };
	} else if (
		typeof value.install_id !== "string" ||
		!INSTALL_ID_PATTERN.test(value.install_id)
	) {
		return { valid: false };
	}

	return {
		valid: true,
		data: {
			game: "Hammerbound",
			version: value.version,
			platform: value.platform as TelemetryPlatform,
			...(typeof value.install_id === "string"
				? { install_id: value.install_id }
				: {}),
			events,
		},
	};
}
