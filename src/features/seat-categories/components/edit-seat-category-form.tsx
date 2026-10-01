"use client";

import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { useUpdateSeatCategoryForm } from "@/features/seat-categories/hooks/use-update-seat-category-form";
import { SeatCategoryForm } from "@/features/seat-categories/components/seat-category-form";
import type { SeatCategory } from "@/features/seat-categories/types";

interface EditSeatCategoryFormProps {
  seatCategory: SeatCategory;
}

export function EditSeatCategoryForm({
  seatCategory,
}: EditSeatCategoryFormProps) {
  const { form, onSubmit, isPending, result } = useUpdateSeatCategoryForm({
    seatCategoryId: seatCategory.id,
    defaultValues: {
      name: seatCategory.name,
      description: seatCategory.description ?? "",
      min_child_age: seatCategory.min_child_age,
      max_child_age: seatCategory.max_child_age,
      safety_standard: seatCategory.safety_standard,
    },
  });
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {result && !result.success && (
        <Alert variant="destructive">
          <AlertTitle>Could not update seat category</AlertTitle>
          <AlertDescription>{result.error?.message}</AlertDescription>
        </Alert>
      )}

      <SeatCategoryForm
        mode="edit"
        register={register}
        errors={errors}
        isPending={isPending}
      />

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save changes"}
        </Button>
        <Link
          href={`/seat-categories/${seatCategory.id}`}
          className={buttonVariants({ variant: "outline" })}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
