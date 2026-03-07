export default function Home() {
	return (
		<div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-void">
			{/* Animated gloom overlay */}
			<div
				className="pointer-events-none fixed inset-0 z-0 animate-[gloom-move_12s_ease-in-out_infinite_alternate]"
				style={{
					background:
						"radial-gradient(ellipse at 50% 50%, rgba(60,0,80,0.18) 0%, rgba(0,0,0,0.7) 80%)",
				}}
			/>

			{/* Main text */}
			<div
				className="relative z-10 animate-[purple-cycle_30s_ease-in-out_infinite] -rotate-4 text-[12vw] tracking-widest"
				style={{
					textShadow: "0 2px 16px rgba(0,0,0,0.67)",
				}}
			>
				soon
			</div>
		</div>
	);
}
