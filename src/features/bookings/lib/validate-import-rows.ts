import { BOOKING_IMPORT_TEMPLATE_COLUMNS } from "@/features/bookings/lib/booking-import-template";
import { CHILD_AGE_BANDS, CHILD_AGE_BAND_HINT } from "@/features/bookings/lib/child-age-bands";
import { formatLocalDateTime } from "@/features/bookings/lib/booking-time";
import { createBookingSchema } from "@/features/bookings/schemas/booking.schema";

/** What the rows of a file are checked against: the partner and the airport of the import, and the seat categories in use. */
export interface ImportRowLookups {
  partnerId: string;
  airportId: string;
  /** The name of an active seat category, in lower case, to its id. */
  categoryIdsByName: ReadonlyMap<string, string>;
}

type ImportRowStatus = "valid" | "error";

export interface ImportRowResult {
  /** The line of the data row in the file, counting the first row under the header as 1. */
  row_number: number;
  external_booking_number: string;
  /** The pickup time as written for the report: `08 Nov 2026, 09:30`, or the text as it was in the file. */
  pickup_time: string;
  flight_number: string;
  seat_category: string;
  status: ImportRowStatus;
  /** Why the row is refused; `null` for a valid row. */
  error: string | null;
}

export interface ImportReport {
  total: number;
  valid: number;
  invalid: number;
  partner_name: string;
  /** The time zone of the airport; the pickup and return times of the file are in it. */
  timezone: string;
  rows: ImportRowResult[];
}

const COLUMN_INDEX = Object.fromEntries(
  BOOKING_IMPORT_TEMPLATE_COLUMNS.map((column, index) => [column, index]),
) as Record<(typeof BOOKING_IMPORT_TEMPLATE_COLUMNS)[number], number>;

/** `2026-11-08 09:30` becomes `2026-11-08T09:30`, the form the booking rules read. Anything else is left as it is. */
function toLocalDateTime(value: string): string {
  return value.replace(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})$/, "$1T$2");
}

/**
 * CO-F07-S03 (R7, R8): checks one data row. The columns are mapped to the booking fields, and the row
 * is then checked by `createBookingSchema`, the schema of manual entry, so a row is accepted or refused
 * by the same rules as a booking typed by hand. Two rules the form meets with a menu are checked here:
 * the seat category is one in use, and the child age band is one the form offers.
 */
export function validateImportRow(cells: string[], rowNumber: number, lookups: ImportRowLookups): ImportRowResult {
  const cell = (column: keyof typeof COLUMN_INDEX) => (cells[COLUMN_INDEX[column]] ?? "").trim();

  const pickup = toLocalDateTime(cell("pickup_time"));
  const flightNumber = cell("flight_number");
  const seatCategory = cell("seat_category");
  const childAgeBand = cell("child_age_band");
  const categoryId = lookups.categoryIdsByName.get(seatCategory.toLowerCase());

  const result = (error: string | null): ImportRowResult => ({
    row_number: rowNumber,
    external_booking_number: cell("external_booking_number"),
    pickup_time: formatLocalDateTime(pickup) || cell("pickup_time"),
    flight_number: flightNumber,
    seat_category: seatCategory,
    status: error === null ? "valid" : "error",
    error,
  });

  if (cells.length > BOOKING_IMPORT_TEMPLATE_COLUMNS.length) return result("Row has more columns than the template");
  if (seatCategory !== "" && !categoryId) return result("Seat category not found");
  if (childAgeBand !== "" && !(CHILD_AGE_BANDS as readonly string[]).includes(childAgeBand)) {
    return result(`Child age band must be one of ${CHILD_AGE_BAND_HINT}`);
  }

  const parsed = createBookingSchema.safeParse({
    partner_id: lookups.partnerId,
    airport_id: lookups.airportId,
    seat_category_id: categoryId ?? "",
    daily_rate: cell("rate"),
    pickup_at: pickup,
    return_at: toLocalDateTime(cell("return_time")),
    external_booking_number: cell("external_booking_number"),
    child_age_band: childAgeBand,
    vehicle: cell("vehicle"),
    notes: cell("notes"),
    flight_number: flightNumber,
  });

  return result(parsed.success ? null : (parsed.error.issues[0]?.message ?? "Row is not valid"));
}

/** The report of a file: every data row checked, and the counts the report shows before anything is saved (R1). */
export function buildImportReport(
  dataRows: string[][],
  lookups: ImportRowLookups,
  context: { partnerName: string; timezone: string },
): ImportReport {
  const rows = dataRows.map((cells, index) => validateImportRow(cells, index + 1, lookups));
  const valid = rows.filter((row) => row.status === "valid").length;

  return {
    total: rows.length,
    valid,
    invalid: rows.length - valid,
    partner_name: context.partnerName,
    timezone: context.timezone,
    rows,
  };
}

export type ImportRowFilter ="all" | "valid" | "error";

/** The rows a filter of the report shows, at most `limit` of them, and how many rows the filter matches. */
export function filterImportRows(rows: readonly ImportRowResult[], filter: ImportRowFilter, limit: number) {
  const matching = filter === "all" ? rows : rows.filter((row) => row.status === filter);

  return { rows: matching.slice(0, limit), matching: matching.length };
}
