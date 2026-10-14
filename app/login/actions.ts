"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { setPeriodeCookies, TAHUN_OPTIONS, TAHAPAN_OPTIONS } from "@/lib/periode";

// Dua domain email sintetis yang pernah dipakai aplikasi ini:
//  - "admin.local"        -> akun pertama yang dibuat manual di Supabase
//                            Dashboard (lihat README).
//  - "spj-batu.internal"  -> akun yang dibuat lewat menu "Akses Aplikasi"
//                            (app/(dashboard)/akun/actions.ts).
//
// BUG LAMA: login hanya mencoba "<username>@admin.local", sehingga SEMUA
// akun yang dibuat lewat menu Akses Aplikasi (domain spj-batu.internal)
// tidak pernah bisa login -- selalu "Username atau kata sandi salah".
const LEGACY_DOMAINS = ["admin.local", "spj-batu.internal"];

const MSG_SALAH = "Username atau kata sandi salah.";
const MSG_LAYANAN =
  "Layanan database/autentikasi tidak dapat dihubungi. Jika memakai Supabase gratis, project mungkin sedang dijeda (paused) -- buka dashboard Supabase lalu klik Restore project. Coba lagi beberapa saat.";
const MSG_KONFIG =
  "Konfigurasi server belum lengkap (Environment Variables Supabase belum diisi di Vercel). Hubungi administrator sistem.";
const MSG_RATE = "Terlalu banyak percobaan login. Tunggu beberapa menit lalu coba lagi.";

function failLogin(message: string): never {
  redirect(`/login?error=${encodeURIComponent(message)}`);
}

/**
 * Daftar email kandidat untuk username yang diketik. Urutan:
 *  1) kalau input sudah berupa email (mengandung "@") -> pakai apa adanya
 *  2) kolom profiles.email (SATU query -- jalur cepat, lihat migrasi
 *     20260802000000). Bila kolom/isi belum ada, lanjut ke jalur lama:
 *     profiles.id -> auth.admin.getUserById (2 panggilan berurutan)
 *  3) fallback pola lama <username>@<domain>
 *
 * PERFORMA: versi lama SELALU melakukan 2 panggilan jaringan berurutan
 * (profiles lalu auth.admin.getUserById) sebelum sign-in. Sekarang cukup 1.
 */
async function emailCandidates(username: string): Promise<{ list: string[]; profileId?: string; needsBackfill?: boolean }> {
  const clean = username.trim().toLowerCase();
  if (clean.includes("@")) return { list: [clean] };

  const out: string[] = [];
  let profileId: string | undefined;
  let needsBackfill = false;

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const admin = createServiceClient();
      let profile: { id?: string; email?: string | null } | null = null;

      const fast = await admin.from("profiles").select("id, email").eq("username", clean).maybeSingle();
      if (!fast.error) {
        profile = fast.data;
      } else {
        // kolom email belum ada (migrasi belum dijalankan) -> query lama
        const legacy = await admin.from("profiles").select("id").eq("username", clean).maybeSingle();
        profile = legacy.data;
      }

      if (profile?.id) {
        profileId = profile.id;
        if (profile.email) {
          out.push(String(profile.email).toLowerCase());
        } else {
          const { data: u } = await admin.auth.admin.getUserById(profile.id);
          if (u?.user?.email) {
            out.push(u.user.email.toLowerCase());
            needsBackfill = !fast.error; // kolom ada tapi masih kosong -> isi sekarang
          }
        }
      }
    } catch {
      // abaikan -- lanjut ke fallback pola lama
    }
  }
  for (const d of LEGACY_DOMAINS) out.push(`${clean}@${d}`);
  return { list: Array.from(new Set(out)), profileId, needsBackfill };
}

type AuthFailure = "salah" | "layanan" | "rate";

function classify(error: { name?: string; status?: number; message?: string }): AuthFailure {
  const status = error.status ?? 0;
  if (status === 429) return "rate";
  if (error.name === "AuthRetryableFetchError" || status === 0 || status >= 500) return "layanan";
  return "salah";
}

export async function login(formData: FormData) {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  const tahun = Number(formData.get("tahun_anggaran"));
  const tahapan = String(formData.get("tahapan") || "");

  if (!username || !password) failLogin("Username dan kata sandi wajib diisi.");
  if (username.length > 120 || password.length > 200) failLogin(MSG_SALAH);
  if (
    !(TAHUN_OPTIONS as readonly number[]).includes(tahun) ||
    !TAHAPAN_OPTIONS.some((t) => t.value === tahapan)
  ) {
    failLogin("Pilih Tahun Anggaran dan Tahapan terlebih dahulu.");
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    failLogin(MSG_KONFIG);
  }

  // Hasil login dihitung di dalam try/catch; redirect() dipanggil DI LUAR
  // karena redirect bekerja dengan melempar exception khusus Next.js.
  let outcome: "ok" | AuthFailure = "salah";
  try {
    const supabase = await createClient();
    const { list, profileId, needsBackfill } = await emailCandidates(username);
    const candidates = list.slice(0, 3);

    for (const email of candidates) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) {
        outcome = "ok";
        // Isi cache email di profil supaya login berikutnya memakai jalur cepat.
        if (needsBackfill && profileId) {
          try {
            await createServiceClient().from("profiles").update({ email }).eq("id", profileId);
          } catch {
            /* tidak kritis */
          }
        }
        break;
      }
      const kind = classify(error);
      if (kind !== "salah") {
        outcome = kind; // layanan down / rate limit -> hentikan, jangan coba kandidat lain
        break;
      }
      outcome = "salah";
    }
  } catch {
    outcome = "layanan";
  }

  if (outcome === "layanan") failLogin(MSG_LAYANAN);
  if (outcome === "rate") failLogin(MSG_RATE);
  if (outcome !== "ok") failLogin(MSG_SALAH); // pesan seragam -> tidak membocorkan username mana yang ada

  await setPeriodeCookies(tahun, tahapan);
  redirect("/");
}

export async function logout() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // tetap arahkan ke /login walau Supabase tidak terjangkau
  }
  redirect("/login");
}
