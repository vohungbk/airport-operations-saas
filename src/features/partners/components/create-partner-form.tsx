"use client";

import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { useCreatePartnerForm } from "@/features/partners/hooks/use-create-partner-form";
import { PartnerForm } from "@/features/partners/components/partner-form";

export function CreatePartnerForm() {
  const { form, onSubmit, isPending, result } = useCreatePartnerForm();
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {result && !result.success && (
        <Alert variant="destructive">
          <AlertTitle>Could not create partner</AlertTitle>
          <AlertDescription>{result.error?.message}</AlertDescription>
        </Alert>
      )}

      <PartnerForm
        mode="create"
        register={register}
        control={control}
        errors={errors}
        isPending={isPending}
      />

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating..." : "Create partner"}
        </Button>
        <Link href="/partners" className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
