import PizZip from "pizzip";
import * as XLSX from "xlsx";

export const MAKS_UKURAN_BERKAS = 4 * 1024 * 1024; // 4 MB (batas body serverless Vercel ~4,5 MB)

export type JenisBerkas = "docx" | "xlsx" | "pdf";

/** Deteksi jenis berkas dari ekstensi DAN isi (magic bytes) -- bukan hanya nama. */
export function deteksiJenis(nama: string, buf: Buffer): JenisBerkas | null {
  const ext = nama.toLowerCase().split(".").pop() || "";
  const isZip = buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b;
  const isPdf = buf.length > 5 && buf.slice(0, 5).toString("latin1") === "%PDF-";
  if (ext === "pdf" && isPdf) return "pdf";
  if (ext === "docx" && isZip) return "docx";
  if ((ext === "xlsx" || ext === "xlsm") && isZip) return "xlsx";
  if (ext === "xls" && buf.length > 8 && buf[0] === 0xd0 && buf[1] === 0xcf) return "xlsx"; // xls lama (OLE2)
  return null;
}

function decodeXml(s: string) {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}

function teksDocx(buf: Buffer): string {
  const zip = new PizZip(buf);
  const file = zip.file("word/document.xml");
  if (!file) throw new Error("Berkas Word tidak valid.");
  const xml = file.asText();
  const out = xml
    .replace(/<w:tab\/>/g, " ")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<\/w:tc>/g, " \t ")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "");
  return decodeXml(out);
}

function teksXlsx(buf: Buffer): string {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: false });
  const parts: string[] = [];
  for (const name of wb.SheetNames.slice(0, 8)) {
    const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: "" });
    for (const r of rows.slice(0, 500)) {
      const line = r.map((c) => String(c ?? "").trim()).filter(Boolean).join(" | ");
      if (line) parts.push(line);
    }
  }
  return parts.join("\n");
}

async function teksPdf(buf: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

export async function ekstrakTeks(nama: string, buf: Buffer): Promise<{ jenis: JenisBerkas; teks: string }> {
  if (buf.length > MAKS_UKURAN_BERKAS) throw new Error(`Ukuran berkas "${nama}" melebihi 4 MB.`);
  const jenis = deteksiJenis(nama, buf);
  if (!jenis) {
    throw new Error(`Berkas "${nama}" tidak didukung. Gunakan Word (.docx), Excel (.xlsx/.xls), atau PDF.`);
  }
  let teks = "";
  if (jenis === "docx") teks = teksDocx(buf);
  else if (jenis === "xlsx") teks = teksXlsx(buf);
  else teks = await teksPdf(buf);
  teks = teks.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { jenis, teks };
}
