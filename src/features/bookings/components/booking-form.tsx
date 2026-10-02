"use client";

import type {
  FieldError,
  FieldErrors,
  FieldValues,
  Path,
  UseFormRegister,
} from "react-hook-form";

import {
  Field,
  FieldDescription,
  FieldError as FieldErrorMessage,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AvailableSeat } from "@/features/bookings/actions/get-available-seats.action";
import type { BookingFormOptions } from "@/features/bookings/lib/get-booking-form-options";
import type {
  CreateBookingInput,
  UpdateBookingInput,
} from "@/features/bookings/schemas/booking.schema";

interface SeatPickerState {
  isReady: boolean;
  isLoading: boolean;
  seats: AvailableSeat[];
  failed: boolean;
}

type CreateModeProps = {
  mode: "create";
  register: UseFormRegister<CreateBookingInput>;
  errors: FieldErrors<CreateBookingInput>;
  isPending: boolean;
  options: BookingFormOptions;
  availableSeats: SeatPickerState;
  timeZone: string | null;
};

type EditModeProps = {
  mode: "edit";
  register: UseFormRegister<UpdateBookingInput>;
  errors: FieldErrors<UpdateBookingInput>;
  isPending: boolean;
  availableSeats: SeatPickerState;
  timeZone: string;
  /** The seat already on the booking, kept selectable even if no longer "available". */
  currentSeat: AvailableSeat | null;
};

type BookingFormProps = CreateModeProps | EditModeProps;

const CONTROL_CLASS =
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30";

function describedBy(name: string, error?: FieldError, hint?: string) {
  const ids = [];
  if (hint) ids.push(`${name}-hint`);
  if (error) ids.push(`${name}-error`);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

interface FieldShellProps<TFieldValues extends FieldValues> {
  name: string;
  label: string;
  register: UseFormRegister<TFieldValues>;
  errors: FieldErrors<TFieldValues>;
  isPending: boolean;
  hint?: string;
}

function fieldError<TFieldValues extends FieldValues>(
  errors: FieldErrors<TFieldValues>,
  name: string,
): FieldError | undefined {
  return (errors as Record<string, FieldError | undefined>)[name];
}

function TextField<TFieldValues extends FieldValues>({
  name,
  label,
  register,
  errors,
  isPending,
  hint,
  type = "text",
}: FieldShellProps<TFieldValues> & {
  type?: "text" | "number" | "datetime-local";
}) {
  const error = fieldError(errors, name);

  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input
        id={name}
        type={type}
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? "any" : undefined}
        aria-invalid={!!error}
        aria-describedby={describedBy(name, error, hint)}
        disabled={isPending}
        {...register(name as Path<TFieldValues>)}
      />
      {hint && <FieldDescription id={`${name}-hint`}>{hint}</FieldDescription>}
      <FieldErrorMessage
        id={`${name}-error`}
        errors={error ? [error] : undefined}
      />
    </Field>
  );
}

function SelectField<TFieldValues extends FieldValues>({
  name,
  label,
  register,
  errors,
  isPending,
  hint,
  placeholder = "Select...",
  choices,
}: FieldShellProps<TFieldValues> & {
  placeholder?: string;
  choices: { value: string; label: string }[];
}) {
  const error = fieldError(errors, name);

  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <select
        id={name}
        aria-invalid={!!error}
        aria-describedby={describedBy(name, error, hint)}
        disabled={isPending}
        className={cn(CONTROL_CLASS, "h-8 py-1")}
        {...register(name as Path<TFieldValues>)}
      >
        <option value="">{placeholder}</option>
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
      {hint && <FieldDescription id={`${name}-hint`}>{hint}</FieldDescription>}
      <FieldErrorMessage
        id={`${name}-error`}
        errors={error ? [error] : undefined}
      />
    </Field>
  );
}

function TextAreaField<TFieldValues extends FieldValues>({
  name,
  label,
  register,
  errors,
  isPending,
}: FieldShellProps<TFieldValues>) {
  const error = fieldError(errors, name);

  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <textarea
        id={name}
        rows={3}
        aria-invalid={!!error}
        aria-describedby={describedBy(name, error)}
        disabled={isPending}
        className={CONTROL_CLASS}
        {...register(name as Path<TFieldValues>)}
      />
      <FieldErrorMessage
        id={`${name}-error`}
        errors={error ? [error] : undefined}
      />
    </Field>
  );
}

interface SharedFieldsProps<TFieldValues extends FieldValues> {
  register: UseFormRegister<TFieldValues>;
  errors: FieldErrors<TFieldValues>;
  isPending: boolean;
  availableSeats: SeatPickerState;
  timeZone: string | null;
  currentSeat: AvailableSeat | null;
}

/** Fields editable in both modes. */
function SharedFields<TFieldValues extends FieldValues>({
  register,
  errors,
  isPending,
  availableSeats,
  timeZone,
  currentSeat,
}: SharedFieldsProps<TFieldValues>) {
  const shell = { register, errors, isPending };
  const timeHint = timeZone
    ? `Local time at the airport (${timeZone}).`
    : "Local time at the selected airport.";

  const seatChoices = [...availableSeats.seats];
  if (currentSeat && !seatChoices.some((seat) => seat.id === currentSeat.id)) {
    seatChoices.unshift(currentSeat);
  }

  let seatHint = "Optional. You can assign a seat later.";
  if (!availableSeats.isReady) {
    seatHint = "Choose airport, category, pickup and return to list seats.";
  } else if (availableSeats.isLoading) {
    seatHint = "Loading available seats...";
  } else if (availableSeats.failed) {
    seatHint = "Could not load available seats.";
  } else if (seatChoices.length === 0) {
    seatHint = "No seats are available for this period.";
  }

  return (
    <>
      <TextField
        {...shell}
        name="pickup_at"
        label="Pickup"
        type="datetime-local"
        hint={timeHint}
      />
      <TextField
        {...shell}
        name="return_at"
        label="Return"
        type="datetime-local"
        hint={timeHint}
      />
      <SelectField
        {...shell}
        name="assigned_seat_id"
        label="Seat"
        placeholder="No seat (assign later)"
        hint={seatHint}
        choices={seatChoices.map((seat) => ({
          value: seat.id,
          label: seat.serial_number,
        }))}
      />
      <TextField
        {...shell}
        name="external_booking_number"
        label="External booking number"
      />
      <TextField {...shell} name="child_age_band" label="Child age band" />
      <TextField
        {...shell}
        name="child_height"
        label="Child height"
        type="number"
      />
      <TextField {...shell} name="vehicle" label="Vehicle" />
      <TextField {...shell} name="vehicle_bay" label="Vehicle bay" />
      <TextAreaField {...shell} name="notes" label="Notes" />
    </>
  );
}

/**
 * Shared fields for create and edit. Partner, airport, category and
 * `daily_rate` exist only on create (read-only afterwards); `status` and
 * `booking_number` are never form fields.
 */
export function BookingForm(props: BookingFormProps) {
  if (props.mode === "create") {
    const { register, errors, isPending, options, availableSeats, timeZone } =
      props;
    const shell = { register, errors, isPending };

    return (
      <FieldGroup>
        <SelectField
          {...shell}
          name="partner_id"
          label="Partner"
          choices={options.partners}
        />
        <SelectField
          {...shell}
          name="airport_id"
          label="Airport"
          choices={options.airports}
        />
        <SelectField
          {...shell}
          name="seat_category_id"
          label="Seat category"
          choices={options.categories}
        />
        <TextField
          {...shell}
          name="daily_rate"
          label="Daily rate"
          type="number"
          hint="Cannot be changed after the booking is created."
        />
        <SharedFields
          {...shell}
          availableSeats={availableSeats}
          timeZone={timeZone}
          currentSeat={null}
        />
      </FieldGroup>
    );
  }

  const { register, errors, isPending, availableSeats, timeZone, currentSeat } =
    props;

  return (
    <FieldGroup>
      <SharedFields
        register={register}
        errors={errors}
        isPending={isPending}
        availableSeats={availableSeats}
        timeZone={timeZone}
        currentSeat={currentSeat}
      />
    </FieldGroup>
  );
}
