import { describe, expect, spyOn, test } from "bun:test";
import {
	createPlaytestSignupPost,
	validatePlaytestSignup,
} from "../src/app/api/playtest-signup/route";

const validSignup = {
	name: "Lovely Person",
	email: "lovely@example.com",
};

function request(body: unknown, contentType = "application/json") {
	return new Request("https://tinydoom.com/api/playtest-signup", {
		method: "POST",
		headers: {
			"Content-Type": contentType,
			"x-forwarded-for": "192.0.2.20",
		},
		body: typeof body === "string" ? body : JSON.stringify(body),
	});
}

const allow = () => ({ allowed: true }) as const;

describe("playtest signup", () => {
	test("accepts a name and email address", () => {
		expect(validatePlaytestSignup(validSignup)).toEqual({
			valid: true,
			data: {
				name: "Lovely Person",
				email: "lovely@example.com",
			},
		});
	});

	test("rejects malformed emails and extra fields", () => {
		expect(
			validatePlaytestSignup({ ...validSignup, email: "not-an-email" }).valid,
		).toBe(false);
		expect(
			validatePlaytestSignup({ ...validSignup, contact: "nope" }).valid,
		).toBe(false);
	});

	test("delivers a valid signup", async () => {
		let delivered: { name: string; email: string } | undefined;
		const post = createPlaytestSignupPost(async (signup) => {
			delivered = signup;
		}, allow);
		const response = await post(request(validSignup));

		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({ success: true });
		expect(delivered).toEqual({
			name: "Lovely Person",
			email: "lovely@example.com",
		});
	});

	test("returns contract and delivery errors", async () => {
		const post = createPlaytestSignupPost(async () => {}, allow);
		expect((await post(request("{", "application/json"))).status).toBe(400);
		expect((await post(request({}, "text/plain"))).status).toBe(415);
		expect((await post(request({}))).status).toBe(422);

		const consoleError = spyOn(console, "error").mockImplementation(() => {});
		try {
			const failingPost = createPlaytestSignupPost(async () => {
				throw new Error("Discord unavailable");
			}, allow);
			expect((await failingPost(request(validSignup))).status).toBe(503);
		} finally {
			consoleError.mockRestore();
		}
	});
});
