"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { setPeriodeCookies, TAHUN_OPTIONS, TAHAPAN_OPTIONS } from "@/lib/periode";

// Domain tetap untuk mengubah "username" jadi format email yang dipahami
// Supabase Auth (Supabase Auth hanya mendukung login lewat email, tidak ada
// konsep username asli). Saat membuat akun Admin di Supabase Dashboard >
// Authentication > Users, isi Email dengan pola: <username>@admin.local
const USERNAME_DOMAIN = "admin.local";

function usernameToEmail(username: string): string {
  const clean = username.trim().toLowerCase();
  // Kalau orang tetap mengetik email asli (mengandung "@"), pakai apa adanya
  // supaya tidak double -- fleksibel untuk kedua kebiasaan.
  return clean.includes("@") ? clean : `${clean}@${USERNAME_DOMAIN}`;
}

export async function login(formData: FormData) {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  const tahun = Number(formData.get("tahun_anggaran"));
  const tahapan = String(formData.get("tahapan") || "");

  if (!username || !password) {
    redirect(`/login?error=${encodeURIComponent("Username dan kata sandi wajib diisi.")}`);
  }
  if (!TAHUN_OPTIONS.includes(tahun as (typeof TAHUN_OPTIONS)[number]) || !TAHAPAN_OPTIONS.some((t) => t.value === tahapan)) {
    redirect(`/login?error=${encodeURIComponent("Pilih Tahun Anggaran dan Tahapan terlebih dahulu.")}`);
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent("Username atau kata sandi salah.")}`);
  }

  setPeriodeCookies(tahun, tahapan);
  redirect("/");
}

export async function logout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
