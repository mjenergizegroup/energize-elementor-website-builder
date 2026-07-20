import type { Config } from "tailwindcss";

const config: Config = {
  theme: {
    extend: {
      colors: {
        primary: "var(--color-primary)",
        "primary-hover": "var(--color-primary-hover)",
        "primary-tint": "var(--color-primary-tint)",
        success: "var(--color-success)",
        "success-tint": "var(--color-success-tint)",
        "success-dot": "var(--color-success-dot)",
        warning: "var(--color-warning)",
        "warning-tint": "var(--color-warning-tint)",
        danger: "var(--color-danger)",
        "danger-tint": "var(--color-danger-tint)",
        "page-background": "var(--color-page-background)",
        surface: "var(--color-surface)",
        "surface-raised": "var(--color-surface-raised)",
        "row-hover": "var(--color-row-hover)",
        "border-default": "var(--color-border-default)",
        "border-strong": "var(--color-border-strong)",
        "text-primary": "var(--color-text-primary)",
        "text-secondary": "var(--color-text-secondary)",
        "text-faint": "var(--color-text-faint)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-inter)", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "var(--radius-md)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        DEFAULT: "var(--shadow-sm)",
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
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
