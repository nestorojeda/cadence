import type { Metadata, Viewport } from "next";
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
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0e0c" },
  ],
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
      <body className="flex min-h-dvh flex-col bg-ink font-sans text-fg antialiased">{children}</body>
    </html>
  );
}
