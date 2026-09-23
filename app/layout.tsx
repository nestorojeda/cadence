import type { Metadata } from "next";
import { Barlow_Condensed, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import { APP_NAME } from "@/lib/brand";
import "./globals.css";

// next/font downloads these at build time and serves them from the app itself (no runtime CDN).
const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });
const display = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-display" });

export const metadata: Metadata = {
  title: APP_NAME,
  description: "AI Cycling Coach & Weekly Training Planner with Intervals.icu integration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${sans.variable} ${mono.variable} ${display.variable}`}>
      <body className="antialiased bg-ink text-fg font-sans min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
