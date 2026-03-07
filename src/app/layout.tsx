import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "Tiny Doom - Game Studio",
	description: "We make video games.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}
