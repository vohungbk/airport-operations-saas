import { requirePermission } from "@/lib/auth/current-user";
import { CreateAirportForm } from "@/features/airports/components/create-airport-form";

export default async function NewAirportPage() {
  await requirePermission("airports:manage");

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Add airport
      </h1>
      <div className="max-w-lg">
        <CreateAirportForm />
      </div>
    </div>
  );
}
