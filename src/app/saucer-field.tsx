"use client";

import { useEffect, useRef } from "react";

interface SaucerDefinition {
	top: number;
	color: "blue" | "pink";
	direction: "right" | "left";
	initialDelay: number;
}

const SAUCERS: SaucerDefinition[] = [
	{ top: 16, color: "blue", direction: "right", initialDelay: 4 },
	{ top: 53, color: "pink", direction: "left", initialDelay: 19 },
	{ top: 82, color: "blue", direction: "right", initialDelay: 31 },
];

function randomBetween(min: number, max: number): number {
	return min + Math.random() * (max - min);
}

function loopDeLoop(
	sprite: HTMLElement,
	direction: "right" | "left",
	duration: number,
): Animation {
	const horizontalDirection = direction === "right" ? 1 : -1;
	const rotationDirection = -horizontalDirection;
	return sprite.animate(
		[
			{ transform: "translate(0, 0) rotate(0deg)" },
			{
				transform: `translate(${14 * horizontalDirection}px, -6px) rotate(${45 * rotationDirection}deg)`,
			},
			{
				transform: `translate(${20 * horizontalDirection}px, -20px) rotate(${90 * rotationDirection}deg)`,
			},
			{
				transform: `translate(${14 * horizontalDirection}px, -34px) rotate(${135 * rotationDirection}deg)`,
			},
			{
				transform: `translate(0, -40px) rotate(${180 * rotationDirection}deg)`,
			},
			{
				transform: `translate(${-14 * horizontalDirection}px, -34px) rotate(${225 * rotationDirection}deg)`,
			},
			{
				transform: `translate(${-20 * horizontalDirection}px, -20px) rotate(${270 * rotationDirection}deg)`,
			},
			{
				transform: `translate(${-14 * horizontalDirection}px, -6px) rotate(${315 * rotationDirection}deg)`,
			},
			{
				transform: `translate(0, 0) rotate(${360 * rotationDirection}deg)`,
			},
		],
		{ duration, easing: "linear" },
	);
}

function FlyingSaucer({ saucer }: { saucer: SaucerDefinition }) {
	const ref = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		const element = ref.current;
		const sprite = element?.querySelector<HTMLElement>(".flying-saucer-sprite");
		if (!element || !sprite) return;

		const duration = randomBetween(36, 58);
		element.style.setProperty("--flight-duration", `${duration.toFixed(2)}s`);
		element.style.setProperty(
			"--flight-rise",
			`${randomBetween(-18, 18).toFixed(2)}px`,
		);

		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

		let loopAnimation: Animation | undefined;
		let loopStartTimer: number | undefined;
		const maybeLoop = () => {
			if (Math.random() < 0.28) {
				loopStartTimer = window.setTimeout(() => {
					loopAnimation = loopDeLoop(sprite, saucer.direction, 1200);
				}, duration * 120);
			}
		};

		let loopTimer: number;
		const scheduleLoop = () => {
			maybeLoop();
			loopTimer = window.setTimeout(scheduleLoop, duration * 1000);
		};
		loopTimer = window.setTimeout(scheduleLoop, saucer.initialDelay * 1000);

		return () => {
			window.clearTimeout(loopTimer);
			if (loopStartTimer !== undefined) window.clearTimeout(loopStartTimer);
			loopAnimation?.cancel();
		};
	}, [saucer.direction, saucer.initialDelay]);

	function handleClick() {
		const sprite = ref.current?.querySelector<HTMLElement>(
			".flying-saucer-sprite",
		);
		if (sprite) loopDeLoop(sprite, saucer.direction, 700);
	}

	return (
		<button
			type="button"
			ref={ref}
			className={`flying-saucer flying-saucer-${saucer.direction}`}
			onClick={handleClick}
			tabIndex={-1}
			aria-label="Make flying saucer loop"
			style={{
				top: `${saucer.top}%`,
				animationDelay: `${saucer.initialDelay}s`,
			}}
		>
			<span className={`flying-saucer-sprite saucer-${saucer.color}`} />
		</button>
	);
}

export function SaucerField() {
	return (
		<div className="saucer-field">
			{SAUCERS.map((saucer) => (
				<FlyingSaucer
					key={`${saucer.top}-${saucer.direction}`}
					saucer={saucer}
				/>
			))}
		</div>
	);
}
