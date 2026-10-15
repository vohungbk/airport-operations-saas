"use client";

import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

const CONTROL_CLASS =
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30";

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
    watch,
    formState: { errors },
  } = form;
  const target = watch("to_status");
  const reasonRequired = isJobReasonRequired(target);

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
            <DialogTitle>Update status of {jobLabel}</DialogTitle>
            <DialogDescription>
              Completed and cancelled jobs cannot be changed again. Every
              change is kept in the job history.
            </DialogDescription>
          </DialogHeader>

          {result && !result.success && (
            <Alert variant="destructive">
              <AlertTitle>Could not update status</AlertTitle>
              <AlertDescription>{result.error?.message}</AlertDescription>
            </Alert>
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
                  {JOB_STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </Field>

          {reasonRequired && (
            <Field data-invalid={!!errors.reason}>
              <FieldLabel htmlFor="reason">Reason</FieldLabel>
              <textarea
                id="reason"
                rows={3}
                aria-invalid={!!errors.reason}
                aria-describedby={errors.reason ? "reason-error" : undefined}
                disabled={isPending}
                className={CONTROL_CLASS}
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
            <Button
              type="submit"
              variant={reasonRequired ? "destructive" : "default"}
              disabled={isPending}
            >
              {isPending ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
