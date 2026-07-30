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
		const email = String(form.get("email") ?? "").trim();

		try {
			const response = await fetch("/api/playtest-signup", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name, email }),
			});
			const result = (await response.json()) as {
				error?: string | { message?: string };
			};
			if (!response.ok) {
				const responseError =
					response.status === 429
						? "Too many letters sent. Please try again later."
						: typeof result.error === "string"
							? result.error
							: result.error?.message;
				throw new Error(responseError ?? "Your letter could not be sent.");
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
					className={`playtest-letter playtest-postcard relative w-full ${status === "sent" ? "postcard-whoosh" : ""}`}
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
							<span className="postcard-compact-break">and my email is</span>
							<label className="block max-w-full">
								<span className="sr-only">Your email address</span>
								<input
									type="email"
									name="email"
									inputMode="email"
									autoComplete="off"
									data-1p-ignore
									data-lpignore="true"
									data-bwignore
									data-protonpass-ignore="true"
									required
									maxLength={254}
									className="letter-input postcard-input"
								/>
							</label>
						</p>

						<p>
							I would love to playtest your game{" "}
							<strong className="text-[#4a2b20]">Hammerbound</strong>.
							<br />
							Can you send me a key?
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
						aria-label={status === "sending" ? "Sending" : "Send"}
					>
						<Image
							src={
								status === "sending"
									? "/art/hammerbound/sending-label.png"
									: "/art/hammerbound/send-label.png"
							}
							alt=""
							width={status === "sending" ? 120 : 60}
							height={18}
							className="hammerbound-confirm-label"
							unoptimized
						/>
					</button>
					<p aria-live="polite" className="send-error">
						{status === "error" && error}
					</p>
				</div>

				{status === "sent" && (
					<output className="playtest-thank-you playtest-thank-you-visible">
						<span className="playtest-thank-you-content">
							<Image
								src="/art/hammerbound/thank-you.png"
								alt="Thank you!"
								width={381}
								height={81}
								unoptimized
							/>
							<span className="playtest-thank-you-followup">
								We will contact you soon!
							</span>
						</span>
					</output>
				)}
			</div>
		</main>
	);
}
