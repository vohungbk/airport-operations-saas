"use client";

import type { ReactNode } from "react";
import { Controller } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DatePicker } from "@/components/ui/date-picker";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TermsMoneyInput } from "@/features/partners/components/terms-money-input";
import { useCommercialTermsForm } from "@/features/partners/hooks/use-commercial-terms-form";
import {
  COMMERCIAL_TERMS_FORM_ID,
  formatTermsDate,
  paymentTermsLabel,
  paymentTermsOptions,
} from "@/features/partners/lib/commercial-terms";
import type { CommercialTermsInput } from "@/features/partners/schemas/commercial-terms.schema";

const HINT_CLASS = "text-xs text-muted-foreground";

interface CommercialTermsFormProps {
  partnerId: string;
  today: string;
  defaultValues: CommercialTermsInput;
  /** Only an admin changes the terms; anyone else reads them in the same layout, with the fields off. */
  canEdit: boolean;
}

function Hint({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <p className={HINT_CLASS} data-testid={testId}>
      {children}
    </p>
  );
}

/**
 * VI-F04 S1: the "Revenue and programme terms" card of the design. Saving adds a version that
 * starts on the effective date; the earlier terms stay as they were (R1). The Save button is in the
 * page header and submits this form by its id. Presentation only: the rules are in the schema, the
 * Server Action and the database function.
 */
export function CommercialTermsForm({ partnerId, today, defaultValues, canEdit }: CommercialTermsFormProps) {
  const { form, onSubmit, isPending, result, platformShare } = useCommercialTermsForm({
    partnerId,
    today,
    defaultValues,
  });
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const locked = isPending || !canEdit;

  return (
    <form
      id={COMMERCIAL_TERMS_FORM_ID}
      onSubmit={onSubmit}
      noValidate
      className="flex min-w-0 flex-col gap-6 rounded-xl border bg-card p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-foreground">Revenue and programme terms</h2>
        <p className="text-sm text-muted-foreground">Define revenue sharing and programme charges.</p>
      </div>

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

      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        <Field data-invalid={!!errors.partner_share_percent}>
          <FieldLabel htmlFor="partner_share_percent">Standard partner share (%)</FieldLabel>
          <Input
            id="partner_share_percent"
            type="number"
            step="0.01"
            inputMode="decimal"
            className="h-11"
            aria-invalid={!!errors.partner_share_percent}
            disabled={locked}
            {...register("partner_share_percent", { valueAsNumber: true })}
          />
          <FieldError errors={errors.partner_share_percent ? [errors.partner_share_percent] : undefined} />
          <Hint>
            Platform share: <span data-testid="platform-share">{platformShare === null ? "-" : `${platformShare}%`}</span>
            {" · Allowed range: 0–100%"}
          </Hint>
        </Field>

        <Field data-invalid={!!errors.launch_partner_share_percent}>
          <FieldLabel htmlFor="launch_partner_share_percent">Launch partner share (%)</FieldLabel>
          <Input
            id="launch_partner_share_percent"
            type="number"
            step="0.01"
            inputMode="decimal"
            className="h-11"
            aria-invalid={!!errors.launch_partner_share_percent}
            disabled={locked}
            {...register("launch_partner_share_percent", { valueAsNumber: true })}
          />
          <FieldError
            errors={errors.launch_partner_share_percent ? [errors.launch_partner_share_percent] : undefined}
          />
          <Hint>Must be at least the standard partner share.</Hint>
        </Field>

        <Field data-invalid={!!errors.launch_credit_target}>
          <FieldLabel htmlFor="launch_credit_target">Launch credit target (USD)</FieldLabel>
          <Controller
            control={control}
            name="launch_credit_target"
            render={({ field }) => (
              <TermsMoneyInput
                id="launch_credit_target"
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={locked}
                invalid={!!errors.launch_credit_target}
                optional
              />
            )}
          />
          <FieldError errors={errors.launch_credit_target ? [errors.launch_credit_target] : undefined} />
          <Hint>Exact amount · 2 decimal places</Hint>
        </Field>

        <Field data-invalid={!!errors.annual_fee}>
          <FieldLabel htmlFor="annual_fee">Annual programme fee (USD)</FieldLabel>
          <Controller
            control={control}
            name="annual_fee"
            render={({ field }) => (
              <TermsMoneyInput
                id="annual_fee"
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={locked}
                invalid={!!errors.annual_fee}
              />
            )}
          />
          <FieldError errors={errors.annual_fee ? [errors.annual_fee] : undefined} />
          <Hint>Charged annually</Hint>
        </Field>

        <Field data-invalid={!!errors.onboarding_fee}>
          <FieldLabel htmlFor="onboarding_fee">Onboarding credit (USD)</FieldLabel>
          <Controller
            control={control}
            name="onboarding_fee"
            render={({ field }) => (
              <TermsMoneyInput
                id="onboarding_fee"
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={locked}
                invalid={!!errors.onboarding_fee}
              />
            )}
          />
          <FieldError errors={errors.onboarding_fee ? [errors.onboarding_fee] : undefined} />
          <Hint>One-time credit</Hint>
        </Field>

        <Field data-invalid={!!errors.vat_rate_percent}>
          <FieldLabel htmlFor="vat_rate_percent">VAT (%)</FieldLabel>
          <Input
            id="vat_rate_percent"
            type="number"
            step="0.01"
            min={0}
            inputMode="decimal"
            className="h-11"
            aria-invalid={!!errors.vat_rate_percent}
            disabled={locked}
            {...register("vat_rate_percent", { valueAsNumber: true })}
          />
          <FieldError errors={errors.vat_rate_percent ? [errors.vat_rate_percent] : undefined} />
          <Hint>Allowed range: 0–100%</Hint>
        </Field>

        <Field data-invalid={!!errors.payment_terms_days}>
          <FieldLabel htmlFor="payment_terms_days">Payment terms</FieldLabel>
          <Controller
            control={control}
            name="payment_terms_days"
            render={({ field }) => {
              const items = paymentTermsOptions(defaultValues.payment_terms_days).map((days) => ({
                value: String(days),
                label: paymentTermsLabel(days),
              }));

              return (
                <Select
                  value={String(field.value)}
                  items={items}
                  disabled={locked}
                  onValueChange={(value) => field.onChange(Number(value))}
                >
                  <SelectTrigger
                    id="payment_terms_days"
                    aria-invalid={!!errors.payment_terms_days}
                    className="h-11 w-full data-[size=default]:h-11"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );
            }}
          />
          <FieldError errors={errors.payment_terms_days ? [errors.payment_terms_days] : undefined} />
          <Hint>Payment due after issue</Hint>
        </Field>

        <Field data-invalid={!!errors.effective_from}>
          <FieldLabel htmlFor="effective_from">Effective date</FieldLabel>
          <Controller
            control={control}
            name="effective_from"
            render={({ field }) => (
              <DatePicker
                value={field.value}
                min={today}
                formatValue={formatTermsDate}
                onValueChange={field.onChange}
                disabled={locked}
                aria-invalid={!!errors.effective_from}
                className="h-11"
              />
            )}
          />
          <FieldError errors={errors.effective_from ? [errors.effective_from] : undefined} />
          <Hint>New version takes effect on this date</Hint>
        </Field>
      </div>

      <div className="flex flex-col gap-1 rounded-lg bg-muted px-4 py-3 text-xs text-muted-foreground">
        <p>Share limits: 0–100% · Launch share ≥ standard share</p>
        <p>All monetary values are stored with 2 decimal places.</p>
        {!canEdit && <p>Only an admin can change commercial terms.</p>}
      </div>
    </form>
  );
}
