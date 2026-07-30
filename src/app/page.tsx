import Image from "next/image";
import { SaucerField } from "./saucer-field";
import { StarField } from "./star-field";

export default function Home() {
	return (
		<main className="relative flex h-dvh items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#2d1948_0%,#0b2865_100%)] p-4">
			<StarField />
			<SaucerField />
			<div className="relative z-10">
				<Image
					src="/art/hammerbound/coming-soon.png"
					alt="Coming soon..."
					width={501}
					height={81}
					className="h-auto w-[min(501px,calc(100vw-2rem))] [image-rendering:pixelated]"
					unoptimized
				/>
			</div>
		</main>
	);
}
