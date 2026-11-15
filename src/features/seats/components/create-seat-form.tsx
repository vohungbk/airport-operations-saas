"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useCreateSeatForm } from "@/features/seats/hooks/use-create-seat-form";
import { SeatForm, SeatFormLayout } from "@/features/seats/components/seat-form";
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
    <SeatFormLayout
      formId="create-seat-form"
      title="Create seat"
      cancelHref="/seats"
      submitLabel={isPending ? "Saving..." : "Save"}
      isPending={isPending}
      onSubmit={onSubmit}
      alert={
        result && !result.success ? (
          <Alert variant="destructive">
            <AlertTitle>Could not create seat</AlertTitle>
            <AlertDescription>{result.error?.message}</AlertDescription>
          </Alert>
        ) : undefined
      }
    >
      <SeatForm
        mode="create"
        register={register}
        control={form.control}
        errors={errors}
        isPending={isPending}
        options={options}
      />
    </SeatFormLayout>
  );
}
