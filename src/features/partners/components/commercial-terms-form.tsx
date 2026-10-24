"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useCommercialTermsForm } from "@/features/partners/hooks/use-commercial-terms-form";
import type { CommercialTermsInput } from "@/features/partners/schemas/commercial-terms.schema";

interface CommercialTermsFormProps {
  partnerId: string;
  today: string;
  defaultValues: CommercialTermsInput;
}

/**
 * VI-F04 S1: set the commercial terms of a partner. Saving adds a version that starts on the
 * effective date; the earlier terms stay as they were (R1). Only shown to an admin.
 */
export function CommercialTermsForm({ partnerId, today, defaultValues }: CommercialTermsFormProps) {
  const { form, onSubmit, isPending, result, platformShare } = useCommercialTermsForm({
    partnerId,
    today,
    defaultValues,
  });
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-lg flex-col gap-5">
      {result?.success && (
        <Alert variant="success">
          <AlertTitle>Terms saved</AlertTitle>
          <AlertDescription>The new terms are saved with their effective date.</AlertDescription>
        </Alert>
      )}
      {result && !result.success && !result.error?.field && (
        <Alert variant="destructive">
          <AlertTitle>Could not save the terms</AlertTitle>
          <AlertDescription>{result.error?.message}</AlertDescription>
        </Alert>
      )}

      <Field data-invalid={!!errors.partner_share_percent}>
        <FieldLabel htmlFor="partner_share_percent">Partner share (%)</FieldLabel>
        <Input
          id="partner_share_percent"
          type="number"
          step="0.01"
          inputMode="decimal"
          aria-invalid={!!errors.partner_share_percent}
          disabled={isPending}
          {...register("partner_share_percent", { valueAsNumber: true })}
        />
        <FieldError errors={errors.partner_share_percent ? [errors.partner_share_percent] : undefined} />
      </Field>

      <div>
        <p className="text-sm text-muted-foreground">Platform share (%)</p>
        <p className="mt-1 text-sm text-foreground" data-testid="platform-share">
          {platformShare === null ? "-" : platformShare}
        </p>
      </div>

      <Field data-invalid={!!errors.launch_partner_share_percent}>
        <FieldLabel htmlFor="launch_partner_share_percent">Launch partner share (%)</FieldLabel>
        <Input
          id="launch_partner_share_percent"
          type="number"
          step="0.01"
          inputMode="decimal"
          aria-invalid={!!errors.launch_partner_share_percent}
          disabled={isPending}
          {...register("launch_partner_share_percent", { valueAsNumber: true })}
        />
        <FieldError
          errors={errors.launch_partner_share_percent ? [errors.launch_partner_share_percent] : undefined}
        />
      </Field>

      <Field data-invalid={!!errors.effective_from}>
        <FieldLabel htmlFor="effective_from">Effective from</FieldLabel>
        <Input
          id="effective_from"
          type="date"
          min={today}
          aria-invalid={!!errors.effective_from}
          disabled={isPending}
          {...register("effective_from")}
        />
        <FieldError errors={errors.effective_from ? [errors.effective_from] : undefined} />
      </Field>

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save terms"}
        </Button>
      </div>
    </form>
  );
}
