import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/auth/current-user";
import { getPartnerById } from "@/features/partners/lib/get-partner-by-id";
import { PartnerDetail } from "@/features/partners/components/partner-detail";

interface PartnerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PartnerDetailPage({
  params,
}: PartnerDetailPageProps) {
  await requirePermission("partners:manage");

  const { id } = await params;
  const partner = await getPartnerById(id);

  if (!partner) {
    notFound();
  }

  return <PartnerDetail partner={partner} />;
}
