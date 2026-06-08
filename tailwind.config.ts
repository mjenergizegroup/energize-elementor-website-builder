import type { Config } from "tailwindcss";

const config: Config = {
  theme: {
    extend: {
      colors: {
        red: "var(--color-red)",
        "red-dark": "var(--color-red-dark)",
        "red-light": "var(--color-red-light)",
        black: "var(--color-black)",
        canvas: "var(--color-canvas)",
        surface: "var(--color-surface)",
        panel: "var(--color-panel)",
        muted: "var(--color-muted)",
        hairline: "var(--color-hairline)",
        "on-red": "var(--color-on-red)",
        "on-black": "var(--color-on-black)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-inter)", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0px",
        none: "0px",
      },
      boxShadow: {
        DEFAULT: "none",
        none: "none",
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "12px",
        base: "16px",
        lg: "24px",
        xl: "32px",
        "2xl": "48px",
        section: "80px",
      },
    },
  },
};

export default config;
