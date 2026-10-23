import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
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
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
          border: "var(--card-border)",
        },
        primary: {
          DEFAULT: "#6366F1",
          50: "#EEF2FF",
          100: "#E0E7FF",
          200: "#C7D2FE",
          300: "#A5B4FC",
          400: "#818CF8",
          500: "#6366F1",
          600: "#4F46E5",
          700: "#4338CA",
          800: "#3730A3",
          900: "#312E81",
          gradient: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
        },
        violet: {
          DEFAULT: "#8B5CF6",
          500: "#8B5CF6",
          600: "#7C3AED",
        },
        accent: {
          DEFAULT: "#06B6D4",
          500: "#06B6D4",
          600: "#0891B2",
        },
        success: {
          DEFAULT: "#10B981", // Présent / Payé
          50: "#ECFDF5",
          100: "#D1FAE5",
          500: "#10B981",
          600: "#059669",
        },
        danger: {
          DEFAULT: "#F43F5E", // Absent / Non payé
          50: "#FFF1F2",
          100: "#FFE4E6",
          500: "#F43F5E",
          600: "#E11D48",
        },
        warning: {
          DEFAULT: "#F59E0B", // Partiel / En attente
          50: "#FFFBEB",
          100: "#FEF3C7",
          500: "#F59E0B",
          600: "#D97706",
        },
      },
      borderRadius: {
        "xl": "16px",
        "2xl": "20px",
        "3xl": "24px",
      },
      boxShadow: {
        "subtle": "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
        "colored-primary": "0 10px 25px -5px rgba(99, 102, 241, 0.25)",
        "colored-success": "0 10px 25px -5px rgba(16, 185, 129, 0.25)",
        "colored-danger": "0 10px 25px -5px rgba(244, 63, 94, 0.25)",
        "colored-warning": "0 10px 25px -5px rgba(245, 158, 11, 0.25)",
        "glass": "0 8px 32px 0 rgba(0, 0, 0, 0.08)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Plus Jakarta Sans", "Inter", "sans-serif"],
        arabic: ["var(--font-arabic)", "Cairo", "Tajawal", "sans-serif"],
        serif: ["Playfair Display", "Merriweather", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
