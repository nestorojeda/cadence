import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Apex Cycling Coach",
  description: "AI Cycling Coach & Weekly Training Planner with Intervals.icu integration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-[#0b0f17] text-slate-100 min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
