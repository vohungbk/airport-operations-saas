"use client";

import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { useUpdatePartnerForm } from "@/features/partners/hooks/use-update-partner-form";
import { PartnerForm } from "@/features/partners/components/partner-form";
import type { Partner } from "@/features/partners/types";

interface EditPartnerFormProps {
  partner: Partner;
}

export function EditPartnerForm({ partner }: EditPartnerFormProps) {
  const { form, onSubmit, isPending, result } = useUpdatePartnerForm({
    partnerId: partner.id,
    defaultValues: {
      name: partner.name,
      contact_email: partner.contact_email,
      status: partner.status,
    },
  });
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {result && !result.success && (
        <Alert variant="destructive">
          <AlertTitle>Could not update partner</AlertTitle>
          <AlertDescription>{result.error?.message}</AlertDescription>
        </Alert>
      )}

      <PartnerForm
        mode="edit"
        register={register}
        control={control}
        errors={errors}
        isPending={isPending}
        code={partner.code}
      />

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save changes"}
        </Button>
        <Link
          href={`/partners/${partner.id}`}
          className={buttonVariants({ variant: "outline" })}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
