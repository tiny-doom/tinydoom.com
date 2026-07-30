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

function FlyingSaucer({ saucer }: { saucer: SaucerDefinition }) {
	const ref = useRef<HTMLSpanElement>(null);

	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		element.style.setProperty(
			"--flight-duration",
			`${randomBetween(36, 58).toFixed(2)}s`,
		);
		element.style.setProperty(
			"--flight-rise",
			`${randomBetween(-18, 18).toFixed(2)}px`,
		);
	}, []);

	return (
		<span
			ref={ref}
			className={`flying-saucer flying-saucer-${saucer.direction}`}
			style={{
				top: `${saucer.top}%`,
				animationDelay: `${saucer.initialDelay}s`,
			}}
		>
			<span className={`flying-saucer-sprite saucer-${saucer.color}`} />
		</span>
	);
}

export function SaucerField() {
	return (
		<div className="saucer-field" aria-hidden="true">
			{SAUCERS.map((saucer) => (
				<FlyingSaucer
					key={`${saucer.top}-${saucer.direction}`}
					saucer={saucer}
				/>
			))}
		</div>
	);
}
