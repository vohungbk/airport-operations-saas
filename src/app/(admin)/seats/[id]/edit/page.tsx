import { notFound, redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth/current-user";
import { getSeatById } from "@/features/seats/lib/get-seat-by-id";
import { getSeatFormOptions } from "@/features/seats/lib/get-seat-form-options";
import { EditSeatForm } from "@/features/seats/components/edit-seat-form";

interface EditSeatPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditSeatPage({ params }: EditSeatPageProps) {
  await requirePermission("seats:manage");

  const { id } = await params;
  const seat = await getSeatById(id);

  if (!seat) {
    notFound();
  }

  // Retired seats are view-only.
  if (seat.status === "retired") {
    redirect(`/seats/${seat.id}`);
  }

  const options = await getSeatFormOptions(seat.category_id);

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Edit seat
      </h1>
      <div className="max-w-lg">
        <EditSeatForm seat={seat} options={options} />
      </div>
    </div>
  );
}
