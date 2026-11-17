import type { Config } from "tailwindcss";
export default {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: {
    colors: {
      bg: "rgb(var(--bg) / <alpha-value>)", surface: "rgb(var(--surface) / <alpha-value>)",
      muted: "rgb(var(--muted) / <alpha-value>)", line: "rgb(var(--line) / <alpha-value>)",
      fg: "rgb(var(--fg) / <alpha-value>)", sub: "rgb(var(--sub) / <alpha-value>)",
      brand: "rgb(var(--brand) / <alpha-value>)",
    },
  }},
  plugins: [],
} satisfies Config;
