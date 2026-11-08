"use client";

import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useBaselineInputsForm } from "@/features/roi/hooks/use-baseline-inputs-form";
import {
  BASELINE_DISCARD_LABEL,
  BASELINE_NOTE,
  BASELINE_SAVE_LABEL,
  BASELINE_SECTIONS,
  baselineLabel,
  baselineStep,
  type BaselineValues,
} from "@/features/roi/lib/baseline-inputs";
import { PARTNER_ROI_ROUTE } from "@/lib/constants/routes";
import { cn } from "@/lib/utils";

interface BaselineInputsFormProps {
  /** The saved baseline; none when the partner has not saved one yet (the Empty state). */
  defaultValues?: BaselineValues;
}

/**
 * The form of the Baseline inputs screen as the design draws it (VI-F05-S05, frame G3): one card with the
 * three groups of fields, the note, and the two buttons. Save goes back to the ROI dashboard (NAV-3) and
 * Discard changes goes back without saving (NAV-4).
 */
export function BaselineInputsForm({ defaultValues }: BaselineInputsFormProps) {
  const { form, onSubmit, isPending, error } = useBaselineInputsForm(defaultValues);
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Could not save the baseline inputs</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card px-5 py-4">
        {BASELINE_SECTIONS.map((section) => (
          <section key={section.id} aria-labelledby={`${section.id}-heading`} className="flex flex-col gap-2">
            <h2 id={`${section.id}-heading`} className="text-base font-semibold text-foreground">
              {section.title}
            </h2>
            <div className="grid gap-x-3 gap-y-3 sm:grid-cols-2">
              {section.fields.map((field) => {
                const fieldError = errors[field.name];

                return (
                  <Field key={field.name} data-invalid={!!fieldError}>
                    <FieldLabel htmlFor={field.name} className="font-semibold text-foreground">
                      {baselineLabel(field)}
                    </FieldLabel>
                    <Input
                      id={field.name}
                      type="number"
                      step={baselineStep(field)}
                      min={0}
                      inputMode="decimal"
                      className="min-h-11 px-3"
                      aria-invalid={!!fieldError}
                      disabled={isPending}
                      {...register(field.name, { valueAsNumber: true })}
                    />
                    <FieldError errors={fieldError ? [fieldError] : undefined} />
                  </Field>
                );
              })}
            </div>
          </section>
        ))}
        <p className="text-sm text-muted-foreground">{BASELINE_NOTE}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={isPending} className="min-h-11 px-4">
          {BASELINE_SAVE_LABEL}
        </Button>
        <Link href={PARTNER_ROI_ROUTE} className={cn(buttonVariants({ variant: "outline" }), "min-h-11 px-4")}>
          {BASELINE_DISCARD_LABEL}
        </Link>
      </div>
    </form>
  );
}
