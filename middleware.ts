import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Proteksi seluruh aplikasi: harus login, kecuali halaman /login.
 *
 * PERUBAHAN PENTING dibanding versi lama:
 *  - /api/* KINI ikut diproteksi. Sebelumnya matcher mengecualikan "api/.*",
 *    sehingga endpoint yang memakai service_role (import & generate dokumen)
 *    bisa dipanggil siapa pun tanpa login.
 *  - Request API tanpa sesi dibalas 401 JSON (bukan redirect HTML).
 *  - Kalau env Supabase belum diisi / Supabase tidak terjangkau, middleware
 *    TIDAK lagi crash dengan 500 (MIDDLEWARE_INVOCATION_FAILED) -- melainkan
 *    menampilkan pesan yang jelas.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const isLoginPage = pathname === "/login" || pathname.startsWith("/login/");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    // Halaman login tetap dirender supaya pesan kesalahan dari form login
    // bisa tampil; semua yang lain dijawab 503.
    if (isLoginPage) return NextResponse.next();
    const msg =
      "Konfigurasi server belum lengkap: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY belum diisi di Environment Variables.";
    return isApi
      ? NextResponse.json({ error: msg }, { status: 503 })
      : new NextResponse(msg, { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  let response = NextResponse.next({ request: { headers: request.headers } });

  let user: { id: string } | null = null;
  try {
    const supabase = createServerClient(url, anon, {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    });
    // PERFORMA: getUser() = 1 panggilan jaringan ke Supabase Auth di SETIAP
    // klik menu/halaman (inilah penyebab utama aplikasi terasa lemot). Di
    // middleware cukup getSession(): membaca cookie secara lokal dan hanya
    // menghubungi Supabase bila token perlu diperbarui. Verifikasi
    // otoritatif tetap ada di lapisan lain: layout dashboard (getUser),
    // seluruh API route (requireUser) dan RLS database (JWT divalidasi
    // PostgREST pada setiap query) -- cookie palsu tidak bisa mengakses data.
    const { data } = await supabase.auth.getSession();
    user = data?.session?.user ?? null;
  } catch {
    // Supabase tidak terjangkau (mis. project free-tier sedang di-pause).
    user = null;
  }

  if (!user && !isLoginPage) {
    if (isApi) {
      return NextResponse.json({ error: "Sesi berakhir. Silakan login kembali." }, { status: 401 });
    }
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isLoginPage) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  // /api/* sengaja TIDAK dikecualikan lagi. Hanya aset statis yang dilewati.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map|txt|woff|woff2|ttf)$).*)",
  ],
};
