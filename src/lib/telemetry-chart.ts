import path from "node:path";
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import { Chart, type Plugin, registerables } from "chart.js";
import type {
	TelemetryEraMarker,
	TelemetryProgressionPoint,
} from "@/lib/telemetry-report";

GlobalFonts.registerFromPath(
	path.join(process.cwd(), "public/fonts/Inter-Regular.woff"),
	"Inter",
);
GlobalFonts.registerFromPath(
	path.join(process.cwd(), "public/fonts/Inter-Bold.woff"),
	"Inter",
);
Chart.register(...registerables);
Chart.defaults.font.family = "Inter";

const LOGO_PATH = path.join(process.cwd(), "public/chart/tiny-doom-logo.png");
const ERA_COLORS: Record<string, string> = {
	Copper: "#f57c00",
	Steel: "#2f80ed",
	Gold: "#f2c94c",
	Mithril: "#27ae60",
	Prestige: "#9b51e0",
};

const TARGET_MIN = 0.5;
const TARGET_MAX = 1.5;
const WIDTH = 1600;
const HEIGHT = 900;

const whiteBackground: Plugin<"scatter"> = {
	id: "white-background",
	beforeDraw(chart) {
		const { ctx, width, height } = chart;
		ctx.save();
		ctx.globalCompositeOperation = "destination-over";
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, width, height);
		ctx.restore();
	},
};

function createChartAnnotations(eras: TelemetryEraMarker[]): Plugin<"scatter"> {
	return {
		id: "upgrade-value-annotations",
		beforeDraw(chart) {
			const { ctx, chartArea, scales } = chart;
			if (!chartArea || !scales.y) return;
			const top = scales.y.getPixelForValue(TARGET_MAX);
			const bottom = scales.y.getPixelForValue(TARGET_MIN);
			ctx.save();
			ctx.fillStyle = "rgba(63, 174, 110, 0.18)";
			ctx.fillRect(
				chartArea.left,
				top,
				chartArea.right - chartArea.left,
				bottom - top,
			);
			ctx.strokeStyle = "rgba(63, 174, 110, 0.9)";
			ctx.setLineDash([8, 6]);
			for (const value of [TARGET_MIN, TARGET_MAX]) {
				const y = scales.y.getPixelForValue(value);
				ctx.beginPath();
				ctx.moveTo(chartArea.left, y);
				ctx.lineTo(chartArea.right, y);
				ctx.stroke();
			}
			ctx.restore();
		},
		afterDraw(chart) {
			const { ctx, chartArea, scales } = chart;
			if (!chartArea || !scales.x) return;
			ctx.save();
			ctx.strokeStyle = "rgba(25, 18, 25, 0.35)";
			ctx.setLineDash([4, 6]);
			for (const era of eras) {
				const x = scales.x.getPixelForValue(era.purchasedUpgradePoints);
				ctx.beginPath();
				ctx.moveTo(x, chartArea.top);
				ctx.lineTo(x, chartArea.bottom);
				ctx.stroke();
			}
			ctx.restore();
		},
	};
}

function createBranding(eras: TelemetryEraMarker[]): Plugin<"scatter"> {
	return {
		id: "upgrade-value-branding",
		afterDraw(chart) {
			const { ctx, chartArea, scales } = chart;
			if (!chartArea || !scales.x) return;
			ctx.save();
			ctx.font = "bold 22px Inter";
			ctx.textBaseline = "middle";
			const y = chartArea.top - 27;
			for (const era of eras) {
				const color = ERA_COLORS[era.label];
				if (!color) continue;
				const x = scales.x.getPixelForValue(era.purchasedUpgradePoints);
				const textWidth = ctx.measureText(era.label).width;
				const start = x - (22 + 9 + textWidth) / 2;
				ctx.beginPath();
				ctx.arc(start + 11, y, 11, 0, Math.PI * 2);
				ctx.fillStyle = color;
				ctx.fill();
				ctx.strokeStyle = "rgba(25, 18, 25, 0.22)";
				ctx.lineWidth = 1;
				ctx.stroke();
				ctx.fillStyle = "#191219";
				ctx.fillText(era.label, start + 31, y);
			}
			ctx.restore();
		},
	};
}

function createOverallAverage(average: number): Plugin<"scatter"> {
	return {
		id: "upgrade-value-overall-average",
		afterDraw(chart) {
			const { ctx, chartArea } = chart;
			if (!chartArea) return;
			ctx.save();
			ctx.fillStyle = "#191219";
			ctx.font = "bold 30px Inter";
			ctx.textAlign = "left";
			ctx.fillText(
				`Overall average: ${average.toFixed(2)}x`,
				chartArea.left + 16,
				chartArea.top + 42,
			);
			ctx.font = "22px Inter";
			ctx.textAlign = "right";
			ctx.fillText(
				"Target: 0.5–1.5x",
				chartArea.right - 16,
				chartArea.top + 38,
			);
			ctx.restore();
		},
	};
}

export async function renderProgressionChart(
	points: TelemetryProgressionPoint[],
	eras: TelemetryEraMarker[] = [],
): Promise<Buffer> {
	const canvas = createCanvas(WIDTH, HEIGHT);
	const totalRuns = points.reduce((sum, point) => sum + point.runs, 0);
	const average =
		totalRuns === 0
			? 0
			: points.reduce(
					(sum, point) => sum + point.averageRatio * point.runs,
					0,
				) / totalRuns;
	const maxRatio = Math.max(
		TARGET_MAX,
		...points.map((point) => point.averageRatio),
		0,
	);
	const maxPoints = Math.max(
		1,
		...points.map((point) => point.purchasedUpgradePoints),
		...eras.map((era) => era.purchasedUpgradePoints),
	);

	const chart = new Chart(canvas as never, {
		type: "scatter",
		data: {
			datasets: [
				{
					data: points.map((point) => ({
						x: point.purchasedUpgradePoints,
						y: point.averageRatio,
					})),
					showLine: true,
					borderColor: "#fb6b1d",
					borderWidth: 4,
					backgroundColor: points.map((point) =>
						point.averageRatio >= TARGET_MIN && point.averageRatio <= TARGET_MAX
							? "#3fae6e"
							: "#c0455a",
					),
					pointRadius: 10,
					pointHoverRadius: 10,
				},
			],
		},
		options: {
			responsive: false,
			animation: false,
			plugins: {
				title: {
					display: true,
					text: "Upgrade value by progression",
					color: "#191219",
					font: { size: 34, weight: "bold" },
					padding: { bottom: 24 },
				},
				legend: { display: false },
			},
			scales: {
				xEra: {
					type: "linear",
					position: "top",
					min: 0,
					max: maxPoints + 2,
					afterBuildTicks(axis) {
						axis.ticks = eras.map((era) => ({
							value: era.purchasedUpgradePoints,
						}));
					},
					ticks: {
						autoSkip: false,
						color: "rgba(0, 0, 0, 0)",
						font: { size: 22, weight: "bold" },
						padding: 10,
						callback(value) {
							return eras.find(
								(era) => era.purchasedUpgradePoints === Number(value),
							)?.label;
						},
					},
					grid: { drawOnChartArea: false },
					border: { display: false },
				},
				x: {
					type: "linear",
					min: 0,
					max: maxPoints + 2,
					title: {
						display: true,
						text: "Purchased upgrade points",
						color: "#191219",
						font: { size: 24 },
					},
					ticks: {
						color: "#191219",
						precision: 0,
						font: { size: 20 },
					},
					grid: { color: "rgba(25, 18, 25, 0.12)" },
				},
				y: {
					beginAtZero: true,
					max: Math.ceil(Math.max(2.5, maxRatio * 1.2) * 10) / 10,
					title: {
						display: true,
						text: "Upgrade value earned",
						color: "#191219",
						font: { size: 24 },
					},
					ticks: { color: "#191219", font: { size: 20 } },
					grid: { color: "rgba(25, 18, 25, 0.12)" },
				},
			},
		},
		plugins: [
			whiteBackground,
			createChartAnnotations(eras),
			createOverallAverage(average),
			createBranding(eras),
		],
	});

	canvas.getContext("2d").drawImage(await loadImage(LOGO_PATH), 22, 16, 72, 72);
	const png = canvas.toBuffer("image/png");
	chart.destroy();
	return png;
}
