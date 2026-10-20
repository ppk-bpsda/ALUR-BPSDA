import type { Config } from "tailwindcss";

// Design token ALUR-BPSDA (Fase 1).
// Arah visual: segar & muda tetapi tetap resmi -- teal + navy sebagai identitas,
// satu aksen "citrus" (lime) dipakai hemat untuk sorotan, sudut membulat besar,
// dan huruf Plus Jakarta Sans (diunggah lokal ke repo, patuh CSP font-src 'self').
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // --font-jakarta diisi next/font/local di app/layout.tsx.
        sans: [
          "var(--font-jakarta)", "Inter", "ui-sans-serif", "system-ui", "-apple-system",
          "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif",
        ],
        // Tetap Georgia: dipakai tempat lain (mis. error/not-found) dan bukan bagian kertas dokumen.
        serif: ["Georgia", "Cambria", "Times New Roman", "serif"],
      },
      colors: {
        // Identitas merek (tidak berubah).
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
        // Aksen citrus: sorotan kecil (indikator aktif, CTA utama sesekali, lencana "baru").
        // Teks di atas aksen selalu ink-900.
        accent: {
          200: "#ecfa9e",
          300: "#e2f66f",
          400: "#d6f24b",
          500: "#c3e02a",
          600: "#9db816",
        },
        // Permukaan & garis (kanvas sedikit kehijauan, selaras teal).
        canvas: "#f1f6f5",
        surface: { DEFAULT: "#ffffff", muted: "#f6f9f9" },
        line: { DEFAULT: "#e2e9ea", strong: "#cbd6d8" },
        // Warna semantik: SATU sumber untuk status, galat, peringatan, info.
        success: { 50: "#ecfdf3", 100: "#d1fae0", 200: "#a7f0c4", 600: "#15803d", 700: "#166534" },
        warning: { 50: "#fffbeb", 100: "#fef3c7", 200: "#fde68a", 600: "#b45309", 700: "#92400e" },
        danger: { 50: "#fff1f2", 100: "#ffe4e6", 200: "#fecdd3", 600: "#be123c", 700: "#9f1239" },
        info: { 50: "#f0f9ff", 100: "#e0f2fe", 200: "#bae6fd", 600: "#0369a1", 700: "#075985" },
      },
      borderRadius: {
        ctl: "0.75rem", // kontrol: tombol, isian
        card: "1.25rem", // kartu, modal
      },
      fontSize: {
        // Skala tipografi: [ukuran, {tinggi baris, jarak huruf, bobot}]
        display: ["2rem", { lineHeight: "2.5rem", letterSpacing: "-0.025em", fontWeight: "700" }],
        title: ["1.5rem", { lineHeight: "2rem", letterSpacing: "-0.02em", fontWeight: "700" }],
        heading: ["1.125rem", { lineHeight: "1.75rem", letterSpacing: "-0.01em", fontWeight: "600" }],
        body: ["0.875rem", { lineHeight: "1.5rem" }],
        caption: ["0.75rem", { lineHeight: "1.125rem" }],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.05)",
        card: "0 1px 2px rgba(15,23,42,0.04), 0 4px 16px -4px rgba(15,23,42,0.08)",
        lift: "0 2px 4px rgba(15,23,42,0.05), 0 12px 28px -8px rgba(15,23,42,0.14)",
        glow: "0 6px 18px -6px rgba(35,116,105,0.55)",
      },
      // Token gerak: cepat untuk umpan balik, sedang untuk panel, lambat untuk lembar besar.
      transitionDuration: { fast: "120ms", base: "200ms", slow: "320ms" },
      transitionTimingFunction: {
        "out-soft": "cubic-bezier(0.22, 1, 0.36, 1)",
        "in-soft": "cubic-bezier(0.64, 0, 0.78, 0)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(14px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "sheet-in": {
          "0%": { opacity: "0", transform: "translateY(28px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        // Catatan: keyframe "shimmer" untuk .skeleton sengaja ada di globals.css
        // (Tailwind tidak menerbitkan keyframe yang hanya dirujuk dari CSS biasa).
      },
      animation: {
        "fade-up": "fade-up .35s ease-out both",
        // Transisi antar-halaman: fill "backwards" (bukan "both") supaya tidak meninggalkan
        // transform permanen yang bisa memengaruhi elemen position:fixed di dalam halaman.
        "page-in": "fade-up .22s cubic-bezier(0.22,1,0.36,1) backwards",
        "fade-in": "fade-in .2s cubic-bezier(0.22,1,0.36,1) both",
        "scale-in": "scale-in .2s cubic-bezier(0.22,1,0.36,1) both",
        "slide-in-right": "slide-in-right .28s cubic-bezier(0.22,1,0.36,1) both",
        "sheet-in": "sheet-in .3s cubic-bezier(0.22,1,0.36,1) both",
        "pulse-soft": "pulse-soft 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
