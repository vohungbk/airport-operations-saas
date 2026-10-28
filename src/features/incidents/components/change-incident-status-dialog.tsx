"use client";

import { useState } from "react";
import { Controller } from "react-hook-form";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
    control,
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
      <DialogTrigger
        render={<Button variant="outline" className="min-h-11 px-4" />}
      >
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
            <Controller
              control={control}
              name="to_status"
              render={({ field }) => (
                <Select
                  value={field.value}
                  items={allowedStatuses.map((status) => ({
                    value: status,
                    label: INCIDENT_STATUS_LABEL[status],
                  }))}
                  onValueChange={(value) => field.onChange(value)}
                  disabled={isPending}
                >
                  <SelectTrigger id="to_status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {INCIDENT_STATUS_LABEL[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field data-invalid={!!errors.note}>
            <FieldLabel htmlFor="note">
              {noteRequired ? "Note" : "Note (optional)"}
            </FieldLabel>
            <Textarea
              id="note"
              rows={3}
              aria-invalid={!!errors.note}
              aria-describedby={errors.note ? "note-error" : undefined}
              disabled={isPending}
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
