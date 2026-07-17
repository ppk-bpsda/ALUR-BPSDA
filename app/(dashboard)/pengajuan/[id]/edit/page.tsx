import PengajuanForm from "@/components/PengajuanForm";

export default function PengajuanEditPage({ params }: { params: { id: string } }) {
  return <PengajuanForm mode="edit" pengajuanId={params.id} />;
}
