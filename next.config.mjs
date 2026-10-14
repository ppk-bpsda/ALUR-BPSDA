const isProd = process.env.NODE_ENV === "production";

// Host Supabase untuk CSP connect-src (browser client dipakai di form pengajuan).
let supabaseOrigin = "";
let supabaseWs = "";
try {
  const u = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
  supabaseOrigin = u.origin;
  supabaseWs = `wss://${u.host}`;
} catch {
  // env belum diisi saat build -- CSP tetap valid, connect-src hanya 'self'
}

const csp = [
  "default-src 'self'",
  // Next.js App Router menyisipkan script inline; 'unsafe-eval' hanya di dev (HMR).
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseWs}`.trim(),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  eslint: {
    // supaya deploy ke Vercel tidak gagal gara-gara warning lint kecil.
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
  // renderTemplate() membaca templates/*.docx lewat fs saat runtime. Next
  // tidak bisa melacak path dinamis, jadi tanpa ini file template BISA
  // tidak ikut ter-bundle di Vercel -> "ENOENT" saat generate dokumen.
  outputFileTracingIncludes: {
    "/api/generate-dokumen": ["./templates/**/*"],
    "/api/perjalanan-dinas/[id]/kuitansi": ["./templates/**/*"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
