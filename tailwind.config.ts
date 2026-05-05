import type { Config } from "tailwindcss";

const config: Config = {
  // 1. Where your Tailwind classes are used
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // 2. Custom Colors (Common for medical apps)
      colors: {
        primary: {
          DEFAULT: "#24AEAF", // Hospital Teal
          foreground: "#FFFFFF",
        },
        dark: {
          200: "#0D0F10",
          300: "#131619",
          400: "#1A1D21",
          700: "#ABB8C4",
        },
        green: {
          500: "#24AEAF",
          600: "#4D62E5",
        },
        red: {
          500: "#F37877",
        },
      },
      // 3. Custom Fonts (Standard for Hospital UI)
      fontFamily: {
        sans: ["var(--font-sans)"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
