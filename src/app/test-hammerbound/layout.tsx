import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "test hammerbound",
};

export default function TestHammerboundLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return children;
}
