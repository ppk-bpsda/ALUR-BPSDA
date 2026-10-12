"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getSessionUser, isUuid } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { failTo } from "@/lib/flash";

// Pesan error tampil sebagai banner di halaman (bukan halaman error umum).
function fail(message: unknown): never {
  return failTo("/akun", message);
}

// Domain internal untuk email sintetis Supabase Auth (username tidak
// dipakai untuk email sungguhan -- akun ini bukan untuk menerima surel).
const AUTH_EMAIL_DOMAIN = "spj-batu.internal";

function usernameToEmail(username: string) {
  return `${username.toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
}

async function assertLogin() {
  // Pagar tambahan: action ini memakai service_role (bisa membuat/menghapus
  // akun), jadi wajib memastikan pemanggilnya benar-benar sedang login.
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function addAkun(formData: FormData) {
  await assertLogin();
  const username = String(formData.get("username") || "").trim().toLowerCase();
  const nama = String(formData.get("nama") || "").trim();
  const password = String(formData.get("password") || "");

  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    fail("Username 3-32 karakter, hanya huruf kecil/angka/./_/- (tanpa spasi).");
  }
  if (password.length < 10 || password.length > 72) {
    fail("Kata sandi 10-72 karakter.");
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    fail("Kata sandi harus mengandung huruf dan angka.");
  }

  const admin = createServiceClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
  });

  if (createError || !created?.user) {
    fail(createError?.message || "Gagal membuat akun.");
  }

  const { error: profileError } = await admin
    .from("profiles")
    .insert({ id: created.user.id, username, nama: nama || null });

  if (profileError) {
    // rollback akun auth kalau gagal simpan profil, supaya tidak ada akun "yatim"
    await admin.auth.admin.deleteUser(created.user.id);
    if (profileError.message.includes("duplicate")) {
      fail("Username sudah dipakai, pilih username lain.");
    }
    fail(profileError.message);
  }

  revalidatePath("/akun");
}

export async function deleteAkun(formData: FormData) {
  const currentUser = await assertLogin();
  const id = String(formData.get("id"));
  if (!isUuid(id)) fail("ID akun tidak valid.");

  if (currentUser.id === id) {
    fail("Tidak bisa menghapus akun yang sedang dipakai login.");
  }

  const admin = createServiceClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) fail(error.message);

  revalidatePath("/akun");
}
