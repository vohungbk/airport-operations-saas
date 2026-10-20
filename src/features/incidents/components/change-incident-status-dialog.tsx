"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { cn } from "@/lib/utils";
import { IncidentActionErrorAlert } from "@/features/incidents/components/incident-action-error-alert";
import { useChangeIncidentStatusForm } from "@/features/incidents/hooks/use-change-incident-status-form";
import { isIncidentUnavailableError } from "@/features/incidents/lib/incident-errors";
import {
  INCIDENT_STATUS_LABEL,
  isIncidentNoteRequired,
  type IncidentStatus,
} from "@/features/incidents/lib/incident-status";

interface ChangeIncidentStatusDialogProps {
  incidentId: string;
  incidentLabel: string;
  currentStatus: IncidentStatus;
  allowedStatuses: IncidentStatus[];
}

const CONTROL_CLASS =
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30";

/**
 * Only serializable props cross the Server->Client boundary. Targets are the
 * transitions the server computed; the database re-validates regardless.
 */
export function ChangeIncidentStatusDialog({
  incidentId,
  incidentLabel,
  currentStatus,
  allowedStatuses,
}: ChangeIncidentStatusDialogProps) {
  const [open, setOpen] = useState(false);
  const { form, onSubmit, isPending, result, reset } =
    useChangeIncidentStatusForm({
      incidentId,
      currentStatus,
      defaultStatus: allowedStatuses[0],
      onSuccess: () => setOpen(false),
    });
  const {
    register,
    watch,
    formState: { errors },
  } = form;
  const target = watch("to_status");
  const noteRequired = isIncidentNoteRequired(currentStatus, target);
  // The incident is out of reach: confirming again cannot work.
  const unavailable = isIncidentUnavailableError(result?.error);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) reset();
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        Update status
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Update status of {incidentLabel}</DialogTitle>
            <DialogDescription>
              Closed incidents cannot be changed again. Every change is kept in
              the incident history.
            </DialogDescription>
          </DialogHeader>

          {result && !result.success && result.error && (
            <IncidentActionErrorAlert error={result.error} />
          )}

          <Field data-invalid={!!errors.to_status}>
            <FieldLabel htmlFor="to_status">New status</FieldLabel>
            <select
              id="to_status"
              disabled={isPending}
              className={cn(CONTROL_CLASS, "h-8 py-1")}
              {...register("to_status")}
            >
              {allowedStatuses.map((status) => (
                <option key={status} value={status}>
                  {INCIDENT_STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </Field>

          <Field data-invalid={!!errors.note}>
            <FieldLabel htmlFor="note">
              {noteRequired ? "Note" : "Note (optional)"}
            </FieldLabel>
            <textarea
              id="note"
              rows={3}
              aria-invalid={!!errors.note}
              aria-describedby={errors.note ? "note-error" : undefined}
              disabled={isPending}
              className={CONTROL_CLASS}
              {...register("note")}
            />
            <FieldErrorMessage
              id="note-error"
              errors={errors.note ? [errors.note] : undefined}
            />
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            {!unavailable && (
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Confirm"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
