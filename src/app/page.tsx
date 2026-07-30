"use client";

import { type FormEvent, useState } from "react";

type SubmissionStatus = "idle" | "sending" | "sent" | "error";

export default function Home() {
	const [status, setStatus] = useState<SubmissionStatus>("idle");
	const [error, setError] = useState("");

	async function submitLetter(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setStatus("sending");
		setError("");

		const form = new FormData(event.currentTarget);
		const name = String(form.get("name") ?? "").trim();
		const contact = String(form.get("contact") ?? "").trim();

		try {
			const response = await fetch("/api/feedback", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					game: "Hammerbound playtest signup",
					message: `Playtest signup from ${name}`,
					contact,
				}),
			});
			const result = (await response.json()) as { error?: string };
			if (!response.ok) {
				throw new Error(result.error ?? "Your letter could not be sent.");
			}
			setStatus("sent");
		} catch (submissionError) {
			setError(
				submissionError instanceof Error
					? submissionError.message
					: "Your letter could not be sent.",
			);
			setStatus("error");
		}
	}

	return (
		<main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#2a1038] px-4 py-10 text-[#241827] sm:px-8 sm:py-16">
			<div
				className="pointer-events-none absolute inset-0 opacity-80"
				style={{
					background:
						"radial-gradient(circle at 50% 20%, #a259ff 0%, #6d298d 34%, #2a1038 76%)",
				}}
			/>
			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)] bg-[size:5px_5px] opacity-20" />

			<form
				onSubmit={submitLetter}
				className="relative w-full max-w-4xl -rotate-[0.35deg] bg-[#fffdf8] px-6 py-10 shadow-[0_28px_80px_rgba(15,3,20,0.55),8px_10px_0_rgba(52,14,68,0.3)] sm:px-14 sm:py-16 lg:px-20 lg:py-20"
			>
				<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(130,98,64,0.06),transparent_30%),radial-gradient(circle_at_75%_80%,rgba(130,98,64,0.05),transparent_35%)]" />

				<div className="relative">
					<h1 className="mb-10 text-4xl text-[#301c35] sm:text-5xl">
						Hello Tiny Doom
					</h1>

					<div className="space-y-8 text-2xl leading-[1.8] text-[#3b3040] sm:text-3xl sm:leading-[1.9]">
						<p>
							I am a lovely person named{" "}
							<label className="inline-block max-w-full align-baseline">
								<span className="sr-only">Your name</span>
								<input
									type="text"
									name="name"
									autoComplete="name"
									required
									maxLength={100}
									className="w-[min(18rem,70vw)] border-0 border-b-2 border-[#6e4c76] bg-transparent px-2 text-center text-[#241827] outline-none transition-colors focus:border-[#a259ff]"
								/>
							</label>{" "}
							and I would like to playtest your game,{" "}
							<strong className="font-normal text-[#7b2eb0]">
								Hammerbound
							</strong>
							.
						</p>

						<p>
							Please send me a key. You can contact me by{" "}
							<label className="inline-block max-w-full align-baseline">
								<span className="sr-only">
									Email, Discord, or another contact
								</span>
								<input
									type="text"
									name="contact"
									required
									maxLength={200}
									className="w-[min(22rem,70vw)] border-0 border-b-2 border-[#6e4c76] bg-transparent px-2 text-center text-[#241827] outline-none transition-colors focus:border-[#a259ff]"
								/>
							</label>
						</p>
					</div>

					<div className="mt-12 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
						<button
							type="submit"
							disabled={status === "sending" || status === "sent"}
							className="cursor-pointer bg-[#7b2eb0] px-7 py-3 text-xl text-white shadow-[4px_4px_0_#3f1752] transition-transform hover:-translate-y-0.5 disabled:cursor-default disabled:opacity-60 disabled:hover:translate-y-0"
						>
							{status === "sending"
								? "Sending..."
								: status === "sent"
									? "Letter sent"
									: "Send my letter"}
						</button>
						<p
							aria-live="polite"
							className={`text-lg ${status === "error" ? "text-[#9b254b]" : "text-[#5e3e69]"}`}
						>
							{status === "sent" && "Lovely. We'll be in touch."}
							{status === "error" && error}
						</p>
					</div>
				</div>
			</form>
		</main>
	);
}
