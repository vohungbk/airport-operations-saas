import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/auth/current-user";
import { getPartnerById } from "@/features/partners/lib/get-partner-by-id";
import { PartnerFormPageHeader } from "@/features/partners/components/partner-form-page-header";
import { EditPartnerForm } from "@/features/partners/components/edit-partner-form";

interface EditPartnerPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPartnerPage({ params }: EditPartnerPageProps) {
  await requirePermission("partners:manage");

  const { id } = await params;
  const partner = await getPartnerById(id);

  if (!partner) {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 sm:p-8">
      <PartnerFormPageHeader
        title="Edit partner"
        description="Update partner information and contact details."
      />
      <EditPartnerForm partner={partner} />
    </div>
  );
}
