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
import { JobActionErrorAlert } from "@/features/jobs/components/job-action-error-alert";
import { isJobUnavailableError } from "@/features/jobs/lib/job-errors";
import { useChangeJobStatusForm } from "@/features/jobs/hooks/use-change-job-status-form";
import {
  JOB_STATUS_LABEL,
  isJobReasonRequired,
  type JobStatus,
  type JobTargetStatus,
} from "@/features/jobs/lib/job-status";

interface ChangeJobStatusDialogProps {
  jobId: string;
  jobLabel: string;
  currentStatus: JobStatus;
  allowedStatuses: JobTargetStatus[];
}

/**
 * Only serializable props cross the Server->Client boundary. Targets are
 * the transitions the server computed for this user; the database
 * re-validates regardless.
 */
export function ChangeJobStatusDialog({
  jobId,
  jobLabel,
  currentStatus,
  allowedStatuses,
}: ChangeJobStatusDialogProps) {
  const [open, setOpen] = useState(false);
  const { form, onSubmit, isPending, result, reset } = useChangeJobStatusForm({
    jobId,
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
  const reasonRequired = isJobReasonRequired(target);
  // The job is out of reach (e.g. unassigned): confirming again cannot work.
  const unavailable = isJobUnavailableError(result?.error);

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
            <DialogTitle>Update status of {jobLabel}</DialogTitle>
            <DialogDescription>
              Completed and cancelled jobs cannot be changed again. Every change
              is kept in the job history.
            </DialogDescription>
          </DialogHeader>

          {result && !result.success && result.error && (
            <JobActionErrorAlert error={result.error} />
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
                    label: JOB_STATUS_LABEL[status],
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
                        {JOB_STATUS_LABEL[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          {reasonRequired && (
            <Field data-invalid={!!errors.reason}>
              <FieldLabel htmlFor="reason">Reason</FieldLabel>
              <Textarea
                id="reason"
                rows={3}
                aria-invalid={!!errors.reason}
                aria-describedby={errors.reason ? "reason-error" : undefined}
                disabled={isPending}
                {...register("reason")}
              />
              <FieldErrorMessage
                id="reason-error"
                errors={errors.reason ? [errors.reason] : undefined}
              />
            </Field>
          )}

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
              <Button
                type="submit"
                variant={reasonRequired ? "destructive" : "default"}
                disabled={isPending}
              >
                {isPending ? "Saving..." : "Confirm"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
