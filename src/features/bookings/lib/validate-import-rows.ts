import { BOOKING_IMPORT_TEMPLATE_COLUMNS } from "@/features/bookings/lib/booking-import-template";
import { CHILD_AGE_BANDS, CHILD_AGE_BAND_HINT } from "@/features/bookings/lib/child-age-bands";
import { toCreateBookingRpcArgs } from "@/features/bookings/lib/booking-rpc-args";
import { formatLocalDateTime } from "@/features/bookings/lib/booking-time";
import { createBookingSchema, type CreateBookingInput } from "@/features/bookings/schemas/booking.schema";

/** CO-F07-S04 (R9): the reason of a row that repeats the external booking number of the partner. */
export const DUPLICATE_ROW_ERROR = "Duplicate external booking number";

/** What the rows of a file are checked against: the partner and the airport of the import, and the seat categories in use. */
export interface ImportRowLookups {
  partnerId: string;
  airportId: string;
  /** The name of an active seat category, in lower case, to its id. */
  categoryIdsByName: ReadonlyMap<string, string>;
}

type ImportRowStatus = "valid" | "error" | "duplicate";

export interface ImportRowResult {
  /** The line of the data row in the file, counting the first row under the header as 1. */
  row_number: number;
  external_booking_number: string;
  /** The pickup time as written for the report: `08 Nov 2026, 09:30`, or the text as it was in the file. */
  pickup_time: string;
  flight_number: string;
  seat_category: string;
  status: ImportRowStatus;
  /** Why the row is refused (an error, or a duplicate); `null` for a valid row. */
  error: string | null;
}

export interface ImportReport {
  total: number;
  valid: number;
  /** The rows that will not be imported: the ones with an error and the duplicates. */
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
function checkRow(
  cells: string[],
  rowNumber: number,
  lookups: ImportRowLookups,
): { result: ImportRowResult; input: CreateBookingInput | null } {
  const cell = (column: keyof typeof COLUMN_INDEX) => (cells[COLUMN_INDEX[column]] ?? "").trim();

  const pickup = toLocalDateTime(cell("pickup_time"));
  const flightNumber = cell("flight_number");
  const seatCategory = cell("seat_category");
  const childAgeBand = cell("child_age_band");
  const categoryId = lookups.categoryIdsByName.get(seatCategory.toLowerCase());

  const refuse = (error: string) => ({ result: describe(error), input: null });
  const describe = (error: string | null): ImportRowResult => ({
    row_number: rowNumber,
    external_booking_number: cell("external_booking_number"),
    pickup_time: formatLocalDateTime(pickup) || cell("pickup_time"),
    flight_number: flightNumber,
    seat_category: seatCategory,
    status: error === null ? "valid" : "error",
    error,
  });

  if (cells.length > BOOKING_IMPORT_TEMPLATE_COLUMNS.length) return refuse("Row has more columns than the template");
  if (seatCategory !== "" && !categoryId) return refuse("Seat category not found");
  if (childAgeBand !== "" && !(CHILD_AGE_BANDS as readonly string[]).includes(childAgeBand)) {
    return refuse(`Child age band must be one of ${CHILD_AGE_BAND_HINT}`);
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

  return parsed.success
    ? { result: describe(null), input: parsed.data }
    : refuse(parsed.error.issues[0]?.message ?? "Row is not valid");
}

/** The result of one data row, without the duplicate check (that needs the other rows and the bookings of the partner). */
export function validateImportRow(cells: string[], rowNumber: number, lookups: ImportRowLookups): ImportRowResult {
  return checkRow(cells, rowNumber, lookups).result;
}

/** One row to create, in the form `import_bookings()` reads (CO-F07-S05). */
export interface ImportRpcRow {
  row_number: number;
  seat_category_id: string;
  pickup_at: string;
  return_at: string;
  daily_rate: number;
  external_booking_number?: string;
  child_age_band?: string;
  vehicle?: string;
  notes?: string;
}

export interface ImportPlan {
  report: ImportReport;
  /** The valid rows that are not duplicates, in the order of the file: what a confirmed import creates. */
  rows: ImportRpcRow[];
}

/**
 * CO-F07-S03, S04, S05: every data row checked, the report with the counts (R1), and the rows a confirmed
 * import creates. A row is a duplicate (R9) when its external booking number is one the partner already has
 * or one an earlier valid row of the file has; the later row is refused and the booking that exists is not
 * touched. A row with no external booking number is never a duplicate.
 */
export function buildImportPlan(
  dataRows: string[][],
  lookups: ImportRowLookups,
  context: { partnerName: string; timezone: string; existingExternalNumbers?: ReadonlySet<string> },
): ImportPlan {
  const taken = new Set(context.existingExternalNumbers);
  const rows: ImportRpcRow[] = [];

  const results = dataRows.map((cells, index) => {
    const { result, input } = checkRow(cells, index + 1, lookups);
    if (!input) return result;

    const number = input.external_booking_number ?? "";
    if (number !== "" && taken.has(number)) {
      return { ...result, status: "duplicate" as const, error: DUPLICATE_ROW_ERROR };
    }

    const args = toCreateBookingRpcArgs(input, context.timezone);
    if (!args) return { ...result, status: "error" as const, error: "Pickup and return must be times at the airport" };

    if (number !== "") taken.add(number);
    rows.push({
      row_number: result.row_number,
      seat_category_id: args.p_seat_category_id,
      pickup_at: args.p_pickup_at,
      return_at: args.p_return_at,
      daily_rate: args.p_daily_rate,
      external_booking_number: args.p_external_booking_number,
      child_age_band: args.p_child_age_band,
      vehicle: args.p_vehicle,
      notes: args.p_notes,
    });
    return result;
  });

  const valid = rows.length;

  return {
    report: {
      total: results.length,
      valid,
      invalid: results.length - valid,
      partner_name: context.partnerName,
      timezone: context.timezone,
      rows: results,
    },
    rows,
  };
}

/** The report of a file, for a caller that does not need the rows to create. */
export function buildImportReport(
  dataRows: string[][],
  lookups: ImportRowLookups,
  context: { partnerName: string; timezone: string; existingExternalNumbers?: ReadonlySet<string> },
): ImportReport {
  return buildImportPlan(dataRows, lookups, context).report;
}

export type ImportRowFilter = "all" | "valid" | "error";

/** The rows a filter of the report shows, at most `limit` of them, and how many rows the filter matches. */
export function filterImportRows(rows: readonly ImportRowResult[], filter: ImportRowFilter, limit: number) {
  const matching =
    filter === "all" ? rows : rows.filter((row) => (filter === "valid" ? row.status === "valid" : row.status !== "valid"));

  return { rows: matching.slice(0, limit), matching: matching.length };
}
