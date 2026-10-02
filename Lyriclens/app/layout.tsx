import type { Metadata } from "next";
import { Syne, Inter } from "next/font/google";
import "./globals.css";
import Providers from "./components/Providers";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LyricLens — Deep Lyric Analysis Powered by AI",
  description:
    "Paste any lyric line and get an instant AI-powered breakdown of its meaning, poetic devices, cultural context, and wordplay.",
  keywords: ["lyric analysis", "song meaning", "music", "AI", "poetry"],
  openGraph: {
    title: "LyricLens",
    description: "AI-powered lyric analysis. Understand every word, every layer.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${syne.variable} ${inter.variable}`}>
      <body className="font-inter antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
