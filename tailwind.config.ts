import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1.5rem", screens: { "2xl": "1280px" } },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        success: { DEFAULT: "hsl(var(--success))", foreground: "hsl(var(--success-foreground))" },
        warning: { DEFAULT: "hsl(var(--warning))", foreground: "hsl(var(--warning-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" }
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem"
      },
      fontFamily: {
        arabic: ['"Noto Naskh Arabic"', '"Geeza Pro"', 'serif'],
        sans: [
          "InterVariable",
          "Inter",
          "IBM Plex Sans Arabic",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif"
        ]
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(16 24 40 / 0.05)",
        card: "0 1px 3px 0 rgb(16 24 40 / 0.06), 0 1px 2px -1px rgb(16 24 40 / 0.06)"
      },
      keyframes: {
        "fade-in": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "scale-in": { from: { opacity: "0", transform: "scale(.97)" }, to: { opacity: "1", transform: "scale(1)" } },
        shimmer: { from: { backgroundPosition: "200% 0" }, to: { backgroundPosition: "-200% 0" } }
      },
      animation: {
        "fade-in": "fade-in .25s ease-out both",
        "scale-in": "scale-in .18s ease-out both",
        shimmer: "shimmer 1.6s linear infinite"
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
};
export default config;
