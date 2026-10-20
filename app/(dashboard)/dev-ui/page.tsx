import { notFound } from "next/navigation";
import Showcase from "./Showcase";

// Halaman rujukan komponen UI -- hanya untuk pengembangan, tidak ada di menu,
// dan otomatis 404 di produksi.
export default function DevUiPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Showcase />;
}
