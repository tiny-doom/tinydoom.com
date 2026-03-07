import { afterEach, beforeEach, describe, expect, test, vi } from "bun:test";

// We need to re-import fresh each test to reset the in-memory state
let checkRateLimit: typeof import("@/lib/rate-limit").checkRateLimit;

beforeEach(async () => {
	// Dynamic import to get fresh module state — clear the module cache first
	const resolvedPath = require.resolve("../src/lib/rate-limit");
	delete require.cache[resolvedPath];
	const mod = await import("../src/lib/rate-limit");
	checkRateLimit = mod.checkRateLimit;
});

describe("rate limiter", () => {
	test("allows first request", () => {
		const result = checkRateLimit("1.2.3.4");
		expect(result.allowed).toBe(true);
	});

	test("allows up to 3 requests in a window", () => {
		expect(checkRateLimit("1.2.3.4").allowed).toBe(true);
		expect(checkRateLimit("1.2.3.4").allowed).toBe(true);
		expect(checkRateLimit("1.2.3.4").allowed).toBe(true);
	});

	test("blocks 4th request in same window", () => {
		checkRateLimit("1.2.3.4");
		checkRateLimit("1.2.3.4");
		checkRateLimit("1.2.3.4");
		const result = checkRateLimit("1.2.3.4");
		expect(result.allowed).toBe(false);
		if (!result.allowed) {
			expect(result.banned).toBe(false);
			expect(result.retryAfterSeconds).toBeGreaterThan(0);
		}
	});

	test("different IPs have independent limits", () => {
		checkRateLimit("1.1.1.1");
		checkRateLimit("1.1.1.1");
		checkRateLimit("1.1.1.1");
		// 1.1.1.1 is now at limit
		const blocked = checkRateLimit("1.1.1.1");
		expect(blocked.allowed).toBe(false);

		// 2.2.2.2 should still be fine
		const allowed = checkRateLimit("2.2.2.2");
		expect(allowed.allowed).toBe(true);
	});

	test("bans IP after exceeding hourly threshold", () => {
		// Exceed 10 total requests in an hour (even if rate-limited, they still count)
		for (let i = 0; i < 11; i++) {
			checkRateLimit("abuser");
		}
		const result = checkRateLimit("abuser");
		expect(result.allowed).toBe(false);
		if (!result.allowed) {
			expect(result.banned).toBe(true);
			// 24 hour ban
			expect(result.retryAfterSeconds).toBeGreaterThan(60 * 60);
		}
	});

	test("banned IP stays banned on subsequent requests", () => {
		// Get banned first
		for (let i = 0; i < 12; i++) {
			checkRateLimit("repeat-offender");
		}
		// Should still be banned
		const result = checkRateLimit("repeat-offender");
		expect(result.allowed).toBe(false);
		if (!result.allowed) {
			expect(result.banned).toBe(true);
		}
	});
});
