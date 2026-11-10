"use client";

import { Lock } from "lucide-react";
import type { ReactNode } from "react";
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
  FieldLabel,
} from "@/components/ui/field";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Input } from "@/components/ui/input";
import { InputGroup } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AvailableSeat } from "@/features/bookings/actions/get-available-seats.action";
import { BookingSeatPicker } from "@/features/bookings/components/booking-seat-picker";
import { formatTimeZoneLabel } from "@/features/bookings/lib/booking-time";
import {
  CHILD_AGE_BAND_HINT,
  childAgeBandChoices,
} from "@/features/bookings/lib/child-age-bands";
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
  /** The name of the chosen seat category, shown next to the seat. */
  categoryName?: string | null;
};

/** What a booking keeps after it is created: shown, never edited. */
export interface BookingReadOnlySummary {
  partner: string;
  airport: string;
  category: string;
  daily_rate: string;
}

type EditModeProps = {
  mode: "edit";
  register: UseFormRegister<UpdateBookingInput>;
  control: Control<UpdateBookingInput>;
  errors: FieldErrors<UpdateBookingInput>;
  isPending: boolean;
  availableSeats: SeatPickerState;
  timeZone: string;
  /** The seat already on the booking, kept selectable even if no longer "available". */
  currentSeat: Pick<AvailableSeat, "id" | "serial_number"> | null;
  summary: BookingReadOnlySummary;
  /** The pickup time has passed: pickup and seat are read only. */
  pickupLocked: boolean;
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
  control: Control<UpdatePartnerBookingInput>;
  errors: FieldErrors<UpdatePartnerBookingInput>;
  isPending: boolean;
  timeZone: string;
  /** The airport and category of the booking: shown, never edited. */
  summary: { airport: string; category: string };
};

type BookingFormProps =
  | CreateModeProps
  | EditModeProps
  | PartnerCreateModeProps
  | PartnerEditModeProps;

function describedBy(name: string, error?: FieldError, hint?: string) {
  // The message of an error replaces the hint (design D2).
  if (error) return `${name}-error`;
  return hint ? `${name}-hint` : undefined;
}

function fieldError<TFieldValues extends FieldValues>(
  errors: FieldErrors<TFieldValues>,
  name: string,
): FieldError | undefined {
  return (errors as Record<string, FieldError | undefined>)[name];
}

interface FieldShellProps<TFieldValues extends FieldValues> {
  name: string;
  label: string;
  register: UseFormRegister<TFieldValues>;
  errors: FieldErrors<TFieldValues>;
  isPending: boolean;
  hint?: string;
  required?: boolean;
}

function RequiredMark({ required }: { required?: boolean }) {
  return required ? <span aria-hidden="true">*</span> : null;
}

function FieldFooter({
  name,
  error,
  hint,
}: {
  name: string;
  error?: FieldError;
  hint?: string;
}) {
  return (
    <>
      {hint && !error && (
        <FieldDescription id={`${name}-hint`} className="text-xs">
          {hint}
        </FieldDescription>
      )}
      <FieldErrorMessage id={`${name}-error`} errors={error ? [error] : undefined} />
    </>
  );
}

function TextField<TFieldValues extends FieldValues>({
  name,
  label,
  register,
  errors,
  isPending,
  hint,
  required,
  endSign,
  inputMode,
}: FieldShellProps<TFieldValues> & {
  /** A fixed unit after the text, for example `cm`. */
  endSign?: string;
  inputMode?: "decimal";
}) {
  const error = fieldError(errors, name);
  const input = (
    <Input
      id={name}
      type="text"
      inputMode={inputMode}
      className="h-11"
      aria-invalid={!!error}
      aria-describedby={describedBy(name, error, hint)}
      disabled={isPending}
      {...register(name as Path<TFieldValues>)}
    />
  );

  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={name}>
        {label} <RequiredMark required={required} />
      </FieldLabel>
      {endSign ? <InputGroup endSign={endSign}>{input}</InputGroup> : input}
      <FieldFooter name={name} error={error} hint={hint} />
    </Field>
  );
}

function MoneyField<TFieldValues extends FieldValues>({
  name,
  label,
  register,
  errors,
  isPending,
  hint,
  required,
}: FieldShellProps<TFieldValues>) {
  const error = fieldError(errors, name);

  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={name}>
        {label} <RequiredMark required={required} />
      </FieldLabel>
      <InputGroup
        startSign="USD"
        className="data-[start=true]:[&_input]:pl-12"
      >
        <Input
          id={name}
          type="text"
          inputMode="decimal"
          className="h-11"
          aria-invalid={!!error}
          aria-describedby={describedBy(name, error, hint)}
          disabled={isPending}
          {...register(name as Path<TFieldValues>)}
        />
      </InputGroup>
      <FieldFooter name={name} error={error} hint={hint} />
    </Field>
  );
}

type Choice = { value: string; label: string };

function SelectField<TFieldValues extends FieldValues>({
  name,
  label,
  control,
  errors,
  isPending,
  hint,
  required,
  placeholder = "Select...",
  choices,
}: Pick<
  FieldShellProps<TFieldValues>,
  "name" | "label" | "errors" | "isPending" | "hint" | "required"
> & {
  control: Control<TFieldValues>;
  placeholder?: string;
  /** A function gets the chosen value, so a saved value that is no longer offered stays listed. */
  choices: Choice[] | ((value: string) => Choice[]);
}) {
  const error = fieldError(errors, name);

  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={name}>
        {label} <RequiredMark required={required} />
      </FieldLabel>
      <Controller
        control={control}
        name={name as Path<TFieldValues>}
        render={({ field }) => {
          const list =
            typeof choices === "function" ? choices(field.value ?? "") : choices;

          return (
            <Select
              value={field.value ?? ""}
              items={[{ value: "", label: placeholder }, ...list]}
              onValueChange={(value) => field.onChange(value)}
              disabled={isPending}
            >
              <SelectTrigger
                id={name}
                aria-invalid={!!error}
                aria-describedby={describedBy(name, error, hint)}
                className="w-full data-[size=default]:h-11"
              >
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{placeholder}</SelectItem>
                {list.map((choice) => (
                  <SelectItem key={choice.value} value={choice.value}>
                    {choice.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }}
      />
      <FieldFooter name={name} error={error} hint={hint} />
    </Field>
  );
}

function DateTimeField<TFieldValues extends FieldValues>({
  name,
  label,
  control,
  errors,
  isPending,
  hint,
  required,
  locked,
  lockedReason,
  timeZone,
}: Pick<
  FieldShellProps<TFieldValues>,
  "name" | "label" | "errors" | "isPending" | "hint" | "required"
> & {
  control: Control<TFieldValues>;
  locked?: boolean;
  lockedReason?: string;
  timeZone?: string | null;
}) {
  const error = fieldError(errors, name);
  const shownHint = locked && lockedReason ? lockedReason : hint;

  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={name}>
        {label} <RequiredMark required={required} />
        {locked && <LockIcon />}
      </FieldLabel>
      <Controller
        control={control}
        name={name as Path<TFieldValues>}
        render={({ field }) => (
          <DateTimePicker
            id={name}
            value={field.value ?? ""}
            onValueChange={field.onChange}
            timeZone={timeZone}
            disabled={isPending || locked}
            aria-invalid={!!error}
            aria-describedby={describedBy(name, error, shownHint)}
          />
        )}
      />
      <FieldFooter name={name} error={error} hint={shownHint} />
    </Field>
  );
}

function LockIcon() {
  return <Lock className="size-3.5 text-muted-foreground" aria-label="Locked" />;
}

function TextAreaField<TFieldValues extends FieldValues>({
  name,
  label,
  register,
  errors,
  isPending,
  hint,
}: FieldShellProps<TFieldValues>) {
  const error = fieldError(errors, name);

  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Textarea
        id={name}
        rows={5}
        className="min-h-28"
        aria-invalid={!!error}
        aria-describedby={describedBy(name, error, hint)}
        disabled={isPending}
        {...register(name as Path<TFieldValues>)}
      />
      <FieldFooter name={name} error={error} hint={hint} />
    </Field>
  );
}

function ReadOnlyField({
  id,
  label,
  value,
  startSign,
  required,
}: {
  id: string;
  label: string;
  value: string;
  startSign?: string;
  required?: boolean;
}) {
  const input = (
    <Input id={id} value={value} readOnly disabled className="h-11" />
  );

  return (
    <Field>
      <FieldLabel htmlFor={id}>
        {label} <RequiredMark required={required} />
        <LockIcon />
      </FieldLabel>
      {startSign ? (
        <InputGroup startSign={startSign} className="data-[start=true]:[&_input]:pl-12">
          {input}
        </InputGroup>
      ) : (
        input
      )}
    </Field>
  );
}

function Section({
  number,
  title,
  className,
  children,
}: {
  number: number;
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-foreground">
        <span className="mr-1.5 text-muted-foreground">{number}</span>
        {title}
      </h2>
      <div className={className ?? "grid gap-4 sm:grid-cols-2"}>{children}</div>
    </section>
  );
}

interface SharedNodesArgs<TFieldValues extends FieldValues> {
  register: UseFormRegister<TFieldValues>;
  control: Control<TFieldValues>;
  errors: FieldErrors<TFieldValues>;
  isPending: boolean;
  timeZone: string | null;
  pickupLocked?: boolean;
}

/** The fields every mode shows; the form lays them out. */
function sharedNodes<TFieldValues extends FieldValues>({
  register,
  control,
  errors,
  isPending,
  timeZone,
  pickupLocked,
}: SharedNodesArgs<TFieldValues>) {
  const shell = { register, errors, isPending };
  const timeHint = timeZone
    ? `Airport time, ${formatTimeZoneLabel(timeZone)}`
    : "Airport local time";

  return {
    pickup: (
      <DateTimeField
        control={control}
        errors={errors}
        isPending={isPending}
        name="pickup_at"
        timeZone={timeZone}
        label="Pickup date and time"
        required
        hint={timeHint}
        locked={pickupLocked}
        lockedReason="Locked: the pickup time has passed."
      />
    ),
    ret: (
      <DateTimeField
        control={control}
        errors={errors}
        isPending={isPending}
        name="return_at"
        timeZone={timeZone}
        label="Return date and time"
        required
        hint={timeHint}
      />
    ),
    external: (
      <TextField
        {...shell}
        name="external_booking_number"
        label="External booking number"
        hint="Optional"
      />
    ),
    ageBand: (
      <SelectField
        control={control}
        errors={errors}
        isPending={isPending}
        name="child_age_band"
        label="Child age band"
        required
        placeholder="Select age band"
        hint={CHILD_AGE_BAND_HINT}
        choices={(value) =>
          childAgeBandChoices(value).map((band) => ({ value: band, label: band }))
        }
      />
    ),
    height: (
      <TextField
        {...shell}
        name="child_height"
        label="Child height"
        inputMode="decimal"
        endSign="cm"
        hint="Optional"
      />
    ),
    vehicle: (
      <TextField
        {...shell}
        name="vehicle"
        label="Vehicle and registration"
        hint="Optional"
      />
    ),
    bay: (
      <TextField {...shell} name="vehicle_bay" label="Pickup bay" hint="Optional" />
    ),
    flight: (
      <TextField
        {...shell}
        name="flight_number"
        label="Flight number"
        hint="Looked up when saved"
      />
    ),
    notes: (
      <TextAreaField
        {...shell}
        name="notes"
        label="Internal notes"
        hint="Optional · Internal only"
      />
    ),
  };
}

interface SeatSectionProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  errors: FieldErrors<TFieldValues>;
  isPending: boolean;
  availableSeats: SeatPickerState;
  currentSeat: Pick<AvailableSeat, "id" | "serial_number"> | null;
  categoryName?: string | null;
  locked?: boolean;
}

function SeatField<TFieldValues extends FieldValues>({
  control,
  errors,
  isPending,
  availableSeats,
  currentSeat,
  categoryName,
  locked,
}: SeatSectionProps<TFieldValues>) {
  const name = "assigned_seat_id";
  const error = fieldError(errors, name);

  let hint = "Leave empty to allocate later";
  if (locked) {
    hint = "Locked: the pickup time has passed.";
  } else if (!availableSeats.isReady) {
    hint = "Choose airport, category, pickup and return to list seats.";
  } else if (availableSeats.isLoading) {
    hint = "Loading seats...";
  } else if (availableSeats.failed) {
    hint = "Could not load seats.";
  } else if (availableSeats.seats.length === 0) {
    hint = "No seats found for this airport and category.";
  }

  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={name}>
        Seat picker
        {locked && <LockIcon />}
      </FieldLabel>
      <Controller
        control={control}
        name={name as Path<TFieldValues>}
        render={({ field }) => (
          <BookingSeatPicker
            id={name}
            value={field.value ?? ""}
            onValueChange={field.onChange}
            seats={availableSeats.seats}
            currentSeat={currentSeat}
            categoryName={categoryName}
            disabled={isPending || locked || !availableSeats.isReady}
            invalid={!!error}
            describedBy={describedBy(name, error, hint)}
          />
        )}
      />
      <FieldFooter name={name} error={error} hint={hint} />
    </Field>
  );
}

interface BookingGridProps {
  /** Section 1, without the external booking number. */
  identity: ReactNode;
  pickup: ReactNode;
  ret: ReactNode;
  external: ReactNode;
  ageBand: ReactNode;
  /** Child height and, where it is picked, the seat category. */
  childRow: ReactNode;
  seat: ReactNode | null;
  price: ReactNode | null;
  flight: ReactNode | null;
  vehicle: ReactNode;
  bay: ReactNode;
  notes: ReactNode;
}

/** The sections of design D2: 1-3 on the left, 4-7 on the right (one column on a phone). */
function BookingGrid({
  identity,
  pickup,
  ret,
  external,
  ageBand,
  childRow,
  seat,
  price,
  flight,
  vehicle,
  bay,
  notes,
}: BookingGridProps) {
  let sectionNumber = 3;
  const next = () => ++sectionNumber;

  return (
    <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
      <div className="flex flex-col gap-6">
        <Section number={1} title="Booking information">
          {identity}
          <div className="sm:col-span-2">{external}</div>
        </Section>
        <Section number={2} title="Pickup and return">
          {pickup}
          {ret}
        </Section>
        <Section number={3} title="Child">
          <div className="sm:col-span-2">{ageBand}</div>
          {childRow}
        </Section>
      </div>
      <div className="flex flex-col gap-6">
        {seat && (
          <Section number={next()} title="Seat" className="grid gap-4">
            {seat}
          </Section>
        )}
        {price && (
          <Section number={next()} title="Price" className="grid gap-4">
            {price}
          </Section>
        )}
        <Section
          number={next()}
          title="Flight and vehicle"
          className={
            flight
              ? "grid gap-4 sm:grid-cols-[7rem_minmax(0,1fr)_6rem]"
              : "grid gap-4 sm:grid-cols-[minmax(0,1fr)_6rem]"
          }
        >
          {flight}
          {vehicle}
          {bay}
        </Section>
        <Section number={next()} title="Notes" className="grid gap-4">
          {notes}
        </Section>
      </div>
    </div>
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
    const shared = sharedNodes({ register, control, errors, isPending, timeZone });

    return (
      <BookingGrid
        identity={
          <SelectField
            {...shell}
            control={control}
            name="airport_id"
            label="Airport"
            required
            placeholder="Select airport"
            hint="Required"
            choices={options.airports}
          />
        }
        pickup={shared.pickup}
        ret={shared.ret}
        external={shared.external}
        ageBand={shared.ageBand}
        childRow={
          <>
            {shared.height}
            <SelectField
              {...shell}
              control={control}
              name="seat_category_id"
              label="Seat category"
              required
              placeholder="Select category"
              hint="Required"
              choices={options.categories}
            />
          </>
        }
        seat={null}
        price={
          <MoneyField
            {...shell}
            name="daily_rate"
            label="Daily price"
            required
            hint="Required · Daily price must be greater than 0"
          />
        }
        flight={null}
        vehicle={shared.vehicle}
        bay={shared.bay}
        notes={shared.notes}
      />
    );
  }

  if (props.mode === "partner-edit") {
    const { register, control, errors, isPending, timeZone, summary } = props;
    const shared = sharedNodes({ register, control, errors, isPending, timeZone });

    return (
      <BookingGrid
        identity={
          <ReadOnlyField id="airport" label="Airport" value={summary.airport} required />
        }
        pickup={shared.pickup}
        ret={shared.ret}
        external={shared.external}
        ageBand={shared.ageBand}
        childRow={
          <>
            {shared.height}
            <ReadOnlyField
              id="seat_category"
              label="Seat category"
              value={summary.category}
              required
            />
          </>
        }
        seat={null}
        price={null}
        flight={null}
        vehicle={shared.vehicle}
        bay={shared.bay}
        notes={shared.notes}
      />
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
      categoryName,
    } = props;
    const shell = { register, errors, isPending };
    const shared = sharedNodes({ register, control, errors, isPending, timeZone });

    return (
      <BookingGrid
        identity={
          <>
            <SelectField
              {...shell}
              control={control}
              name="partner_id"
              label="Partner"
              required
              placeholder="Select partner"
              hint="Required"
              choices={options.partners}
            />
            <SelectField
              {...shell}
              control={control}
              name="airport_id"
              label="Airport"
              required
              placeholder="Select airport"
              hint="Required"
              choices={options.airports}
            />
          </>
        }
        pickup={shared.pickup}
        ret={shared.ret}
        external={shared.external}
        ageBand={shared.ageBand}
        childRow={
          <>
            {shared.height}
            <SelectField
              {...shell}
              control={control}
              name="seat_category_id"
              label="Seat category"
              required
              placeholder="Select category"
              hint="Required"
              choices={options.categories}
            />
          </>
        }
        seat={
          <SeatField
            control={control}
            errors={errors}
            isPending={isPending}
            availableSeats={availableSeats}
            currentSeat={null}
            categoryName={categoryName}
          />
        }
        price={
          <MoneyField
            {...shell}
            name="daily_rate"
            label="Daily price"
            required
            hint="Required · Daily price must be greater than 0"
          />
        }
        flight={shared.flight}
        vehicle={shared.vehicle}
        bay={shared.bay}
        notes={shared.notes}
      />
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
    summary,
    pickupLocked,
  } = props;
  const shared = sharedNodes({
    register,
    control,
    errors,
    isPending,
    timeZone,
    pickupLocked,
  });

  return (
    <BookingGrid
      identity={
        <>
          <ReadOnlyField id="partner" label="Partner" value={summary.partner} required />
          <ReadOnlyField id="airport" label="Airport" value={summary.airport} required />
        </>
      }
      pickup={shared.pickup}
      ret={shared.ret}
      external={shared.external}
      ageBand={shared.ageBand}
      childRow={
        <>
          {shared.height}
          <ReadOnlyField
            id="seat_category"
            label="Seat category"
            value={summary.category}
            required
          />
        </>
      }
      seat={
        <SeatField
          control={control}
          errors={errors}
          isPending={isPending}
          availableSeats={availableSeats}
          currentSeat={currentSeat}
          categoryName={summary.category}
          locked={pickupLocked}
        />
      }
      price={
        <ReadOnlyField
          id="daily_price"
          label="Daily price"
          value={summary.daily_rate}
          startSign="USD"
          required
        />
      }
      flight={shared.flight}
      vehicle={shared.vehicle}
      bay={shared.bay}
      notes={shared.notes}
    />
  );
}
