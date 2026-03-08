/**
 * Smart rate limiter with abuse detection.
 *
 * Legitimate users: accepted freely as long as behavior looks human.
 * Abusers detected by:
 *   - Burst speed: 3+ requests within 10 seconds
 *   - Duplicate content: same message sent more than once
 *   - Sustained volume: 50+ requests in an hour regardless
 *
 * Penalties escalate: warning → throttle → 24h ban
 */

interface RequestRecord {
	timestamp: number;
	contentHash: string;
}

interface IPState {
	requests: RequestRecord[];
	strikes: number;
	hourStart: number;
	hourCount: number;
}

const BURST_WINDOW_MS = 10 * 1000; // 10 seconds
const BURST_THRESHOLD = 3;
const HOUR_MS = 60 * 60 * 1000;
const HOUR_VOLUME_LIMIT = 50;
const BAN_DURATION_MS = 24 * 60 * 60 * 1000;
const STRIKES_TO_BAN = 3;
const HISTORY_WINDOW_MS = 15 * 60 * 1000; // keep 15 min of history

const ipStates = new Map<string, IPState>();
const bannedIPs = new Map<string, number>();

const CLEANUP_INTERVAL = 10 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
	const now = Date.now();
	if (now - lastCleanup < CLEANUP_INTERVAL) return;
	lastCleanup = now;

	for (const [ip, expiry] of bannedIPs) {
		if (now > expiry) bannedIPs.delete(ip);
	}
	for (const [ip, state] of ipStates) {
		if (
			state.requests.length === 0 ||
			now - state.requests[state.requests.length - 1].timestamp >
				HISTORY_WINDOW_MS
		) {
			ipStates.delete(ip);
		}
	}
}

function simpleHash(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = (hash << 5) - hash + str.charCodeAt(i);
		hash |= 0;
	}
	return hash.toString(36);
}

export type RateLimitResult =
	| { allowed: true }
	| { allowed: false; banned: boolean; retryAfterSeconds: number };

export function checkRateLimit(ip: string, content?: string): RateLimitResult {
	cleanup();
	const now = Date.now();

	// Check ban list
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

	let state = ipStates.get(ip);
	if (!state) {
		state = { requests: [], strikes: 0, hourStart: now, hourCount: 0 };
		ipStates.set(ip, state);
	}

	// Reset hourly counter
	if (now - state.hourStart > HOUR_MS) {
		state.hourCount = 0;
		state.hourStart = now;
	}

	// Prune old requests
	state.requests = state.requests.filter(
		(r) => now - r.timestamp < HISTORY_WINDOW_MS,
	);

	const contentHash = content ? simpleHash(content) : "";
	state.hourCount++;

	// Detection 1: Burst speed
	const recentRequests = state.requests.filter(
		(r) => now - r.timestamp < BURST_WINDOW_MS,
	);
	if (recentRequests.length >= BURST_THRESHOLD) {
		state.strikes++;
		if (state.strikes >= STRIKES_TO_BAN) {
			return banIP(ip, now);
		}
		return {
			allowed: false,
			banned: false,
			retryAfterSeconds: Math.ceil(BURST_WINDOW_MS / 1000),
		};
	}

	// Detection 2: Duplicate content
	if (
		contentHash &&
		state.requests.some((r) => r.contentHash === contentHash)
	) {
		state.strikes++;
		if (state.strikes >= STRIKES_TO_BAN) {
			return banIP(ip, now);
		}
		return {
			allowed: false,
			banned: false,
			retryAfterSeconds: 60,
		};
	}

	// Detection 3: Sustained volume
	if (state.hourCount > HOUR_VOLUME_LIMIT) {
		return banIP(ip, now);
	}

	state.requests.push({ timestamp: now, contentHash });
	return { allowed: true };
}

function banIP(ip: string, now: number): RateLimitResult {
	const banUntil = now + BAN_DURATION_MS;
	bannedIPs.set(ip, banUntil);
	ipStates.delete(ip);
	return {
		allowed: false,
		banned: true,
		retryAfterSeconds: Math.ceil(BAN_DURATION_MS / 1000),
	};
}
