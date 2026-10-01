import { requirePermission } from "@/lib/auth/current-user";
import { CreateSeatCategoryForm } from "@/features/seat-categories/components/create-seat-category-form";

export default async function NewSeatCategoryPage() {
  await requirePermission("seat_categories:manage");

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Add seat category
      </h1>
      <div className="max-w-lg">
        <CreateSeatCategoryForm />
      </div>
    </div>
  );
}
