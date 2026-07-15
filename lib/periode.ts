import { cookies } from "next/headers";

// Sesuaikan daftar tahun ini kalau perlu -- ini asumsi saya berdasarkan
// komentar "Tahun Anggaran 2026 & seterusnya" di halaman login.
export const TAHUN_OPTIONS = [2025, 2026, 2027] as const;

export const TAHAPAN_OPTIONS = [
  { value: "murni", label: "Murni" },
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
