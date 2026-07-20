"use server";

import { redirect } from "next/navigation";
import { setPeriodeCookies, TAHUN_OPTIONS, TAHAPAN_OPTIONS } from "@/lib/periode";

export async function gantiPeriode(formData: FormData) {
  const tahun = Number(formData.get("tahun_anggaran"));
  const tahapan = String(formData.get("tahapan") || "");

  if (
    !(TAHUN_OPTIONS as readonly number[]).includes(tahun) ||
    !TAHAPAN_OPTIONS.some((t) => t.value === tahapan)
  ) {
    redirect("/periode");
  }

  setPeriodeCookies(tahun, tahapan);
  redirect("/");
}
