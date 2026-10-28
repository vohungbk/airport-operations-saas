"use client";

import {
  Controller,
  type Control,
  type FieldError,
  type FieldErrors,
  type FieldValues,
  type Path,
  type UseFormRegister,
} from "react-hook-form";

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
import { Textarea } from "@/components/ui/textarea";
import type { AvailableSeat } from "@/features/bookings/actions/get-available-seats.action";
import type { BookingFormOptions } from "@/features/bookings/lib/get-booking-form-options";
import type {
  CreateBookingInput,
  CreatePartnerBookingInput,
  UpdateBookingInput,
  UpdatePartnerBookingInput,
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
  control: Control<CreateBookingInput>;
  errors: FieldErrors<CreateBookingInput>;
  isPending: boolean;
  options: BookingFormOptions;
  availableSeats: SeatPickerState;
  timeZone: string | null;
};

type EditModeProps = {
  mode: "edit";
  register: UseFormRegister<UpdateBookingInput>;
  control: Control<UpdateBookingInput>;
  errors: FieldErrors<UpdateBookingInput>;
  isPending: boolean;
  availableSeats: SeatPickerState;
  timeZone: string;
  /** The seat already on the booking, kept selectable even if no longer "available". */
  currentSeat: AvailableSeat | null;
};

/** A partner user picks no partner and no seat: operations assign the seat. */
type PartnerCreateModeProps = {
  mode: "partner-create";
  register: UseFormRegister<CreatePartnerBookingInput>;
  control: Control<CreatePartnerBookingInput>;
  errors: FieldErrors<CreatePartnerBookingInput>;
  isPending: boolean;
  options: Pick<BookingFormOptions, "airports" | "categories">;
  timeZone: string | null;
};

type PartnerEditModeProps = {
  mode: "partner-edit";
  register: UseFormRegister<UpdatePartnerBookingInput>;
  errors: FieldErrors<UpdatePartnerBookingInput>;
  isPending: boolean;
  timeZone: string;
};

type BookingFormProps =
  | CreateModeProps
  | EditModeProps
  | PartnerCreateModeProps
  | PartnerEditModeProps;

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
  control,
  errors,
  isPending,
  hint,
  placeholder = "Select...",
  choices,
}: Pick<
  FieldShellProps<TFieldValues>,
  "name" | "label" | "errors" | "isPending" | "hint"
> & {
  control: Control<TFieldValues>;
  placeholder?: string;
  choices: { value: string; label: string }[];
}) {
  const error = fieldError(errors, name);

  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Controller
        control={control}
        name={name as Path<TFieldValues>}
        render={({ field }) => (
          <Select
            value={field.value ?? ""}
            items={[{ value: "", label: placeholder }, ...choices]}
            onValueChange={(value) => field.onChange(value)}
            disabled={isPending}
          >
            <SelectTrigger
              id={name}
              aria-invalid={!!error}
              aria-describedby={describedBy(name, error, hint)}
              className="w-full"
            >
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{placeholder}</SelectItem>
              {choices.map((choice) => (
                <SelectItem key={choice.value} value={choice.value}>
                  {choice.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
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
      <Textarea
        id={name}
        rows={3}
        aria-invalid={!!error}
        aria-describedby={describedBy(name, error)}
        disabled={isPending}
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
  /** Needed only where the seat is picked (`availableSeats` is set). */
  control?: Control<TFieldValues>;
  errors: FieldErrors<TFieldValues>;
  isPending: boolean;
  /** `null` hides the seat field (a partner user does not pick a seat). */
  availableSeats: SeatPickerState | null;
  timeZone: string | null;
  currentSeat: AvailableSeat | null;
}

/** Fields editable in every mode; the seat only where `availableSeats` is set. */
function SharedFields<TFieldValues extends FieldValues>({
  register,
  control,
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

  const seatChoices = [...(availableSeats?.seats ?? [])];
  if (currentSeat && !seatChoices.some((seat) => seat.id === currentSeat.id)) {
    seatChoices.unshift(currentSeat);
  }

  let seatHint = "Optional. You can assign a seat later.";
  if (availableSeats && !availableSeats.isReady) {
    seatHint = "Choose airport, category, pickup and return to list seats.";
  } else if (availableSeats?.isLoading) {
    seatHint = "Loading available seats...";
  } else if (availableSeats?.failed) {
    seatHint = "Could not load available seats.";
  } else if (availableSeats && seatChoices.length === 0) {
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
      {availableSeats && control && (
        <SelectField
          {...shell}
          control={control}
          name="assigned_seat_id"
          label="Seat"
          placeholder="No seat (assign later)"
          hint={seatHint}
          choices={seatChoices.map((seat) => ({
            value: seat.id,
            label: seat.serial_number,
          }))}
        />
      )}
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
  if (props.mode === "partner-create") {
    const { register, control, errors, isPending, options, timeZone } = props;
    const shell = { register, errors, isPending };

    return (
      <FieldGroup>
        <SelectField
          {...shell}
          control={control}
          name="airport_id"
          label="Airport"
          choices={options.airports}
        />
        <SelectField
          {...shell}
          control={control}
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
          availableSeats={null}
          timeZone={timeZone}
          currentSeat={null}
        />
      </FieldGroup>
    );
  }

  if (props.mode === "partner-edit") {
    const { register, errors, isPending, timeZone } = props;

    return (
      <FieldGroup>
        <SharedFields
          register={register}
          errors={errors}
          isPending={isPending}
          availableSeats={null}
          timeZone={timeZone}
          currentSeat={null}
        />
      </FieldGroup>
    );
  }

  if (props.mode === "create") {
    const {
      register,
      control,
      errors,
      isPending,
      options,
      availableSeats,
      timeZone,
    } = props;
    const shell = { register, errors, isPending };

    return (
      <FieldGroup>
        <SelectField
          {...shell}
          control={control}
          name="partner_id"
          label="Partner"
          choices={options.partners}
        />
        <SelectField
          {...shell}
          control={control}
          name="airport_id"
          label="Airport"
          choices={options.airports}
        />
        <SelectField
          {...shell}
          control={control}
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
          control={control}
          availableSeats={availableSeats}
          timeZone={timeZone}
          currentSeat={null}
        />
      </FieldGroup>
    );
  }

  const {
    register,
    control,
    errors,
    isPending,
    availableSeats,
    timeZone,
    currentSeat,
  } = props;

  return (
    <FieldGroup>
      <SharedFields
        register={register}
        control={control}
        errors={errors}
        isPending={isPending}
        availableSeats={availableSeats}
        timeZone={timeZone}
        currentSeat={currentSeat}
      />
    </FieldGroup>
  );
}
