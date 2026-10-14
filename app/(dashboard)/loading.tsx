// Tampil seketika saat berpindah halaman -- aplikasi terasa responsif
// selama data halaman berikutnya masih diambil dari database.
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="skeleton h-24 w-full rounded-2xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-28 rounded-2xl" />
        ))}
      </div>
      <div className="skeleton h-72 w-full rounded-2xl" />
    </div>
  );
}
