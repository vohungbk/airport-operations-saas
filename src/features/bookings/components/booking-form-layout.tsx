"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { useState, type FormEventHandler, type ReactNode } from "react";
import type { FieldErrors } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BookingActionResult } from "@/features/bookings/lib/booking-errors";
import { formatTimeZoneLabel } from "@/features/bookings/lib/booking-time";

/** The fields of the form in the order they are shown. */
const FIELD_ORDER = [
  "partner_id",
  "airport_id",
  "external_booking_number",
  "pickup_at",
  "return_at",
  "child_age_band",
  "child_height",
  "seat_category_id",
  "assigned_seat_id",
  "daily_rate",
  "flight_number",
  "vehicle",
  "vehicle_bay",
  "notes",
];

/** The message of every failing field, in the order of the form. */
export function collectFieldMessages(errors: FieldErrors): string[] {
  const byName = errors as Record<string, { message?: unknown } | undefined>;

  return FIELD_ORDER.flatMap((name) => {
    const message = byName[name]?.message;

    return typeof message === "string" ? [message] : [];
  });
}

interface BookingFormLayoutProps {
  /** The last part of the small path above the title: `Create` or `BK-2026-000123 / Edit`. */
  crumb: string;
  title: string;
  onSubmit: FormEventHandler<HTMLFormElement>;
  errors: FieldErrors;
  /** The server answer of the last save; a failure shows above the form. */
  result: BookingActionResult | null;
  failureTitle: string;
  isDirty: boolean;
  isPending: boolean;
  submitLabel: string;
  pendingLabel: string;
  cancelHref: string;
  /** The airport time zone, when it is known. */
  timeZone: string | null;
  children: ReactNode;
}

/**
 * The page of a booking form (design D2): path and title, the error summary, the card with the
 * sections, and a bar at the bottom with Cancel and Save. Cancel asks first when the form has
 * unsaved changes.
 */
export function BookingFormLayout({
  crumb,
  title,
  onSubmit,
  errors,
  result,
  failureTitle,
  isDirty,
  isPending,
  submitLabel,
  pendingLabel,
  cancelHref,
  timeZone,
  children,
}: BookingFormLayoutProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const messages = collectFieldMessages(errors);
  const failure = result && !result.success ? result.error : undefined;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-1 flex-col"
      data-slot="booking-form"
    >
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-8">
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">Bookings / {crumb}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
        </div>

        {failure && (
          <Alert variant="destructive">
            <AlertTitle>{failureTitle}</AlertTitle>
            <AlertDescription>
              <p>{failure.message}</p>
              {failure.code === "STALE_DATA" && (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 w-fit"
                  onClick={() => router.refresh()}
                >
                  Refresh
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="rounded-xl border border-border bg-card p-4 text-card-foreground md:p-5">
          {messages.length > 0 && (
            <div
              role="alert"
              data-slot="error-summary"
              className="-mx-4 -mt-4 mb-4 flex gap-2 rounded-t-xl border-b border-border bg-info-bg px-4 py-3 text-sm text-info-fg md:-mx-5 md:-mt-5 md:mb-5 md:px-5"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div className="flex flex-col gap-0.5">
                <p className="font-medium">Check the highlighted fields</p>
                {messages.map((message) => (
                  <p key={message}>{message}</p>
                ))}
              </div>
            </div>
          )}
          {children}
        </div>
      </div>

      <div className="sticky bottom-[calc(68px+env(safe-area-inset-bottom))] z-30 flex items-center justify-between gap-3 border-t border-border bg-background px-4 py-3 md:bottom-0 md:px-8">
        <p className="hidden text-xs text-muted-foreground sm:block">
          * Required{timeZone ? ` · All times ${formatTimeZoneLabel(timeZone)}` : ""}
        </p>
        <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
          {isDirty ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 min-w-[94px]"
              onClick={() => setConfirmOpen(true)}
            >
              Cancel
            </Button>
          ) : (
            <Link
              href={cancelHref}
              className={buttonVariants({ variant: "outline", className: "min-h-11 min-w-[94px]" })}
            >
              Cancel
            </Link>
          )}
          <Button type="submit" className="min-h-11 min-w-[170px]" disabled={isPending}>
            {isPending ? pendingLabel : submitLabel}
          </Button>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Discard changes?</DialogTitle>
            <DialogDescription>
              Your unsaved booking changes will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="m-0 flex-row gap-3 border-0 bg-transparent p-0 sm:justify-stretch">
            <Button
              type="button"
              className="min-h-11 flex-1"
              onClick={() => setConfirmOpen(false)}
            >
              Keep editing
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 flex-1 bg-surface"
              onClick={() => router.push(cancelHref)}
            >
              Discard changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
