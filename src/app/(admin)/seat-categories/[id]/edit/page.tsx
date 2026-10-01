import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/auth/current-user";
import { getSeatCategoryById } from "@/features/seat-categories/lib/get-seat-category-by-id";
import { EditSeatCategoryForm } from "@/features/seat-categories/components/edit-seat-category-form";

interface EditSeatCategoryPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditSeatCategoryPage({
  params,
}: EditSeatCategoryPageProps) {
  await requirePermission("seat_categories:manage");

  const { id } = await params;
  const seatCategory = await getSeatCategoryById(id);

  if (!seatCategory) {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Edit seat category
      </h1>
      <div className="max-w-lg">
        <EditSeatCategoryForm seatCategory={seatCategory} />
      </div>
    </div>
  );
}
