import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        obsidian: {
          bg: "#080B12",
          surface: "#101521",
          card: "#121826",
          hover: "#172033",
          border: "#1e293b",
          cyan: "#56D9F5",
          violet: "#A78BFA",
          emerald: "#34D399",
          amber: "#FBBF24",
          coral: "#FB7185",
        },
        "surface-container-low": "#101521",
        "surface-container": "#141a29",
        "surface-container-high": "#1c2438",
        "on-surface": "#e0e2ed",
        "on-surface-variant": "#94a3b8",
      },
    },
  },
  plugins: [],
};
export default config;
