import { requirePermission } from "@/lib/auth/current-user";
import { CreatePartnerForm } from "@/features/partners/components/create-partner-form";
import { PartnerFormPageHeader } from "@/features/partners/components/partner-form-page-header";

export default async function NewPartnerPage() {
  await requirePermission("partners:manage");

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 sm:p-8">
      <PartnerFormPageHeader
        title="Create partner"
        description="Add a partner to your airport rental network."
      />
      <CreatePartnerForm />
    </div>
  );
}
