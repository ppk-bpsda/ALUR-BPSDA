const norm = (s: unknown) => String(s ?? "").trim();

/** "1.250.000,50" | "1,250,000.50" | "Rp 1.250.000" | 1250000 -> number (atau null bila bukan angka). */
export function parseAngka(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = norm(v).replace(/rp\.?/gi, "").replace(/\s+/g, "");
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s.startsWith("-")) { neg = true; s = s.slice(1); }
  if (!/^[\d.,]+$/.test(s)) return null;
  const dot = s.lastIndexOf(".");
  const com = s.lastIndexOf(",");
  if (dot >= 0 && com >= 0) {
    const desimal = dot > com ? "." : ",";
    const ribuan = desimal === "." ? "," : ".";
    s = s.split(ribuan).join("").replace(desimal, ".");
  } else if (dot >= 0 || com >= 0) {
    const sep = dot >= 0 ? "." : ",";
    const bagian = s.split(sep);
    const banyakRibuan = bagian.length > 2 || (bagian.length === 2 && bagian[1].length === 3 && bagian[0].length <= 3 && bagian[0] !== "0");
    s = banyakRibuan ? bagian.join("") : bagian.join(".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}
