import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: [
          "var(--font-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        green: {
          DEFAULT: "#15D555",
          "80": "#15D555CC",
          "53": "#15D55588",
          "40": "#15D55566",
          "27": "#15D55544",
          "15": "#15D55526",
          "6": "#15D55510",
        },
      },
      keyframes: {
        cursorBlink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 8px var(--accent-26)" },
          "50%": { boxShadow: "0 0 20px var(--accent-44)" },
        },
      },
      animation: {
        cursor: "cursorBlink 1s steps(1) infinite",
        "pulse-glow": "pulseGlow 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
