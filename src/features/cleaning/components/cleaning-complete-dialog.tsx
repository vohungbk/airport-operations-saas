"use client";

import { useState } from "react";
import { Controller } from "react-hook-form";
import { InfoIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError as FieldErrorMessage,
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
import { CleaningConflictAlert } from "@/features/cleaning/components/cleaning-conflict-alert";
import { isAlreadyRecordedError } from "@/features/cleaning/lib/cleaning-errors";
import { useCompleteCleaningDialog } from "@/features/cleaning/hooks/use-complete-cleaning-dialog";
import { FAILED_NOTES_REQUIRED_MESSAGE } from "@/features/cleaning/schemas/cleaning.schema";
import { isJobUnavailableError } from "@/features/jobs/lib/job-errors";

const RESULT_ITEMS = [
  { value: "passed", label: "Success" },
  { value: "failed", label: "Failed" },
] as const;

const CHECKLIST = ["Cleaned", "Dried", "No damage"] as const;

interface CleaningCompleteDialogProps {
  jobId: string;
  seatSerial: string;
}

/**
 * Complete cleaning, as in the design. The checklist and the photo are shown
 * but not stored yet: the database function takes the result and the notes
 * only, and the photo is connected when ticket 319 is done.
 */
export function CleaningCompleteDialog({
  jobId,
  seatSerial,
}: CleaningCompleteDialogProps) {
  const { open, onOpenChange, form, onSubmit, isPending, result } =
    useCompleteCleaningDialog(jobId, seatSerial);
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = form;
  const [checked, setChecked] = useState<string[]>([...CHECKLIST]);
  const failed = watch("result") === "failed";
  const error = result && !result.success ? result.error : undefined;
  const unavailable = isJobUnavailableError(error);
  const notesError = errors.notes?.message;
  const failedBanner = notesError
    ? FAILED_NOTES_REQUIRED_MESSAGE
    : error
      ? "Could not save. Seat remains out of service. Retry."
      : isPending
        ? "Saving cleaning record. Seat status changes only after confirmation."
        : "Successful completion makes this seat Available";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button className="min-h-11 w-full px-4" />}>
        Complete cleaning
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[560px]">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Complete cleaning
            </DialogTitle>
            <p className="text-sm text-text-muted">{seatSerial}</p>
          </DialogHeader>

          {error && isAlreadyRecordedError(error) && (
            <CleaningConflictAlert
              message="Someone completed this cleaning first. Your result was not saved."
              onViewRecord={() => onOpenChange(false)}
            />
          )}

          <Field data-invalid={!!errors.result}>
            <FieldLabel htmlFor="cleaning-result">Result</FieldLabel>
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
                    id="cleaning-result"
                    className="min-h-11 w-full data-[size=default]:h-11"
                    aria-invalid={!!errors.result}
                  >
                    <SelectValue placeholder="Choose the result" />
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
            <p className="text-sm text-text-muted">Options: Success and Failed</p>
            <FieldErrorMessage
              errors={errors.result ? [errors.result] : undefined}
            />
          </Field>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">
              Completion checklist
            </legend>
            {CHECKLIST.map((item) => (
              <label
                key={item}
                className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-surface px-3 text-sm"
              >
                <Checkbox
                  checked={checked.includes(item)}
                  disabled={isPending}
                  onCheckedChange={(next) =>
                    setChecked((current) =>
                      next
                        ? [...current, item]
                        : current.filter((value) => value !== item),
                    )
                  }
                />
                {item}
              </label>
            ))}
          </fieldset>

          <Field data-invalid={!!notesError}>
            <FieldLabel htmlFor="cleaning-notes">
              {failed ? "Notes *" : "Notes"}
            </FieldLabel>
            <Textarea
              id="cleaning-notes"
              rows={4}
              placeholder={failed ? FAILED_NOTES_REQUIRED_MESSAGE : undefined}
              aria-invalid={!!notesError}
              aria-describedby={notesError ? "cleaning-notes-error" : undefined}
              disabled={isPending}
              {...register("notes")}
            />
            {notesError && (
              <p id="cleaning-notes-error" className="text-sm text-danger-fg">
                {notesError}
              </p>
            )}
            {!notesError && error && !isAlreadyRecordedError(error) && (
              <p className="text-sm text-danger-fg">
                Could not save cleaning. Try again.
              </p>
            )}
          </Field>

          <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
            <p className="text-sm font-semibold">Photo (optional)</p>
            <p className="text-sm text-text-muted">JPG or PNG up to 10 MB</p>
            <Button
              type="button"
              variant="outline"
              disabled
              className="min-h-11 w-full bg-surface"
            >
              Choose files
            </Button>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-info-bg px-3 py-3 text-sm text-info-fg">
            <InfoIcon aria-hidden="true" className="size-4 shrink-0" />
            {failedBanner}
          </div>

          <DialogFooter className="sticky bottom-0 flex-row gap-3 bg-popover pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
              className="min-h-11 flex-1 bg-surface sm:flex-none"
            >
              Cancel
            </Button>
            {!unavailable && (
              <Button
                type="submit"
                disabled={isPending}
                className="min-h-11 flex-[2]"
              >
                {isPending ? "Submitting..." : error ? "Retry" : "Confirm"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
