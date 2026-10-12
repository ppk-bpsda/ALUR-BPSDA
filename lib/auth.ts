import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Ambil user yang sedang login (atau null). Tidak pernah melempar error --
 * kalau Supabase tidak terjangkau / env belum diisi, hasilnya dianggap
 * "belum login" supaya pemanggil bisa membalas 401 dengan rapi.
 */
export async function getSessionUser(): Promise<User | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user ?? null;
  } catch {
    return null;
  }
}

/**
 * Pagar kedua untuk API route (defense in depth). Middleware sudah
 * memblokir request tanpa sesi, tetapi route yang memakai service_role
 * atau menulis data TIDAK boleh bergantung pada satu lapis proteksi saja.
 *
 * Pemakaian:
 *   const auth = await requireUser();
 *   if (!auth.ok) return auth.response;
 */
export async function requireUser(): Promise<
  { ok: true; user: User } | { ok: false; response: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Sesi berakhir. Silakan login kembali." }, { status: 401 }),
    };
  }
  return { ok: true, user };
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}
