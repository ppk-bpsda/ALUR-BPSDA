import PengajuanForm from "@/components/PengajuanForm";

export default async function PengajuanEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PengajuanForm mode="edit" pengajuanId={id} />;
}
