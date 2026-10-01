"use client";

import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { useCreateSeatCategoryForm } from "@/features/seat-categories/hooks/use-create-seat-category-form";
import { SeatCategoryForm } from "@/features/seat-categories/components/seat-category-form";

export function CreateSeatCategoryForm() {
  const { form, onSubmit, isPending, result } = useCreateSeatCategoryForm();
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {result && !result.success && (
        <Alert variant="destructive">
          <AlertTitle>Could not create seat category</AlertTitle>
          <AlertDescription>{result.error?.message}</AlertDescription>
        </Alert>
      )}

      <SeatCategoryForm
        mode="create"
        register={register}
        errors={errors}
        isPending={isPending}
      />

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating..." : "Create seat category"}
        </Button>
        <Link
          href="/seat-categories"
          className={buttonVariants({ variant: "outline" })}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
