import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/auth/current-user";
import { getPartnerById } from "@/features/partners/lib/get-partner-by-id";
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
    <div className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Edit partner
      </h1>
      <div className="max-w-lg">
        <EditPartnerForm partner={partner} />
      </div>
    </div>
  );
}
