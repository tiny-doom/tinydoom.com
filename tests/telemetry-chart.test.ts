import { expect, test } from "bun:test";
import { renderProgressionChart } from "../src/lib/telemetry-chart";

 test("renders progression data as a PNG", async () => {
	const png = await renderProgressionChart([
		{
			purchasedUpgradePoints: 4,
			runs: 2,
			averageRatio: 0.8,
			outliers: [],
		},
		{
			purchasedUpgradePoints: 8,
			runs: 1,
			averageRatio: 1.9,
			outliers: [],
		},
	]);

	expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
});
