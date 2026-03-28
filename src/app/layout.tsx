import type { Metadata } from "next";
import { Source_Serif_4 } from "next/font/google";
import "./globals.css";

const sourceSerif = Source_Serif_4({
	variable: "--font-source-serif",
	subsets: ["latin"],
	weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
	title: "SimBayan — Urban Policy Simulation",
	description: "Simulate the impact of urban policy proposals across economic, environmental, and social dimensions.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body className={`${sourceSerif.variable} antialiased`}>{children}</body>
		</html>
	);
}
