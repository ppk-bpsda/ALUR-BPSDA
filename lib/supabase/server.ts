import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // dipanggil dari Server Component -- aman diabaikan karena
            // middleware yang akan menangani refresh session.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // idem seperti di atas
          }
        },
      },
    }
  );
}

// Client khusus server dengan service_role key -- HANYA dipakai di API route
// (mis. generate dokumen) yang perlu akses penuh tanpa terikat RLS/sesi user.
//
// PENTING -- global.fetch di bawah ini SENGAJA dipasang dengan
// `cache: "no-store"`. Tanpa ini, Next.js App Router (v14) bisa meng-cache
// hasil query supabase-js (yang di baliknya cuma pakai fetch() biasa),
// sehingga data seperti status pengajuan atau akumulasi "Realisasi Sblm"
// di Nota Dinas bisa "membeku" di nilai lama walau datanya di database
// sudah berubah. Ini adalah lapisan kedua selain `export const dynamic =
// "force-dynamic"` yang sudah dipasang di route/page pemakainya -- supaya
// tetap aman meski nanti ada route lain yang lupa menambahkan flag itu.
export function createServiceClient() {
  const { createClient: createSupabaseClient } = require("@supabase/supabase-js");
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, cache: "no-store" }),
      },
    }
  );
}
