import { BOOKING_STATUS_LABEL } from "@/features/bookings/lib/booking-status";
import { formatTimeInStep, formatStepDate } from "@/features/bookings/lib/booking-step-history";
import { formatTimeZoneLabel } from "@/features/bookings/lib/booking-time";
import type { BookingDetailItem, BookingFlight } from "@/features/bookings/lib/get-bookings";
import type { BookingStatus } from "@/features/bookings/types";
import { formatClock, getBannerDetail, isFlightLanded } from "@/features/flights/lib/flight-panel";
import { classifyFlight, getFlightDisruption, getFlightOffsetMinutes } from "@/lib/flights/flight-timing";
import { BOOKING_BOARD_STEPS, stepOf } from "@/lib/workflow/board";

/**
 * What the Overview tab of a booking shows (UI-F06-T03): the groups of label and value, the steps of the
 * workflow and the wording of the time in the step. Pure, no I/O. A value that is not stored is "-".
 */

const EMPTY = "-";

export interface OverviewRow {
  label: string;
  value: string;
}

export interface OverviewGroup {
  title: string;
  rows: OverviewRow[];
}

export type OverviewStepState = "done" | "current" | "upcoming";

export interface OverviewStep {
  status: BookingStatus;
  label: string;
  state: OverviewStepState;
}

/** `24 Oct 2026 · 16:30 GST · Asia/Dubai`: every time carries the airport time zone. */
export function formatOverviewDateTime(iso: string | null, timeZone: string): string {
  if (!iso) return EMPTY;
  return `${formatStepDate(iso, timeZone)} · ${formatClock(iso, timeZone)} · ${timeZone}`;
}

/** "1 minute", "24 minutes", then "2 h 10 min" once it is an hour or more. */
export function formatMinutesInStep(minutes: number): string {
  if (minutes >= 60) return formatTimeInStep(minutes);
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

/** `Family Ready · 24 minutes`; the label alone when no event says when the step began. */
export function formatStepWithTime(status: BookingStatus, minutes: number | null): string {
  const label = BOOKING_STATUS_LABEL[status];
  return minutes === null ? label : `${label} · ${formatMinutesInStep(minutes)}`;
}

/** The 13 steps in order with the current one marked; a booking off the path (cancelled, no-show) has no current step. */
export function buildOverviewSteps(status: BookingStatus): OverviewStep[] {
  const current = stepOf(status);
  const currentIndex = current ? current.number - 1 : -1;

  return BOOKING_BOARD_STEPS.map((step, index) => ({
    status: step,
    label: BOOKING_STATUS_LABEL[step],
    state: index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming",
  }));
}

/** The place of the pickup: `DXB · Terminal 3 · Bay C-14`, from what is stored. */
function buildLocation(booking: BookingDetailItem): string {
  const parts = [
    booking.airport?.code,
    booking.flight?.terminal ? `Terminal ${booking.flight.terminal}` : null,
    booking.vehicle_bay ? `Bay ${booking.vehicle_bay}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : EMPTY;
}

/** The key-value groups of the Overview, top to bottom. */
export function buildOverviewGroups(
  booking: BookingDetailItem,
  timeZone: string,
  minutes: number | null,
): OverviewGroup[] {
  return [
    {
      title: "Booking information",
      rows: [
        { label: "Partner", value: booking.partner?.name ?? EMPTY },
        { label: "External booking number", value: booking.external_booking_number ?? EMPTY },
        { label: "Status", value: BOOKING_STATUS_LABEL[booking.status] },
        {
          label: "Workflow step",
          value: stepOf(booking.status) ? formatStepWithTime(booking.status, minutes) : EMPTY,
        },
      ],
    },
    {
      title: "Pickup and return",
      rows: [
        { label: "Pickup", value: formatOverviewDateTime(booking.pickup_at, timeZone) },
        { label: "Return", value: formatOverviewDateTime(booking.return_at, timeZone) },
        { label: "Location", value: buildLocation(booking) },
        {
          label: "Vehicle and registration",
          value: booking.vehicle ?? EMPTY,
        },
      ],
    },
    {
      title: "Child",
      rows: [
        { label: "Age band", value: booking.child_age_band ?? EMPTY },
        {
          label: "Child height",
          value: booking.child_height === null ? EMPTY : `${booking.child_height} cm`,
        },
        { label: "Required category", value: booking.category?.name ?? EMPTY },
      ],
    },
    {
      title: "Seat and team",
      rows: [
        { label: "Assigned seat", value: booking.seat?.serial_number ?? "Not assigned" },
        { label: "Technician", value: booking.technician?.full_name ?? EMPTY },
      ],
    },
    {
      title: "Price",
      rows: [{ label: "Daily rate", value: booking.daily_rate.toFixed(2) }],
    },
  ];
}

export interface OverviewFlightAlert {
  /** `ARRIVING 45 MINUTES EARLY` or `DELAYED 30 MINUTES`. */
  title: string;
  /** `DXB EK 203`. */
  flightLine: string;
  detail: string;
  scheduled: string;
  estimated: string;
  /** The day of the scheduled arrival and the time zone it is read in. */
  dateLine: string;
  /** `Updated 14:45 GST · Asia/Dubai`; `null` when the flight was never synced. */
  updated: string | null;
}

/**
 * The alert of the Overview for a flight that is early or late. `null` when there is nothing to say: no flight,
 * a landed flight (final), a cancelled or diverted one (shown by its own alert) or one on time.
 */
export function buildOverviewFlightAlert(
  flight: BookingFlight | null,
  airportCode: string | undefined,
  timeZone: string,
  deadlineAt: string | null,
  pickupAt: string | null,
): OverviewFlightAlert | null {
  if (!flight || isFlightLanded(flight.status) || getFlightDisruption(flight.status)) return null;

  const offset = getFlightOffsetMinutes(flight);
  const timing = classifyFlight(offset);
  if (offset === null || (timing !== "early" && timing !== "delayed")) return null;

  const minutes = Math.abs(offset);
  const unit = minutes === 1 ? "MINUTE" : "MINUTES";
  const scheduled = flight.scheduled_arrival_at;

  return {
    title: timing === "delayed" ? `DELAYED ${minutes} ${unit}` : `ARRIVING ${minutes} ${unit} EARLY`,
    flightLine: [airportCode, flight.flight_number].filter(Boolean).join(" "),
    detail: getBannerDetail(flight.flight_number, flight.estimated_arrival_at, deadlineAt, pickupAt, timeZone),
    scheduled: scheduled ? formatClock(scheduled, timeZone) : EMPTY,
    estimated: flight.estimated_arrival_at ? formatClock(flight.estimated_arrival_at, timeZone) : EMPTY,
    dateLine: scheduled ? `${formatStepDate(scheduled, timeZone)} · ${formatTimeZoneLabel(timeZone)}` : EMPTY,
    updated: flight.last_synced_at ? `Updated ${formatClock(flight.last_synced_at, timeZone)} · ${timeZone}` : null,
  };
}
