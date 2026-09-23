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
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        // Cockpit palette (warm near-black ground, one signal accent) — used by the chat UI.
        ink: {
          DEFAULT: "#0d0e0c",
          rail: "#10110f",
          card: "#121310",
          surface: "#151613",
          raised: "#1b1c19",
          hair: "#1f201d",
          line: "#262823",
          edge: "#2e302a",
        },
        fg: {
          DEFAULT: "#ecede6",
          body: "#dcddd5",
          soft: "#c3c5bb",
          subtle: "#a3a59b",
          muted: "#8c8e85",
        },
        signal: {
          DEFAULT: "#d4ff3a",
          warn: "#ff8a3d",
        },
        cycling: {
          zone1: "#94a3b8", // Active Recovery (Slate)
          zone2: "#38bdf8", // Endurance (Light Blue)
          zone3: "#4ade80", // Tempo (Green)
          zone4: "#facc15", // Threshold (Yellow)
          zone5: "#fb923c", // VO2max (Orange)
          zone6: "#f87171", // Anaerobic (Red)
          zone7: "#c084fc", // Neuromuscular (Purple)
        },
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
