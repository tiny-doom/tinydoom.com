import { expect, test } from "bun:test";
import { GET } from "../src/app/api/cron/telemetry-weekly/route";

test("weekly telemetry cron rejects requests without its bearer secret", async () => {
	const previousSecret = process.env.CRON_SECRET;
	process.env.CRON_SECRET = "test-secret";
	try {
		const response = await GET(
			new Request("https://tinydoom.com/api/cron/telemetry-weekly"),
		);
		expect(response.status).toBe(401);
	} finally {
		if (previousSecret === undefined) {
			delete process.env.CRON_SECRET;
		} else {
			process.env.CRON_SECRET = previousSecret;
		}
	}
});
