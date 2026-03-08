/**
 * Smart rate limiter with abuse detection.
 *
 * Legitimate users: accepted freely as long as behavior looks human.
 * Abusers detected by:
 *   - Burst speed: 3+ requests within 10 seconds
 *   - Duplicate content: same message sent 3+ times
 *   - Sustained volume: 50+ requests in an hour regardless
 *
 * Penalties escalate: warning → throttle → 24h ban (3 strikes) → permaban (5 strikes)
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
const STRIKES_TO_TEMP_BAN = 3;
const STRIKES_TO_PERMA_BAN = 5;
const HISTORY_WINDOW_MS = 15 * 60 * 1000; // keep 15 min of history

const ipStates = new Map<string, IPState>();
const bannedIPs = new Map<string, number>(); // IP -> ban expiry
const permabanIPs = new Set<string>();

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
	| {
			allowed: false;
			banned: boolean;
			permaban: boolean;
			retryAfterSeconds: number;
	  };

export function checkRateLimit(ip: string, content?: string): RateLimitResult {
	cleanup();
	const now = Date.now();

	// Check permaban list
	if (permabanIPs.has(ip)) {
		return {
			allowed: false,
			banned: true,
			permaban: true,
			retryAfterSeconds: Math.ceil(BAN_DURATION_MS / 1000),
		};
	}

	// Check temp ban list — still increment strikes if they keep trying
	const banExpiry = bannedIPs.get(ip);
	if (banExpiry !== undefined) {
		if (now < banExpiry) {
			const state = ipStates.get(ip);
			if (state) {
				state.strikes++;
				if (state.strikes >= STRIKES_TO_PERMA_BAN) {
					permabanIPs.add(ip);
					bannedIPs.delete(ip);
					ipStates.delete(ip);
					return {
						allowed: false,
						banned: true,
						permaban: true,
						retryAfterSeconds: Math.ceil(BAN_DURATION_MS / 1000),
					};
				}
			}
			return {
				allowed: false,
				banned: true,
				permaban: false,
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
		return strikeResult(ip, state, now, Math.ceil(BURST_WINDOW_MS / 1000));
	}

	// Detection 2: Duplicate content (3+ identical messages)
	const duplicateCount = contentHash
		? state.requests.filter((r) => r.contentHash === contentHash).length
		: 0;
	if (duplicateCount >= 2) {
		state.strikes++;
		return strikeResult(ip, state, now, 60);
	}

	// Detection 3: Sustained volume
	if (state.hourCount > HOUR_VOLUME_LIMIT) {
		state.strikes = STRIKES_TO_PERMA_BAN;
		return strikeResult(ip, state, now, 0);
	}

	state.requests.push({ timestamp: now, contentHash });
	return { allowed: true };
}

function strikeResult(
	ip: string,
	state: IPState,
	now: number,
	retryAfterSeconds: number,
): RateLimitResult {
	if (state.strikes >= STRIKES_TO_PERMA_BAN) {
		permabanIPs.add(ip);
		bannedIPs.delete(ip);
		ipStates.delete(ip);
		return {
			allowed: false,
			banned: true,
			permaban: true,
			retryAfterSeconds: Math.ceil(BAN_DURATION_MS / 1000),
		};
	}
	if (state.strikes >= STRIKES_TO_TEMP_BAN) {
		const banUntil = now + BAN_DURATION_MS;
		bannedIPs.set(ip, banUntil);
		// Keep state so strikes persist through temp ban
		return {
			allowed: false,
			banned: true,
			permaban: false,
			retryAfterSeconds: Math.ceil(BAN_DURATION_MS / 1000),
		};
	}
	return {
		allowed: false,
		banned: false,
		permaban: false,
		retryAfterSeconds,
	};
}
