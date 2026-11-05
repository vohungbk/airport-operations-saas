"use client";

import Link from "next/link";
import { Controller } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError as FieldErrorMessage,
  FieldGroup,
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
import { getStatusLook } from "@/lib/status/domain-status";
import { useFlightSimulatorForm } from "@/features/flights/hooks/use-flight-simulator-form";
import { SIMULATOR_STATUSES } from "@/features/flights/schemas/flight-simulator.schema";

interface FlightSimulatorFormProps {
  /** False when the active flight source is not the simulator: Apply is off (spec R4). */
  enabled: boolean;
}

/** VI-F02-S12 (spec S3): flight number, estimated arrival and status, with Apply and Cancel. */
export function FlightSimulatorForm({ enabled }: FlightSimulatorFormProps) {
  const { form, onSubmit, isPending, result } = useFlightSimulatorForm();
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const locked = isPending || !enabled;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {!enabled && (
        <Alert>
          <AlertTitle>The simulator is off</AlertTitle>
          <AlertDescription>
            Apply is available only when the active flight source is the simulator.
          </AlertDescription>
        </Alert>
      )}
      {result && !result.success && (
        <Alert variant="destructive">
          <AlertTitle>Could not apply the change</AlertTitle>
          <AlertDescription>{result.error?.message}</AlertDescription>
        </Alert>
      )}

      <FieldGroup>
        <Field data-invalid={!!errors.flight_number}>
          <FieldLabel htmlFor="flight_number">Flight number</FieldLabel>
          <Input
            id="flight_number"
            aria-invalid={!!errors.flight_number}
            aria-describedby="flight_number-hint flight_number-error"
            disabled={locked}
            {...register("flight_number")}
          />
          <FieldDescription id="flight_number-hint">
            The flight of a test booking. For example VN123.
          </FieldDescription>
          <FieldErrorMessage id="flight_number-error" errors={errors.flight_number ? [errors.flight_number] : undefined} />
        </Field>

        <Field data-invalid={!!errors.estimated_arrival_at}>
          <FieldLabel htmlFor="estimated_arrival_at">Estimated arrival</FieldLabel>
          <Input
            id="estimated_arrival_at"
            type="datetime-local"
            aria-invalid={!!errors.estimated_arrival_at}
            aria-describedby="estimated_arrival_at-hint estimated_arrival_at-error"
            disabled={locked}
            {...register("estimated_arrival_at")}
          />
          <FieldDescription id="estimated_arrival_at-hint">Time at the airport of the flight.</FieldDescription>
          <FieldErrorMessage
            id="estimated_arrival_at-error"
            errors={errors.estimated_arrival_at ? [errors.estimated_arrival_at] : undefined}
          />
        </Field>

        <Field data-invalid={!!errors.status}>
          <FieldLabel htmlFor="status">Status</FieldLabel>
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
                  aria-describedby="status-error"
                  className="w-full"
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
          <FieldErrorMessage id="status-error" errors={errors.status ? [errors.status] : undefined} />
        </Field>
      </FieldGroup>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={locked}>
          {isPending ? "Applying..." : "Apply"}
        </Button>
        <Link href="/flights" className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
