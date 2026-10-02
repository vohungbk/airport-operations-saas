"use client";

import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { useCreateSeatForm } from "@/features/seats/hooks/use-create-seat-form";
import { SeatForm } from "@/features/seats/components/seat-form";
import type { SeatFormOptions } from "@/features/seats/lib/get-seat-form-options";

interface CreateSeatFormProps {
  options: SeatFormOptions;
}

export function CreateSeatForm({ options }: CreateSeatFormProps) {
  const { form, onSubmit, isPending, result } = useCreateSeatForm();
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {result && !result.success && (
        <Alert variant="destructive">
          <AlertTitle>Could not create seat</AlertTitle>
          <AlertDescription>{result.error?.message}</AlertDescription>
        </Alert>
      )}

      <SeatForm
        mode="create"
        register={register}
        errors={errors}
        isPending={isPending}
        options={options}
      />

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating..." : "Create seat"}
        </Button>
        <Link href="/seats" className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
