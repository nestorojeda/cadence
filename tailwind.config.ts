import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Cockpit palette (warm ground, one signal accent). Values live in app/globals.css with a light
        // and a dark set; the `dark` class on <html> picks one.
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          rail: "rgb(var(--ink-rail) / <alpha-value>)",
          card: "rgb(var(--ink-card) / <alpha-value>)",
          surface: "rgb(var(--ink-surface) / <alpha-value>)",
          raised: "rgb(var(--ink-raised) / <alpha-value>)",
          hair: "rgb(var(--ink-hair) / <alpha-value>)",
          line: "rgb(var(--ink-line) / <alpha-value>)",
          edge: "rgb(var(--ink-edge) / <alpha-value>)",
        },
        fg: {
          DEFAULT: "rgb(var(--fg) / <alpha-value>)",
          body: "rgb(var(--fg-body) / <alpha-value>)",
          soft: "rgb(var(--fg-soft) / <alpha-value>)",
          subtle: "rgb(var(--fg-subtle) / <alpha-value>)",
          muted: "rgb(var(--fg-muted) / <alpha-value>)",
          faint: "rgb(var(--fg-faint) / <alpha-value>)",
        },
        signal: {
          DEFAULT: "rgb(var(--signal) / <alpha-value>)",
          warn: "rgb(var(--signal-warn) / <alpha-value>)",
        },
        // Text on a signal fill: dark on lime at night, white on olive by day.
        "on-signal": "rgb(var(--on-signal) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      animation: {
        // Cadence mark while the coach works: one crank revolution per pedal stroke at 90 rpm.
        pedal: "spin 0.667s linear infinite",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;
