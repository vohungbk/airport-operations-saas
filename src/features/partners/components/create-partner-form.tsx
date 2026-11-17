"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCreatePartnerForm } from "@/features/partners/hooks/use-create-partner-form";
import { PartnerForm } from "@/features/partners/components/partner-form";
import { PartnerFormFooter } from "@/features/partners/components/partner-form-footer";

const DUPLICATE_CODE_MESSAGE = "This partner code already exists";
export const SAVE_ERROR_MESSAGE =
  "Unable to save your changes. Check your connection and try again. Your entered data has been kept.";

export function CreatePartnerForm() {
  const { form, onSubmit, isPending, result } = useCreatePartnerForm();
  const {
    register,
    control,
    formState: { errors },
  } = form;

  const error = result && !result.success ? result.error : undefined;
  const isDuplicateCode = error?.code === "DUPLICATE_CODE";

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error && !isDuplicateCode && (
        <Alert
          variant="destructive"
          className="border-danger/40 px-4 py-3 text-xs"
        >
          <AlertDescription className="text-xs">{SAVE_ERROR_MESSAGE}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-xl border bg-card p-6">
        <PartnerForm
          mode="create"
          register={register}
          control={control}
          errors={{
            ...errors,
            code: isDuplicateCode
              ? { type: "duplicate", message: DUPLICATE_CODE_MESSAGE }
              : errors.code,
          }}
          isPending={isPending}
        />
        <PartnerFormFooter isPending={isPending} cancelHref="/partners" />
      </div>
    </form>
  );
}
