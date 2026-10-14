import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Hanya font sistem (CSP font-src 'self') -- cepat, tanpa unduhan font.
        sans: [
          "Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI",
          "Roboto", "Helvetica Neue", "Arial", "sans-serif",
        ],
        serif: ["Georgia", "Cambria", "Times New Roman", "serif"],
      },
      colors: {
        // Palet utama: teal tenang + navy dalam (lebih lembut di mata
        // dibanding kombinasi biru-hijau terang sebelumnya).
        brand: {
          50: "#f0f9f7",
          100: "#d6efe9",
          200: "#aedfd4",
          300: "#7fc8ba",
          400: "#4eab9b",
          500: "#2f8f80",
          600: "#237469",
          700: "#205d55",
          800: "#1d4a45",
          900: "#1b3e3a",
        },
        ink: {
          700: "#1e2b3a",
          800: "#152230",
          900: "#0e1a26",
          950: "#09121b",
        },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.05)",
        card: "0 1px 2px rgba(15,23,42,0.04), 0 4px 16px -4px rgba(15,23,42,0.08)",
        lift: "0 2px 4px rgba(15,23,42,0.05), 0 12px 28px -8px rgba(15,23,42,0.14)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-up": "fade-up .35s ease-out both",
      },
    },
  },
  plugins: [],
};
export default config;
