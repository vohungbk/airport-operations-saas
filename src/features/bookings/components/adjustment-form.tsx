"use client";

import { Controller } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/features/bookings/lib/booking-revenue";
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
  /** Called after the adjustment was recorded. */
  onSuccess: () => void;
  /** Cancel closes the dialog without recording anything. */
  onCancel: () => void;
}

/**
 * VI-F04 S3 / UI-F06-T04: record a refund, an adjustment or a chargeback on a booking, in the dialog of
 * the Revenue tab. Every type takes the amount off the revenue, so the amount is shown with a minus.
 */
export function AdjustmentForm({ bookingId, maxAmount, onSuccess, onCancel }: AdjustmentFormProps) {
  const { form, onSubmit, isPending, result } = useAdjustmentForm({
    bookingId,
    maxAmount,
    onSuccess,
  });
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
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
              <SelectTrigger
                id="type"
                aria-invalid={!!errors.type}
                className="data-[size=default]:h-11"
              >
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
        <MoneyInput
          id="amount"
          currency="−"
          maxLength={12}
          aria-invalid={!!errors.amount}
          aria-describedby="amount-note"
          disabled={isPending}
          className="h-11"
          {...register("amount", { valueAsNumber: true })}
        />
        <p id="amount-note" className="text-sm text-muted-foreground">
          This amount reduces the revenue of the booking (up to {formatMoney(maxAmount)}).
        </p>
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

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" className="min-h-11 px-4" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" className="min-h-11 px-4" disabled={isPending}>
          {isPending ? "Saving..." : "Save adjustment"}
        </Button>
      </div>
    </form>
  );
}
