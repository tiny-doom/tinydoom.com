import { beforeEach, describe, expect, test } from "bun:test";

let checkRateLimit: typeof import("@/lib/rate-limit").checkRateLimit;

beforeEach(async () => {
	const resolvedPath = require.resolve("../src/lib/rate-limit");
	delete require.cache[resolvedPath];
	const mod = await import("../src/lib/rate-limit");
	checkRateLimit = mod.checkRateLimit;
});

describe("rate limiter", () => {
	test("allows first request", () => {
		expect(checkRateLimit("1.2.3.4", "hello").allowed).toBe(true);
	});

	test("allows requests under burst threshold with unique content", () => {
		expect(checkRateLimit("1.2.3.4", "first message").allowed).toBe(true);
		expect(checkRateLimit("1.2.3.4", "second message").allowed).toBe(true);
	});

	test("blocks duplicate content", () => {
		expect(checkRateLimit("1.2.3.4", "same message").allowed).toBe(true);
		const result = checkRateLimit("1.2.3.4", "same message");
		expect(result.allowed).toBe(false);
		if (!result.allowed) {
			expect(result.banned).toBe(false);
		}
	});

	test("blocks burst of rapid requests", () => {
		checkRateLimit("1.2.3.4", "msg1");
		checkRateLimit("1.2.3.4", "msg2");
		checkRateLimit("1.2.3.4", "msg3");
		// 4th request within the burst window should be blocked
		const result = checkRateLimit("1.2.3.4", "msg4");
		expect(result.allowed).toBe(false);
		if (!result.allowed) {
			expect(result.banned).toBe(false);
		}
	});

	test("different IPs are independent", () => {
		checkRateLimit("1.1.1.1", "same message");
		const dup = checkRateLimit("1.1.1.1", "same message");
		expect(dup.allowed).toBe(false);

		// Different IP with same content is fine
		expect(checkRateLimit("2.2.2.2", "same message").allowed).toBe(true);
	});

	test("bans after repeated violations (3 strikes)", () => {
		// Strike 1: duplicate
		checkRateLimit("abuser", "dup");
		checkRateLimit("abuser", "dup");
		// Strike 2: another duplicate
		checkRateLimit("abuser", "dup2");
		checkRateLimit("abuser", "dup2");
		// Strike 3: another duplicate -> ban
		checkRateLimit("abuser", "dup3");
		const result = checkRateLimit("abuser", "dup3");
		expect(result.allowed).toBe(false);
		if (!result.allowed) {
			expect(result.banned).toBe(true);
			expect(result.retryAfterSeconds).toBeGreaterThan(60 * 60);
		}
	});

	test("banned IP stays banned", () => {
		// Get banned via strikes
		checkRateLimit("bad-actor", "a");
		checkRateLimit("bad-actor", "a");
		checkRateLimit("bad-actor", "b");
		checkRateLimit("bad-actor", "b");
		checkRateLimit("bad-actor", "c");
		checkRateLimit("bad-actor", "c");

		const result = checkRateLimit("bad-actor", "new unique message");
		expect(result.allowed).toBe(false);
		if (!result.allowed) {
			expect(result.banned).toBe(true);
		}
	});

	test("bans after sustained volume regardless of content", () => {
		for (let i = 0; i < 31; i++) {
			checkRateLimit("spammer", `unique message number ${i}`);
		}
		const result = checkRateLimit("spammer", "one more");
		expect(result.allowed).toBe(false);
		if (!result.allowed) {
			expect(result.banned).toBe(true);
		}
	});
});
