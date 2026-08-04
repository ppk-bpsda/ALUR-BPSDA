import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ALUR-BPSDA | SPJ Sekretariat Daerah - Kota Batu",
  description: "Aplikasi Layanan Urusan Realisasi -- pendamping penyusunan SPJ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="font-sans antialiased bg-slate-50 text-slate-800">{children}</body>
    </html>
  );
}
