"use client";

import { useEffect, useRef } from "react";

type StarVariant = "large" | "small" | "twinkle";
type StarFrame = "large" | "small" | "transition";

interface StarDefinition {
	left: number;
	top: number;
	color: number;
	variant: StarVariant;
}

const STAR_SCALE = 3;
const STAR_ALPHA = [0, 1] as const;
const STAR_DURATION_SECONDS = [1.75, 4] as const;
const TWINKLE_HOLD_SECONDS = [1.5, 3.5] as const;
const TWINKLE_CHANCE = 0.95;
const TWINKLE_CROSS_MS = 1600;

const STARS: StarDefinition[] = [
	{ left: 4, top: 8, color: 5, variant: "small" },
	{ left: 12, top: 22, color: 3, variant: "small" },
	{ left: 7, top: 47, color: 2, variant: "large" },
	{ left: 16, top: 74, color: 0, variant: "small" },
	{ left: 3, top: 91, color: 3, variant: "twinkle" },
	{ left: 25, top: 6, color: 2, variant: "small" },
	{ left: 38, top: 14, color: 5, variant: "small" },
	{ left: 53, top: 5, color: 0, variant: "large" },
	{ left: 67, top: 12, color: 3, variant: "small" },
	{ left: 82, top: 7, color: 5, variant: "twinkle" },
	{ left: 95, top: 18, color: 2, variant: "small" },
	{ left: 89, top: 35, color: 3, variant: "large" },
	{ left: 97, top: 54, color: 0, variant: "small" },
	{ left: 91, top: 73, color: 5, variant: "small" },
	{ left: 96, top: 91, color: 3, variant: "twinkle" },
	{ left: 78, top: 86, color: 2, variant: "small" },
	{ left: 64, top: 95, color: 5, variant: "large" },
	{ left: 48, top: 89, color: 3, variant: "small" },
	{ left: 32, top: 96, color: 0, variant: "small" },
	{ left: 20, top: 87, color: 5, variant: "small" },
	{ left: 28, top: 38, color: 2, variant: "small" },
	{ left: 73, top: 31, color: 3, variant: "small" },
	{ left: 22, top: 61, color: 0, variant: "twinkle" },
	{ left: 81, top: 62, color: 5, variant: "small" },
];

const FRAME_RECTS: Record<StarFrame, (color: number) => number[]> = {
	large: (color) => [color * 6, 0, 6, 6],
	small: (color) => [color * 3, 6, 3, 3],
	transition: (color) => [color * 4, 9, 4, 4],
};

function randomBetween(min: number, max: number): number {
	return min + Math.random() * (max - min);
}

function VoidStar({ star }: { star: StarDefinition }) {
	const outerRef = useRef<HTMLSpanElement>(null);
	const frameRef = useRef<HTMLSpanElement>(null);

	useEffect(() => {
		const outer = outerRef.current;
		const frame = frameRef.current;
		if (!outer || !frame) return;

		let stopped = false;
		const timeouts = new Set<ReturnType<typeof setTimeout>>();
		const later = (callback: () => void, milliseconds: number) => {
			const timeout = setTimeout(() => {
				timeouts.delete(timeout);
				if (!stopped) callback();
			}, milliseconds);
			timeouts.add(timeout);
		};
		const applyFrame = (name: StarFrame) => {
			const [x, y, width, height] = FRAME_RECTS[name](star.color);
			frame.style.width = `${width * STAR_SCALE}px`;
			frame.style.height = `${height * STAR_SCALE}px`;
			frame.style.backgroundSize = `${48 * STAR_SCALE}px ${13 * STAR_SCALE}px`;
			frame.style.backgroundPosition = `${-x * STAR_SCALE}px ${-y * STAR_SCALE}px`;
		};

		const restingFrame = star.variant === "small" ? "small" : "large";
		applyFrame(restingFrame);
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			outer.style.opacity = "0.7";
			return;
		}

		const driftDuration = randomBetween(8, 13);
		outer.style.setProperty("--drift-duration", `${driftDuration}s`);
		outer.style.setProperty(
			"--drift-delay",
			`${-randomBetween(0, driftDuration)}s`,
		);
		outer.style.setProperty(
			"--drift-distance",
			`${randomBetween(2, 5).toFixed(2)}px`,
		);
		outer.style.setProperty(
			"--drift-rotation",
			`${randomBetween(0.75, 2).toFixed(2)}deg`,
		);
		outer.style.animationDirection =
			Math.random() < 0.5 ? "alternate" : "alternate-reverse";

		const wander = () => {
			const duration = randomBetween(...STAR_DURATION_SECONDS);
			outer.style.transitionDuration = `${duration}s`;
			outer.style.opacity = String(randomBetween(...STAR_ALPHA));
			later(wander, duration * 1000);
		};
		later(wander, 20);

		if (star.variant === "twinkle") {
			let restingLarge = Math.random() < 0.5;
			applyFrame(restingLarge ? "large" : "small");

			const scheduleHold = () => {
				later(
					() => {
						if (Math.random() >= TWINKLE_CHANCE) {
							scheduleHold();
							return;
						}

						const target: StarFrame = restingLarge ? "small" : "large";
						applyFrame("transition");
						frame.classList.remove("void-star-twinkling");
						void frame.offsetWidth;
						frame.classList.add("void-star-twinkling");
						later(() => applyFrame(target), TWINKLE_CROSS_MS / 2);
						later(() => {
							frame.classList.remove("void-star-twinkling");
							restingLarge = !restingLarge;
							scheduleHold();
						}, TWINKLE_CROSS_MS);
					},
					randomBetween(...TWINKLE_HOLD_SECONDS) * 1000,
				);
			};
			scheduleHold();
		}

		return () => {
			stopped = true;
			for (const timeout of timeouts) clearTimeout(timeout);
		};
	}, [star]);

	return (
		<span
			ref={outerRef}
			className="void-star"
			style={{ left: `${star.left}%`, top: `${star.top}%` }}
		>
			<span ref={frameRef} className="void-star-frame" />
		</span>
	);
}

export function StarField() {
	return (
		<div className="star-field" aria-hidden="true">
			{STARS.map((star) => (
				<VoidStar key={`${star.left}-${star.top}`} star={star} />
			))}
		</div>
	);
}
