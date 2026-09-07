import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/auth/current-user";
import { getAirportById } from "@/features/airports/lib/get-airport-by-id";
import { EditAirportForm } from "@/features/airports/components/edit-airport-form";

interface EditAirportPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditAirportPage({ params }: EditAirportPageProps) {
  await requirePermission("airports:manage");

  const { id } = await params;
  const airport = await getAirportById(id);

  if (!airport) {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Edit airport
      </h1>
      <div className="max-w-lg">
        <EditAirportForm airport={airport} />
      </div>
    </div>
  );
}
