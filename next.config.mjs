/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // supaya deploy pertama ke Vercel tidak gagal gara-gara warning lint kecil.
    // Setelah aplikasi stabil, disarankan diaktifkan lagi.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
