import type { Metadata } from "next";
import { Syne, Inter } from "next/font/google";
import "./globals.css";

// Removing the 'weight' arrays prevents the Vercel build crash. 
// Variable fonts load all weights automatically!
const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
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
        {children}
      </body>
    </html>
  );
}
