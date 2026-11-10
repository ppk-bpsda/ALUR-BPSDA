import {
  LayoutDashboard, Building2, Wallet, ClipboardList, ShieldCheck,
  FileSpreadsheet, Settings, Plane, Users, BadgeDollarSign, Plus, Upload, CalendarRange, GitCompare, CalendarClock, History, BarChart3, KeyRound,
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
    label: "Penganggaran",
    items: [
      { icon: Wallet, name: "Rekening & Pagu (DPA)", href: "/rekening", keywords: "dpa anggaran kode rekening belanja pagu input" },
      { icon: GitCompare, name: "Perbandingan Pagu Tahapan", href: "/rekap-pagu", keywords: "pagu murni pergeseran perubahan selisih belanja baru" },
      { icon: ShieldCheck, name: "Pemeriksaan Data Pagu", href: "/rekening/pemeriksaan", keywords: "periksa salah kode rekening kesalahan input koreksi validasi" },
      { icon: History, name: "Riwayat Perubahan Pagu", href: "/rekening/riwayat", keywords: "riwayat audit log lacak perubahan siapa kapan" },
      { icon: CalendarClock, name: "Anggaran Kas (Triwulan)", href: "/anggaran-kas", keywords: "kas triwulan tw anggaran kas" },
    ],
  },
  {
    label: "Transaksi",
    items: [
      { icon: ClipboardList, name: "Pengajuan Belanja", href: "/pengajuan", keywords: "spj nota dinas spp belanja" },
      { icon: Plane, name: "Kuitansi SPPD", href: "/perjalanan-dinas", keywords: "perjadin sppd kuitansi perjalanan dinas" },
    ],
  },
  {
    label: "Laporan",
    items: [
      { icon: FileSpreadsheet, name: "Rekap Realisasi", href: "/rekap", keywords: "rekap laporan realisasi sisa" },
      { icon: BarChart3, name: "Laporan per PPTK / Kegiatan / Waktu", href: "/laporan", keywords: "laporan pptk kegiatan sub kegiatan bulan triwulan" },
    ],
  },
  {
    label: "Data Pendukung",
    items: [
      { icon: ShieldCheck, name: "Pejabat (KPA/PPTK/BPP)", href: "/pejabat", keywords: "pejabat kpa pptk bpp bendahara" },
      { icon: Building2, name: "Penyedia Barang/Jasa", href: "/penyedia", keywords: "vendor rekanan toko" },
      { icon: Users, name: "Data Pegawai", href: "/perjalanan-dinas/pegawai", keywords: "pegawai nip golongan" },
      { icon: BadgeDollarSign, name: "SBU Uang Harian", href: "/perjalanan-dinas/sbu", keywords: "sbu uang harian tarif" },
    ],
  },
  {
    label: "Pengaturan",
    items: [
      { icon: CalendarRange, name: "Periode (Tahun & Tahapan)", href: "/periode", keywords: "tahun anggaran tahapan murni pergeseran perubahan tanggal penetapan" },
      { icon: Settings, name: "Pengaturan Aplikasi", href: "/pengaturan", keywords: "setelan konfigurasi" },
      { icon: KeyRound, name: "Akun Login", href: "/akun", keywords: "akun password sandi pengguna akses" },
    ],
  },
];

/** Tindakan cepat yang hanya muncul di pencarian cepat (tidak ada di sidebar). */
export const extraCommands: Array<{ name: string; href: string; hint: string; icon: LucideIcon; keywords: string }> = [
  { name: "Buat pengajuan belanja baru", href: "/pengajuan/baru", hint: "Tindakan", icon: Plus, keywords: "tambah baru spj" },
  { name: "Impor pengajuan dari Excel", href: "/pengajuan/import", hint: "Tindakan", icon: Upload, keywords: "import unggah excel xlsx" },
  { name: "Impor / perbarui pagu dari Excel", href: "/rekening/import", hint: "Tindakan", icon: Upload, keywords: "pagu perubahan pergeseran excel sub kegiatan belanja baru" },
  { name: "Buat kuitansi SPPD baru", href: "/perjalanan-dinas/baru", hint: "Tindakan", icon: Plane, keywords: "tambah perjadin sppd" },
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
  riwayat: "Riwayat Pagu",
  pemeriksaan: "Pemeriksaan Data",
  rincian: "Rincian",
  "perjalanan-dinas": "Kuitansi SPPD",
  pegawai: "Data Pegawai",
  sbu: "SBU Uang Harian",
  rekening: "Rekening & Pagu",
  pejabat: "Manajemen Akun",
  penyedia: "Penyedia Barang/Jasa",
  rekap: "Rekap Realisasi",
  "rekap-pagu": "Perbandingan Pagu",
  "anggaran-kas": "Anggaran Kas",
  laporan: "Laporan",
  pengaturan: "Pengaturan",
  periode: "Periode",
  akun: "Akses Aplikasi",
  "dev-ui": "Komponen UI",
};
