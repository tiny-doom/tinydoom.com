"use client";

import Image from "next/image";
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
		<main className="relative flex h-dvh items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#2d1948_0%,#0b2865_100%)] p-4 text-[#38251f]">
			<StarField />
			<SaucerField />

			<div className="postcard-stage relative z-10 flex flex-col items-center gap-4">
				<form
					id="playtest-signup-letter"
					onSubmit={submitLetter}
					autoComplete="off"
					data-1p-ignore
					data-lpignore="true"
					data-bwignore
					data-protonpass-ignore="true"
					className={`playtest-letter playtest-postcard relative w-full -rotate-[0.35deg] ${status === "sent" ? "postcard-whoosh" : ""}`}
				>
					<div className="postcard-copy relative">
						<p>
							Hi <strong>tiny doom</strong>!
						</p>

						<p>
							I am a lovely person named{" "}
							<label className="block max-w-full">
								<span className="sr-only">Your name</span>
								<input
									type="text"
									name="name"
									autoComplete="off"
									data-1p-ignore
									data-lpignore="true"
									data-bwignore
									data-protonpass-ignore="true"
									required
									maxLength={100}
									className="letter-input postcard-input"
								/>
							</label>
						</p>

						<p>
							My{" "}
							<span className="steam-id-help">
								<button
									type="button"
									className="steam-id-trigger"
									aria-describedby="steam-id-tooltip"
									aria-label="Steam ID, how to find it"
								>
									Steam ID<sup className="steam-id-hint">*</sup>
								</button>
								<span
									id="steam-id-tooltip"
									role="tooltip"
									className="steam-id-tooltip"
								>
									<strong>Finding your Steam ID</strong>
									<span>1. Open Steam and click your username.</span>
									<span>2. Choose Account details.</span>
									<span>
										3. Copy the 17-digit ID beneath your account name.
									</span>
									<code>76561198012345678</code>
								</span>
							</span>{" "}
							is
							<label className="block max-w-full">
								<span className="sr-only">Your 17-digit Steam ID</span>
								<input
									type="text"
									name="steam_id"
									inputMode="numeric"
									autoComplete="off"
									data-1p-ignore
									data-lpignore="true"
									data-bwignore
									data-protonpass-ignore="true"
									required
									minLength={17}
									maxLength={17}
									pattern="[0-9]{17}"
									title="Enter your 17-digit Steam ID"
									className="letter-input postcard-input"
								/>
							</label>
						</p>

						<p>
							I would love to playtest your game{" "}
							<strong className="text-[#4a2b20]">Hammerbound</strong>. Can you
							send me a key?
						</p>

						<p>Thank you! {"<3"}</p>
					</div>
				</form>

				<div
					className={`send-controls ${status === "sent" ? "send-controls-sent" : ""}`}
				>
					<button
						type="submit"
						form="playtest-signup-letter"
						disabled={status === "sending" || status === "sent"}
						className="hammerbound-confirm-button"
					>
						<span className="hammerbound-confirm-label">
							{status === "sending" ? "SENDING..." : "SEND"}
						</span>
					</button>
					<p aria-live="polite" className="send-error">
						{status === "error" && error}
					</p>
				</div>

				{status === "sent" && (
					<output className="playtest-thank-you playtest-thank-you-visible">
						<Image
							src="/art/hammerbound/thank-you.png"
							alt="Thank you!"
							width={381}
							height={81}
							unoptimized
						/>
					</output>
				)}
			</div>
		</main>
	);
}
