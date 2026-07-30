"use client";

import { type FormEvent, useState } from "react";
import { SaucerField } from "./saucer-field";
import { StarField } from "./star-field";

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
		const steamId = String(form.get("steam_id") ?? "").trim();

		try {
			const response = await fetch("/api/playtest-signup", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name, steam_id: steamId }),
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
		<main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#2d1948] px-4 py-10 text-[#38251f] sm:px-8 sm:py-16">
			<StarField />
			<SaucerField />

			<form
				onSubmit={submitLetter}
				className="playtest-letter relative z-10 w-full max-w-4xl -rotate-[0.35deg] bg-[#fffdf8] px-6 py-10 shadow-[0_28px_80px_rgba(15,3,20,0.55),8px_10px_0_rgba(20,8,32,0.38)] sm:px-14 sm:py-16 lg:px-20 lg:py-20"
			>
				<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(130,98,64,0.06),transparent_30%),radial-gradient(circle_at_75%_80%,rgba(130,98,64,0.05),transparent_35%)]" />

				<div className="relative space-y-8 text-2xl leading-[1.8] sm:text-3xl sm:leading-[1.9]">
					<p>
						Hi <strong>tiny doom</strong>!
					</p>

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
								className="letter-input w-[min(18rem,70vw)]"
							/>
						</label>
						.
					</p>

					<p>
						I would just LOVE to playtest your game{" "}
						<strong className="text-[#4a2b20]">Hammerbound</strong>. Can you
						send me a key?
					</p>

					<p>
						My{" "}
						<span className="steam-id-help">
							<button
								type="button"
								className="steam-id-trigger"
								aria-describedby="steam-id-tooltip"
							>
								Steam ID
							</button>
							<span
								id="steam-id-tooltip"
								role="tooltip"
								className="steam-id-tooltip"
							>
								<strong>Finding your Steam ID</strong>
								<span>1. Open Steam and click your username.</span>
								<span>2. Choose Account details.</span>
								<span>3. Copy the 17-digit ID beneath your account name.</span>
								<code>76561198012345678</code>
							</span>
						</span>{" "}
						is{" "}
						<label className="inline-block max-w-full align-baseline">
							<span className="sr-only">Your 17-digit Steam ID</span>
							<input
								type="text"
								name="steam_id"
								inputMode="numeric"
								autoComplete="off"
								required
								minLength={17}
								maxLength={17}
								pattern="[0-9]{17}"
								title="Enter your 17-digit Steam ID"
								className="letter-input w-[min(22rem,70vw)]"
							/>
						</label>
						.
					</p>

					<p>Thank you! {"<3"}</p>

					<div className="flex flex-col items-start gap-4 pt-4 sm:flex-row sm:items-center">
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
