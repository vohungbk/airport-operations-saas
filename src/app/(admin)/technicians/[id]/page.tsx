import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/auth/current-user";
import { getTechnicianById } from "@/features/technicians/lib/get-technician-by-id";
import { TechnicianDetail } from "@/features/technicians/components/technician-detail";

interface TechnicianDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TechnicianDetailPage({
  params,
}: TechnicianDetailPageProps) {
  await requirePermission("technicians:manage");

  const { id } = await params;
  const technician = await getTechnicianById(id);

  if (!technician) {
    notFound();
  }

  return <TechnicianDetail technician={technician} />;
}
