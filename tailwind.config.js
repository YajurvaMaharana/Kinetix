/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "var(--primary)",
        "primary-hover": "var(--primary-hover)",
        accent: "var(--accent)",
        highlight: "var(--highlight)",
        support: "var(--support)",
        warmCream: "var(--background)",
        surface: "var(--surface)",
        surfaceAlt: "var(--surface-alt)",
        lavenderMist: "var(--lavender)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        border: "var(--border)",
        borderSubtle: "var(--border-subtle)",
        allow: "var(--status-allow)",
        challenge: "var(--status-challenge)",
        escalate: "var(--status-escalate)",
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        xl: '16px',
        '2xl': '24px',
      },
      boxShadow: {
        plum: 'var(--shadow-plum)',
        soft: 'var(--shadow-soft)',
        dropdown: 'var(--shadow-dropdown)',
      }
    },
  },
  plugins: [],
}
