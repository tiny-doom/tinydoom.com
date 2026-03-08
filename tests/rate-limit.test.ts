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

	test("allows sending same message twice, blocks on 3rd", () => {
		expect(checkRateLimit("1.2.3.4", "same").allowed).toBe(true);
		expect(checkRateLimit("1.2.3.4", "same").allowed).toBe(true);
		const result = checkRateLimit("1.2.3.4", "same");
		expect(result.allowed).toBe(false);
	});

	test("blocks burst of rapid requests", () => {
		checkRateLimit("1.2.3.4", "msg1");
		checkRateLimit("1.2.3.4", "msg2");
		checkRateLimit("1.2.3.4", "msg3");
		const result = checkRateLimit("1.2.3.4", "msg4");
		expect(result.allowed).toBe(false);
		if (!result.allowed) {
			expect(result.banned).toBe(false);
		}
	});

	test("different IPs are independent", () => {
		checkRateLimit("1.1.1.1", "msg");
		checkRateLimit("1.1.1.1", "msg");
		checkRateLimit("1.1.1.1", "msg");
		expect(checkRateLimit("1.1.1.1", "msg").allowed).toBe(false);

		expect(checkRateLimit("2.2.2.2", "msg").allowed).toBe(true);
	});

	test("3 strikes = temp ban (not permaban)", () => {
		// 3 rapid unique messages = strike 1 (burst at msg4)
		checkRateLimit("striker", "a");
		checkRateLimit("striker", "b");
		checkRateLimit("striker", "c");
		const strike1 = checkRateLimit("striker", "d");
		expect(strike1.allowed).toBe(false);
		if (!strike1.allowed) expect(strike1.banned).toBe(false);

		// Keep going — strike 2 (still trying while rate limited)
		const strike2 = checkRateLimit("striker", "e");
		expect(strike2.allowed).toBe(false);

		// Strike 3 -> temp ban
		const strike3 = checkRateLimit("striker", "f");
		expect(strike3.allowed).toBe(false);
		if (!strike3.allowed) {
			expect(strike3.banned).toBe(true);
			expect(strike3.permaban).toBe(false);
		}
	});

	test("5 strikes = permaban", () => {
		// Accumulate strikes rapidly
		for (let i = 0; i < 8; i++) {
			checkRateLimit("perma", `msg${i}`);
		}
		// Should have escalated through temp ban to permaban
		const result = checkRateLimit("perma", "final");
		expect(result.allowed).toBe(false);
		if (!result.allowed) {
			expect(result.banned).toBe(true);
			expect(result.permaban).toBe(true);
		}
	});

	test("permabanned IP stays permabanned", () => {
		for (let i = 0; i < 10; i++) {
			checkRateLimit("perma2", `msg${i}`);
		}
		const result = checkRateLimit("perma2", "new unique message");
		expect(result.allowed).toBe(false);
		if (!result.allowed) {
			expect(result.banned).toBe(true);
			expect(result.permaban).toBe(true);
		}
	});
});
