import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";

// Plus Jakarta Sans (lisensi OFL, lihat app/fonts/OFL-LICENSE.txt) -- diunggah lokal
// sehingga patuh CSP font-src 'self'. Hanya subset latin (cukup untuk Bahasa Indonesia).
const jakarta = localFont({
  src: "./fonts/PlusJakartaSans-Variable.woff2",
  variable: "--font-jakarta",
  weight: "200 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ALUR-BPSDA | SPJ Sekretariat Daerah - Kota Batu",
  description: "Aplikasi Layanan Urusan Realisasi -- pendamping penyusunan SPJ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className={`${jakarta.variable} font-sans antialiased`}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
