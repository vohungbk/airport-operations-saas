import { requirePermission } from "@/lib/auth/current-user";
import { CreatePartnerForm } from "@/features/partners/components/create-partner-form";

export default async function NewPartnerPage() {
  await requirePermission("partners:manage");

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Add partner
      </h1>
      <div className="max-w-lg">
        <CreatePartnerForm />
      </div>
    </div>
  );
}
