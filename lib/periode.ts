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

export function getPeriode() {
  const cookieStore = cookies();
  const tahun = Number(cookieStore.get(COOKIE_TAHUN)?.value);
  const tahapan = cookieStore.get(COOKIE_TAHAPAN)?.value ?? "";
  return { tahun, tahapan };
}
