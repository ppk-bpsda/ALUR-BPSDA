"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Domain internal untuk email sintetis Supabase Auth (username tidak
// dipakai untuk email sungguhan -- akun ini bukan untuk menerima surel).
const AUTH_EMAIL_DOMAIN = "spj-batu.internal";

function usernameToEmail(username: string) {
  return `${username.toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
}

export async function addAkun(formData: FormData) {
  const username = String(formData.get("username") || "").trim().toLowerCase();
  const nama = String(formData.get("nama") || "").trim();
  const password = String(formData.get("password") || "");

  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    throw new Error("Username 3-32 karakter, hanya huruf kecil/angka/./_/- (tanpa spasi).");
  }
  if (password.length < 6) {
    throw new Error("Kata sandi minimal 6 karakter.");
  }

  const admin = createServiceClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
  });

  if (createError || !created?.user) {
    throw new Error(createError?.message || "Gagal membuat akun.");
  }

  const { error: profileError } = await admin
    .from("profiles")
    .insert({ id: created.user.id, username, nama: nama || null });

  if (profileError) {
    // rollback akun auth kalau gagal simpan profil, supaya tidak ada akun "yatim"
    await admin.auth.admin.deleteUser(created.user.id);
    if (profileError.message.includes("duplicate")) {
      throw new Error("Username sudah dipakai, pilih username lain.");
    }
    throw new Error(profileError.message);
  }

  revalidatePath("/akun");
}

export async function deleteAkun(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();

  if (currentUser?.id === id) {
    throw new Error("Tidak bisa menghapus akun yang sedang dipakai login.");
  }

  const admin = createServiceClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);

  revalidatePath("/akun");
}
