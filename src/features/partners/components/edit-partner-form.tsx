"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useUpdatePartnerForm } from "@/features/partners/hooks/use-update-partner-form";
import { PartnerForm } from "@/features/partners/components/partner-form";
import { PartnerFormFooter } from "@/features/partners/components/partner-form-footer";
import { SAVE_ERROR_MESSAGE } from "@/features/partners/components/create-partner-form";
import { EDIT_CONFLICT_ERROR } from "@/features/partners/lib/partner-errors";
import type { Partner } from "@/features/partners/types";

interface EditPartnerFormProps {
  partner: Partner;
}

export function EditPartnerForm({ partner }: EditPartnerFormProps) {
  const { form, onSubmit, isPending, result } = useUpdatePartnerForm({
    partnerId: partner.id,
    defaultValues: {
      name: partner.name,
      contact_email: partner.contact_email ?? "",
      contact_name: partner.contact_name ?? "",
      contact_phone: partner.contact_phone ?? "",
      notes: partner.notes ?? "",
      status: partner.status,
      updated_at: partner.updated_at,
    },
  });
  const {
    register,
    control,
    formState: { errors },
  } = form;

  const error = result && !result.success ? result.error : undefined;
  const isConflict = error?.code === "CONFLICT";

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {isConflict && (
        <>
          <Alert className="border-warning/40 bg-warning-bg px-4 py-3 text-warning-fg">
            <AlertDescription className="text-xs text-warning-fg">
              {EDIT_CONFLICT_ERROR.message}
            </AlertDescription>
          </Alert>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-fit bg-surface px-4 dark:bg-surface"
            onClick={() => window.location.reload()}
          >
            Reload
          </Button>
        </>
      )}
      {error && !isConflict && (
        <Alert
          variant="destructive"
          className="border-danger/40 px-4 py-3 text-xs"
        >
          <AlertDescription className="text-xs">{SAVE_ERROR_MESSAGE}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-xl border bg-card p-6">
        <PartnerForm
          mode="edit"
          register={register}
          control={control}
          errors={errors}
          isPending={isPending}
          code={partner.code}
        />
        <PartnerFormFooter
          isPending={isPending}
          cancelHref={`/partners/${partner.id}`}
        />
      </div>
    </form>
  );
}
