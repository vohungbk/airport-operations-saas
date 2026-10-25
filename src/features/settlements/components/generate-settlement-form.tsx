"use client";

import { Controller } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGenerateSettlementForm } from "@/features/settlements/hooks/use-generate-settlement-form";
import type { SettlementPartnerOption } from "@/features/settlements/lib/get-settlement-partners";
import { currentMonth } from "@/features/settlements/schemas/settlement.schema";

interface GenerateSettlementFormProps {
  partners: SettlementPartnerOption[];
}

/**
 * VI-F04 S4 (R7, F10): choose a partner and a month, then Generate. A draft settlement is created
 * and the list is shown again (NAV-5). Presentation only: the rules are in the schema, the Server
 * Action and the database function.
 */
export function GenerateSettlementForm({ partners }: GenerateSettlementFormProps) {
  const { form, onSubmit, isPending, result } = useGenerateSettlementForm();
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-lg flex-col gap-5">
      {result && !result.success && !result.error?.field && (
        <Alert variant="destructive">
          <AlertTitle>Could not generate the settlement</AlertTitle>
          <AlertDescription>{result.error?.message}</AlertDescription>
        </Alert>
      )}

      <Field data-invalid={!!errors.partner_id}>
        <FieldLabel htmlFor="partner_id">Partner</FieldLabel>
        <Controller
          control={control}
          name="partner_id"
          render={({ field }) => (
            <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={isPending}>
              <SelectTrigger id="partner_id" aria-invalid={!!errors.partner_id}>
                <SelectValue placeholder="Choose a partner" />
              </SelectTrigger>
              <SelectContent>
                {partners.map((partner) => (
                  <SelectItem key={partner.value} value={partner.value}>
                    {partner.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FieldError errors={errors.partner_id ? [errors.partner_id] : undefined} />
      </Field>

      <Field data-invalid={!!errors.month}>
        <FieldLabel htmlFor="month">Month</FieldLabel>
        <Input
          id="month"
          type="month"
          max={currentMonth()}
          aria-invalid={!!errors.month}
          disabled={isPending}
          {...register("month")}
        />
        <FieldError errors={errors.month ? [errors.month] : undefined} />
      </Field>

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Generating..." : "Generate"}
        </Button>
      </div>
    </form>
  );
}
