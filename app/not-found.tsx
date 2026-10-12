import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <h2 className="font-serif text-lg text-slate-900 mb-2">Halaman tidak ditemukan</h2>
        <p className="text-sm text-slate-600 mb-4">Alamat yang Anda buka tidak tersedia.</p>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          Kembali ke Dashboard
        </Link>
      </div>
    </div>
  );
}
