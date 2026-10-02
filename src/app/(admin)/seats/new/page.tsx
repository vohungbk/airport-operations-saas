import { requirePermission } from "@/lib/auth/current-user";
import { CreateSeatForm } from "@/features/seats/components/create-seat-form";
import { getSeatFormOptions } from "@/features/seats/lib/get-seat-form-options";

export default async function NewSeatPage() {
  await requirePermission("seats:manage");

  const options = await getSeatFormOptions();

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Add seat
      </h1>
      <div className="max-w-lg">
        <CreateSeatForm options={options} />
      </div>
    </div>
  );
}
