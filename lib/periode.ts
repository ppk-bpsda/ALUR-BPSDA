import { cookies } from "next/headers";

// Tahun Anggaran yang tersedia untuk dipilih saat login & di menu
// "Ganti Periode". Sesuai kebutuhan: 2026 s/d 2036.
export const TAHUN_OPTIONS = [
  2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035, 2036,
] as const;

// Tahapan DPA -- HARUS sama persis dengan nilai enum `tahapan_dpa` di
// database (lihat supabase/migrations/20260714100001_init_schema_v2.sql:
// create type tahapan_dpa as enum ('murni', 'pergeseran', 'perubahan')).
export const TAHAPAN_OPTIONS = [
  { value: "murni", label: "Murni" },
  { value: "pergeseran", label: "Pergeseran" },
  { value: "perubahan", label: "Perubahan" },
] as const;

const COOKIE_TAHUN = "periode_tahun_anggaran";
const COOKIE_TAHAPAN = "periode_tahapan";

export function setPeriodeCookies(tahun: number, tahapan: string) {
  const cookieStore = cookies();
  const oneYear = 60 * 60 * 24 * 365;

  cookieStore.set(COOKIE_TAHUN, String(tahun), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: oneYear,
  });
  cookieStore.set(COOKIE_TAHAPAN, tahapan, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: oneYear,
  });
}

// Dipakai kalau cookie periode belum ada (mis. sesi lama sebelum fitur ini
// ada, atau cookie kadaluarsa) -- supaya query di halaman tidak filter
// dengan NaN/"" yang membuat hasilnya kosong atau error.
const DEFAULT_TAHUN = TAHUN_OPTIONS[0];
const DEFAULT_TAHAPAN = TAHAPAN_OPTIONS[0].value;

export function getPeriode(): { tahun: number; tahapan: (typeof TAHAPAN_OPTIONS)[number]["value"] } {
  const cookieStore = cookies();
  const tahunRaw = Number(cookieStore.get(COOKIE_TAHUN)?.value);
  const tahapanRaw = cookieStore.get(COOKIE_TAHAPAN)?.value ?? "";

  const tahun = (TAHUN_OPTIONS as readonly number[]).includes(tahunRaw) ? tahunRaw : DEFAULT_TAHUN;
  const tahapan = TAHAPAN_OPTIONS.some((t) => t.value === tahapanRaw)
    ? (tahapanRaw as (typeof TAHAPAN_OPTIONS)[number]["value"])
    : DEFAULT_TAHAPAN;

  return { tahun, tahapan };
}

export function tahapanLabel(value: string) {
  return TAHAPAN_OPTIONS.find((t) => t.value === value)?.label ?? value;
}
