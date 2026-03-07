/**
 * Aggressive in-memory rate limiter with auto-banning.
 *
 * - 3 requests per 5 minutes per IP (very strict)
 * - After 10 total requests in an hour, IP gets banned for 24 hours
 * - Banned IPs get an immediate 403 with no further processing
 */

interface RateLimitEntry {
	timestamps: number[];
	totalInHour: number;
	hourStart: number;
}

const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_REQUESTS_PER_WINDOW = 3;
const HOUR_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_HOUR = 10;
const BAN_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

const requests = new Map<string, RateLimitEntry>();
const bannedIPs = new Map<string, number>(); // IP -> ban expiry timestamp

// Clean up stale entries every 10 minutes
const CLEANUP_INTERVAL = 10 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
	const now = Date.now();
	if (now - lastCleanup < CLEANUP_INTERVAL) return;
	lastCleanup = now;

	for (const [ip, expiry] of bannedIPs) {
		if (now > expiry) bannedIPs.delete(ip);
	}
	for (const [ip, entry] of requests) {
		if (
			entry.timestamps.length === 0 ||
			now - entry.timestamps[entry.timestamps.length - 1] > HOUR_MS
		) {
			requests.delete(ip);
		}
	}
}

export type RateLimitResult =
	| { allowed: true }
	| { allowed: false; banned: boolean; retryAfterSeconds: number };

export function checkRateLimit(ip: string): RateLimitResult {
	cleanup();
	const now = Date.now();

	// Check ban list first
	const banExpiry = bannedIPs.get(ip);
	if (banExpiry !== undefined) {
		if (now < banExpiry) {
			return {
				allowed: false,
				banned: true,
				retryAfterSeconds: Math.ceil((banExpiry - now) / 1000),
			};
		}
		bannedIPs.delete(ip);
	}

	let entry = requests.get(ip);
	if (!entry) {
		entry = { timestamps: [], totalInHour: 0, hourStart: now };
		requests.set(ip, entry);
	}

	// Reset hourly counter if hour has passed
	if (now - entry.hourStart > HOUR_MS) {
		entry.totalInHour = 0;
		entry.hourStart = now;
	}

	// Remove timestamps outside the window
	entry.timestamps = entry.timestamps.filter((t) => now - t < WINDOW_MS);

	// Check hourly abuse threshold -> ban
	entry.totalInHour++;
	if (entry.totalInHour > MAX_REQUESTS_PER_HOUR) {
		const banUntil = now + BAN_DURATION_MS;
		bannedIPs.set(ip, banUntil);
		requests.delete(ip);
		return {
			allowed: false,
			banned: true,
			retryAfterSeconds: Math.ceil(BAN_DURATION_MS / 1000),
		};
	}

	// Check sliding window
	if (entry.timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
		const oldestInWindow = entry.timestamps[0];
		const retryAfter = Math.ceil((oldestInWindow + WINDOW_MS - now) / 1000);
		return { allowed: false, banned: false, retryAfterSeconds: retryAfter };
	}

	entry.timestamps.push(now);
	return { allowed: true };
}
