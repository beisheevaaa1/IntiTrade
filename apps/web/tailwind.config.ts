import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172121",
        paper: "#f7f5ef",
        surface: "#fdfbf5",
        line: "#ddd8ca",
        campus: "#226f54",
        signal: "#f2a900",
        lake: "#1f5f8b",
        danger: "#b42318"
      },
      boxShadow: {
        soft: "0 18px 45px rgba(23, 33, 33, 0.08)"
      }
    }
  },
  plugins: []
} satisfies Config;
