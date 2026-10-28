"use client";

import Link from "next/link";
import { Controller } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAdjustmentForm } from "@/features/bookings/hooks/use-adjustment-form";
import {
  ADJUSTMENT_TYPES,
  ADJUSTMENT_TYPE_LABEL,
  MAX_REASON_LENGTH,
} from "@/features/bookings/schemas/adjustment.schema";

interface AdjustmentFormProps {
  bookingId: string;
  /** The gross revenue the booking has now. */
  maxAmount: number;
}

/**
 * VI-F04 S3: record a refund, an adjustment or a chargeback on a booking. Save records it and takes
 * the user back to Booking revenue; Cancel goes back without recording anything (NAV-3).
 */
export function AdjustmentForm({ bookingId, maxAmount }: AdjustmentFormProps) {
  const { form, onSubmit, isPending, result } = useAdjustmentForm({
    bookingId,
    maxAmount,
  });
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex max-w-lg flex-col gap-5"
    >
      {result && !result.success && !result.error?.field && (
        <Alert variant="destructive">
          <AlertTitle>Could not record the adjustment</AlertTitle>
          <AlertDescription>{result.error?.message}</AlertDescription>
        </Alert>
      )}

      <Field data-invalid={!!errors.type}>
        <FieldLabel htmlFor="type">Type</FieldLabel>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <Select
              value={field.value ?? ""}
              onValueChange={field.onChange}
              disabled={isPending}
            >
              <SelectTrigger id="type" aria-invalid={!!errors.type}>
                <SelectValue placeholder="Choose a type" />
              </SelectTrigger>
              <SelectContent>
                {ADJUSTMENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {ADJUSTMENT_TYPE_LABEL[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FieldError errors={errors.type ? [errors.type] : undefined} />
      </Field>

      <Field data-invalid={!!errors.amount}>
        <FieldLabel htmlFor="amount">Amount</FieldLabel>
        <Input
          id="amount"
          type="number"
          step="0.01"
          min={0}
          max={maxAmount}
          inputMode="decimal"
          aria-invalid={!!errors.amount}
          disabled={isPending}
          {...register("amount", { valueAsNumber: true })}
        />
        <FieldError errors={errors.amount ? [errors.amount] : undefined} />
      </Field>

      <Field data-invalid={!!errors.reason}>
        <FieldLabel htmlFor="reason">Reason</FieldLabel>
        <Textarea
          id="reason"
          rows={4}
          maxLength={MAX_REASON_LENGTH}
          aria-invalid={!!errors.reason}
          disabled={isPending}
          {...register("reason")}
        />
        <FieldError errors={errors.reason ? [errors.reason] : undefined} />
      </Field>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save adjustment"}
        </Button>
        <Link
          href={`/bookings/${bookingId}/revenue`}
          className={buttonVariants({ variant: "outline" })}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
