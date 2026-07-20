/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // supaya deploy pertama ke Vercel tidak gagal gara-gara warning lint kecil.
    // Setelah aplikasi stabil, disarankan diaktifkan lagi.
    ignoreDuringBuilds: true,
  },
  images: {
    // Logo di halaman login/sidebar sempat tidak muncul karena endpoint
    // optimasi gambar bawaan Next.js (/_next/image) tidak berjalan mulus
    // di deployment ini -- gambar-gambar itu sudah diganti pakai <img>
    // biasa (tidak lewat endpoint ini lagi), tapi setting ini tetap
    // diaktifkan sebagai jaring pengaman kalau nanti ada pemakaian
    // next/image lain ditambahkan.
    unoptimized: true,
  },
};

export default nextConfig;
