import type { Metadata } from "next";
import { Barlow_Condensed, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import { APP_NAME } from "@/lib/brand";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

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
    // The init script sets the `dark` class before paint, so the server markup can't match it.
    <html lang="en" className={`${sans.variable} ${mono.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="antialiased bg-ink text-fg font-sans min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
