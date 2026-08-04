import { NextResponse } from "next/server";
import { getPeriode } from "@/lib/periode";

// Endpoint kecil read-only supaya komponen client (mis. form Pengajuan
// Belanja Baru) bisa tahu periode aktif (tahun + tahapan) yang tersimpan
// di cookie httpOnly, tanpa perlu mengubah komponen jadi server component.
export async function GET() {
  const periode = getPeriode();
  return NextResponse.json(periode);
}
