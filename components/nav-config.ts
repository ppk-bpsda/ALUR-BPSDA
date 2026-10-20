import {
  LayoutDashboard, Building2, Wallet, ClipboardList, ShieldCheck,
  FileSpreadsheet, Settings, Plane, Users, BadgeDollarSign, Plus, Upload, CalendarRange,
  type LucideIcon,
} from "lucide-react";

// Sumber tunggal menu aplikasi: dipakai Sidebar, pencarian cepat (Ctrl/Cmd+K), dan breadcrumb.
// Nama & href di bawah SAMA dengan menu sebelumnya.
export interface NavItem {
  icon: LucideIcon;
  name: string;
  href: string;
  /** Kata kunci tambahan untuk pencarian cepat. */
  keywords?: string;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  { label: "Ringkasan", items: [{ icon: LayoutDashboard, name: "Dashboard", href: "/", keywords: "beranda ringkasan pagu realisasi" }] },
  {
    label: "Transaksi",
    items: [{ icon: ClipboardList, name: "Pengajuan Belanja", href: "/pengajuan", keywords: "spj nota dinas spp belanja" }],
  },
  {
    label: "Administrasi Perjalanan Dinas",
    items: [
      { icon: Plane, name: "Kuitansi SPPD", href: "/perjalanan-dinas", keywords: "perjadin sppd kuitansi" },
      { icon: Users, name: "Data Pegawai", href: "/perjalanan-dinas/pegawai", keywords: "pegawai nip golongan" },
      { icon: BadgeDollarSign, name: "SBU Uang Harian", href: "/perjalanan-dinas/sbu", keywords: "sbu uang harian tarif" },
    ],
  },
  {
    label: "Master Data",
    items: [
      { icon: Wallet, name: "Rekening & Pagu (DPA)", href: "/rekening", keywords: "dpa anggaran kode rekening" },
      { icon: ShieldCheck, name: "Manajemen Akun (KPA/PPTK/BPP)", href: "/pejabat", keywords: "pejabat kpa pptk bpp bendahara" },
      { icon: Building2, name: "Penyedia Barang/Jasa", href: "/penyedia", keywords: "vendor rekanan toko" },
    ],
  },
  {
    label: "Laporan",
    items: [{ icon: FileSpreadsheet, name: "Rekap Realisasi", href: "/rekap", keywords: "rekap laporan realisasi" }],
  },
  {
    label: "Lainnya",
    items: [{ icon: Settings, name: "Pengaturan Aplikasi", href: "/pengaturan", keywords: "setelan konfigurasi" }],
  },
];

/** Tindakan cepat yang hanya muncul di pencarian cepat (tidak ada di sidebar). */
export const extraCommands: Array<{ name: string; href: string; hint: string; icon: LucideIcon; keywords: string }> = [
  { name: "Buat pengajuan belanja baru", href: "/pengajuan/baru", hint: "Tindakan", icon: Plus, keywords: "tambah baru spj" },
  { name: "Impor pengajuan dari Excel", href: "/pengajuan/import", hint: "Tindakan", icon: Upload, keywords: "import unggah excel xlsx" },
  { name: "Buat kuitansi SPPD baru", href: "/perjalanan-dinas/baru", hint: "Tindakan", icon: Plane, keywords: "tambah perjadin sppd" },
  { name: "Ganti periode (tahun & tahapan)", href: "/periode", hint: "Tindakan", icon: CalendarRange, keywords: "tahun anggaran tahapan murni pergeseran perubahan" },
  { name: "Akses aplikasi (akun login)", href: "/akun", hint: "Tindakan", icon: ShieldCheck, keywords: "akun password sandi pengguna" },
  { name: "Laporan", href: "/laporan", hint: "Tindakan", icon: FileSpreadsheet, keywords: "laporan" },
];

// Item aktif: cocok persis, atau prefix untuk sub-halaman -- kecuali bila ada
// item lain yang lebih spesifik (mis. /perjalanan-dinas/pegawai). Logika TIDAK berubah.
const allHrefs = navGroups.flatMap((g) => g.items.map((i) => i.href));
export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (pathname === href) return true;
  if (!pathname.startsWith(href + "/")) return false;
  return !allHrefs.some((h) => h !== href && h.startsWith(href + "/") && (pathname === h || pathname.startsWith(h + "/")));
}

/** Label breadcrumb per segmen URL. */
export const ROUTE_LABELS: Record<string, string> = {
  pengajuan: "Pengajuan Belanja",
  baru: "Baru",
  edit: "Ubah",
  import: "Impor",
  "perjalanan-dinas": "Kuitansi SPPD",
  pegawai: "Data Pegawai",
  sbu: "SBU Uang Harian",
  rekening: "Rekening & Pagu",
  pejabat: "Manajemen Akun",
  penyedia: "Penyedia Barang/Jasa",
  rekap: "Rekap Realisasi",
  laporan: "Laporan",
  pengaturan: "Pengaturan",
  periode: "Periode",
  akun: "Akses Aplikasi",
  "dev-ui": "Komponen UI",
};
