"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Controller } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ChainStepPhotoField } from "@/features/return-queue/components/chain-step-photo-field";
import { useCompleteChainStepForm } from "@/features/return-queue/hooks/use-complete-chain-step-form";
import {
  RETURN_CHAIN_CHECKLIST,
  type RecordedChainStep,
} from "@/features/return-queue/lib/return-chain";
import {
  CHAIN_STEP_RESULT_LABEL,
  CHAIN_STEP_RESULTS,
} from "@/features/return-queue/schemas/complete-chain-step.schema";

const RESULT_ITEMS = CHAIN_STEP_RESULTS.map((value) => ({
  value,
  label: CHAIN_STEP_RESULT_LABEL[value],
}));

interface ReturnChainStepFormProps {
  bookingId: string;
  step: RecordedChainStep;
  /** Where Cancel leads: the Return queue, or the technician's home. */
  backHref: string;
  /** `SEAT-0001 · DXB · 04 Nov 2026`, under the photo heading. */
  photoStamp: string;
  /** The read-only Seat and Booking fields, at the top of the left column. */
  children: ReactNode;
}

/** Record the current step: result, checklist, notes and photos (FO-F08-S02). */
export function ReturnChainStepForm({
  bookingId,
  step,
  backHref,
  photoStamp,
  children,
}: ReturnChainStepFormProps) {
  const { form, onSubmit, isPending, result, setPhotoPaths } =
    useCompleteChainStepForm(bookingId, step);
  const {
    control,
    register,
    formState: { errors },
  } = form;
  const serverError = result && !result.success ? result.error : null;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {serverError && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>The step was not saved</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            {serverError.message}
            {serverError.code === "NETWORK_ERROR" && (
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={onSubmit}
                className="min-h-11 bg-surface px-4"
              >
                Retry
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          {children}

          <Field data-invalid={!!errors.result}>
            <FieldLabel htmlFor="chain-step-result" className="text-sm font-semibold">
              Result *
            </FieldLabel>
            <Controller
              control={control}
              name="result"
              render={({ field }) => (
                <Select
                  value={field.value ?? null}
                  items={RESULT_ITEMS}
                  onValueChange={(value) => field.onChange(value)}
                  disabled={isPending}
                >
                  <SelectTrigger
                    id="chain-step-result"
                    className="min-h-11 w-full data-[size=default]:h-11 sm:max-w-80"
                    aria-invalid={!!errors.result}
                  >
                    <SelectValue placeholder="Select result" />
                  </SelectTrigger>
                  <SelectContent>
                    {RESULT_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldDescription className="text-text-muted">Pass / Fail</FieldDescription>
            <FieldError errors={errors.result ? [errors.result] : undefined} />
          </Field>

          <Controller
            control={control}
            name="checklist"
            render={({ field }) => (
              <fieldset className="flex flex-col gap-2" aria-invalid={!!errors.checklist}>
                <legend className="mb-2 text-sm font-semibold">Checklist</legend>
                {RETURN_CHAIN_CHECKLIST[step].map((item) => (
                  <label
                    key={item.id}
                    className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-surface px-3 text-sm"
                  >
                    <Checkbox
                      checked={field.value[item.id] === true}
                      disabled={isPending}
                      onCheckedChange={(checked) =>
                        field.onChange({ ...field.value, [item.id]: checked === true })
                      }
                    />
                    {item.label}
                  </label>
                ))}
                <FieldError errors={errors.checklist ? [errors.checklist] : undefined} />
              </fieldset>
            )}
          />
        </div>

        <div className="flex flex-col gap-6">
          <Field data-invalid={!!errors.notes}>
            <FieldLabel htmlFor="chain-step-notes" className="text-sm font-semibold">
              Notes
            </FieldLabel>
            <Textarea
              id="chain-step-notes"
              rows={4}
              placeholder="Add inspection notes"
              aria-invalid={!!errors.notes}
              disabled={isPending}
              className="sm:max-w-80"
              {...register("notes")}
            />
            <FieldDescription className="text-text-muted">
              Required when result is Fail
            </FieldDescription>
            <FieldError errors={errors.notes ? [errors.notes] : undefined} />
          </Field>

          <ChainStepPhotoField
            bookingId={bookingId}
            step={step}
            stamp={photoStamp}
            disabled={isPending}
            error={errors.photo_paths?.message}
            onPathsChange={setPhotoPaths}
          />
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Link
          href={backHref}
          className={cn(buttonVariants({ variant: "outline" }), "min-h-11 bg-surface px-4")}
        >
          Cancel
        </Link>
        <Button type="submit" disabled={isPending} className="min-h-11 px-4">
          {isPending ? "Saving…" : "Complete step"}
        </Button>
      </div>
    </form>
  );
}
