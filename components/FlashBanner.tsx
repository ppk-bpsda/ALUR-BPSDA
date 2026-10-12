"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const galat = params.get("galat");
  if (!galat) return null;

  const tutup = () => {
    const sp = new URLSearchParams(params.toString());
    sp.delete("galat");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      <span className="flex-1">{galat}</span>
      <button onClick={tutup} className="text-red-600 hover:text-red-800 font-medium" aria-label="Tutup pesan">
        Tutup
      </button>
    </div>
  );
}

export default function FlashBanner() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
