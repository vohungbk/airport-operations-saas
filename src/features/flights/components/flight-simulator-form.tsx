"use client";

import Link from "next/link";
import { Controller } from "react-hook-form";
import { TriangleAlertIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError as FieldErrorMessage,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatClock } from "@/features/flights/lib/flight-panel";
import { NO_VALUE } from "@/features/flights/lib/simulator-impact";
import { useFlightSimulatorForm } from "@/features/flights/hooks/use-flight-simulator-form";
import { SIMULATOR_STATUSES } from "@/features/flights/schemas/flight-simulator.schema";
import { formatDate } from "@/features/jobs/lib/job-time";
import { getStatusLook } from "@/lib/status/domain-status";

interface FlightSimulatorFormProps {
  /** False when the active flight source is not the simulator: Apply is off (spec R4). */
  enabled: boolean;
  /** The airport the screen starts with, before a flight is chosen; null when the viewer sees none. */
  airport: { code: string; timezone: string } | null;
}

const CARD = "flex min-w-0 flex-col gap-3.5 rounded-lg border border-border bg-card p-5";
const LABEL = "text-small font-semibold text-foreground";
const HINT = "text-small text-muted-foreground";

function ImpactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-4 text-body">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium break-words text-foreground">{children}</dd>
    </div>
  );
}

/**
 * VI-F02-T02 (Figma D7): the banner for the source, the Flight simulation form card (the scheduled arrival as
 * read-only text, then Flight number, Estimated arrival and Status in a row, then Cancel and Apply change) and the
 * Calculated operational impact card. The impact follows the values typed and shows a dash for what cannot be
 * worked out yet. The title and the airport line are the page's.
 */
export function FlightSimulatorForm({ enabled, airport }: FlightSimulatorFormProps) {
  const { form, onSubmit, isPending, result, preview, impact } = useFlightSimulatorForm();
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const locked = isPending || !enabled;
  const timeZone = preview?.time_zone ?? airport?.timezone ?? "UTC";
  const airportCode = preview?.airport_code ?? airport?.code;
  const scheduled = preview
    ? `${formatDate(preview.scheduled_arrival_at, timeZone)} · ${formatClock(preview.scheduled_arrival_at, timeZone)} · ${timeZone}`
    : NO_VALUE;

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-w-0 flex-col gap-4">
      {enabled ? (
        <div
          role="status"
          className="rounded-[10px] border border-info-fg bg-info-bg p-3.5 text-body font-semibold text-info-fg"
        >
          Simulator source is active. This is simulated flight data.
        </div>
      ) : (
        <Alert>
          <AlertTitle>The simulator is off</AlertTitle>
          <AlertDescription>The active flight source is not the simulator.</AlertDescription>
        </Alert>
      )}

      {result && !result.success && (
        <Alert variant="destructive">
          <AlertTitle>Could not apply the change</AlertTitle>
          <AlertDescription>{result.error?.message}</AlertDescription>
        </Alert>
      )}

      <section aria-labelledby="simulation-form" className={CARD}>
        <h2 id="simulation-form" className="text-h3 font-semibold text-foreground">
          Flight simulation form
        </h2>
        <p className={HINT}>{`Scheduled arrival: ${scheduled} (read-only)`}</p>

        <div className="grid gap-4 md:grid-cols-3">
          <Field data-invalid={!!errors.flight_number} className="gap-1.5">
            <FieldLabel htmlFor="flight_number" className={LABEL}>
              Flight number *
            </FieldLabel>
            <Input
              id="flight_number"
              aria-invalid={!!errors.flight_number}
              aria-describedby="flight_number-hint flight_number-error"
              disabled={locked}
              className="h-11 rounded-md"
              {...register("flight_number")}
            />
            <FieldDescription id="flight_number-hint" className={HINT}>
              {airportCode ? `Required · ${airportCode} airport context` : "Required"}
            </FieldDescription>
            <FieldErrorMessage id="flight_number-error" errors={errors.flight_number ? [errors.flight_number] : undefined} />
          </Field>

          <Field data-invalid={!!errors.estimated_arrival_at} className="gap-1.5">
            <FieldLabel htmlFor="estimated_arrival_at" className={LABEL}>
              Estimated arrival *
            </FieldLabel>
            <Input
              id="estimated_arrival_at"
              type="datetime-local"
              aria-invalid={!!errors.estimated_arrival_at}
              aria-describedby="estimated_arrival_at-hint estimated_arrival_at-error"
              disabled={locked}
              className="h-11 rounded-md"
              {...register("estimated_arrival_at")}
            />
            <FieldDescription id="estimated_arrival_at-hint" className={HINT}>
              {`Required · Airport time, ${timeZone}`}
            </FieldDescription>
            <FieldErrorMessage
              id="estimated_arrival_at-error"
              errors={errors.estimated_arrival_at ? [errors.estimated_arrival_at] : undefined}
            />
          </Field>

          <Field data-invalid={!!errors.status} className="gap-1.5">
            <FieldLabel htmlFor="status" className={LABEL}>
              Status *
            </FieldLabel>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select
                  value={field.value}
                  items={SIMULATOR_STATUSES.map((value) => ({ value, label: getStatusLook("flight", value).label }))}
                  onValueChange={(value) => field.onChange(value)}
                  disabled={locked}
                >
                  <SelectTrigger
                    id="status"
                    aria-invalid={!!errors.status}
                    aria-describedby="status-hint status-error"
                    className="w-full rounded-md data-[size=default]:h-11"
                  >
                    <SelectValue placeholder="Select a status" />
                  </SelectTrigger>
                  <SelectContent>
                    {SIMULATOR_STATUSES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {getStatusLook("flight", value).label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldDescription id="status-hint" className={HINT}>
              Required · Scheduled, Delayed, Landed, Cancelled, or Diverted
            </FieldDescription>
            <FieldErrorMessage id="status-error" errors={errors.status ? [errors.status] : undefined} />
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 flex-1 text-body text-muted-foreground">
            Apply change is enabled only when the active source is Simulator.
          </p>
          <div className="flex items-center gap-2">
            <Link href="/flights" className={buttonVariants({ variant: "outline", className: "min-h-11 rounded-md px-4" })}>
              Cancel
            </Link>
            <Button type="submit" disabled={locked} className="min-h-11 rounded-md px-4">
              {isPending ? "Applying..." : "Apply change"}
            </Button>
          </div>
        </div>
      </section>

      <section aria-labelledby="simulation-impact" className={CARD}>
        <h2 id="simulation-impact" className="text-h3 font-semibold text-foreground">
          Calculated operational impact
        </h2>
        <dl className="flex flex-col gap-2">
          <ImpactRow label="Change">{impact.change}</ImpactRow>
          <ImpactRow label="New priority">
            {impact.priority === "High" ? (
              <span data-slot="impact-priority" className="inline-flex items-center gap-2 text-[13px] font-semibold">
                <TriangleAlertIcon className="size-3.5" aria-hidden="true" />
                High
              </span>
            ) : (
              impact.priority
            )}
          </ImpactRow>
          <ImpactRow label="New installation deadline">{impact.new_deadline}</ImpactRow>
          <ImpactRow label="Previous installation deadline">{impact.previous_deadline}</ImpactRow>
        </dl>
      </section>
    </form>
  );
}
