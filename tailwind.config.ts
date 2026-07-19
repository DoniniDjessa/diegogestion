import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-manrope)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-playfair)", "Georgia", "serif"],
        button: ["var(--font-marcellus)", "Georgia", "serif"],
        script: ["var(--font-greatvibes)", "cursive"],
      },
      colors: {
        brand: {
          50: "#faf5e6",
          100: "#f3ead0",
          200: "#e7d8a8",
          300: "#dac581",
          400: "#ceb364",
          500: "#c2a24c",
          600: "#a5883b",
          700: "#856c2d",
        },
        surface: {
          DEFAULT: "#fffdf6",
          muted: "#fbf6ea",
          soft: "#f3ecd9",
        },
        ink: {
          DEFAULT: "#1a1a1a",
          soft: "#55503f",
          faint: "#948b71",
        },
        line: "#e8dfc7",
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.04)",
        panel: "0 4px 16px rgba(16, 24, 40, 0.06)",
      },
      borderRadius: {
        card: "14px",
      },
      keyframes: {
        "loader-line": {
          "0%": { left: "-33%" },
          "100%": { left: "100%" },
        },
      },
      animation: {
        "loader-line": "loader-line 1.1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
